from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import Response
from sqlalchemy import select

from app.core import jobs
from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.errors import ApiError, not_found
from app.modules.content import export, service
from app.modules.content.models import ClinicalCase, ContentItem, Question, Quiz
from app.modules.content.schemas import (
    CaseDetailOut, CaseUpdateIn, ContentItemOut, GenerateCaseIn, GenerateQuizIn,
    QuestionOut, QuizDetailOut, QuizUpdateIn, ReadinessOut, TopicContentOut,
)
from app.modules.topics.models import GenerationJob, Topic, TopicDigest
from app.modules.topics.router import _topic_for_write  # переиспользуем проверку доступа

router = APIRouter(tags=["content"])
staff_only = require_roles("admin", "teacher")


def _content_for_write(db: DbSession, content_id: int, user) -> ContentItem:
    item = db.get(ContentItem, content_id)
    if item is None:
        raise not_found("Kontent")
    _topic_for_write(db, item.topic_id, user)
    return item


def _require_approved_digest(db: DbSession, topic_id: int) -> TopicDigest:
    digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic_id))
    if digest is None or not digest.approved_by_teacher:
        # контрольная точка 1 (план §5.1): без утверждённого конспекта генерация невозможна
        raise ApiError(409, "digest_not_approved",
                       "Avval konspektni tasdiqlang", "Сначала утвердите конспект темы")
    return digest


def _no_running_job(db: DbSession, topic_id: int, kind: str) -> None:
    running = db.scalar(
        select(GenerationJob).where(
            GenerationJob.topic_id == topic_id, GenerationJob.kind == kind,
            GenerationJob.status.in_(("queued", "running")),
        )
    )
    if running:
        raise ApiError(409, "job_running", "Generatsiya ketmoqda", "Генерация уже идёт")


# --- Сводка по теме ----------------------------------------------------------


@router.get("/topics/{topic_id}/content", response_model=TopicContentOut, dependencies=[staff_only])
def topic_content(topic_id: int, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)
    quiz = db.scalar(select(ContentItem).where(ContentItem.topic_id == topic_id, ContentItem.kind == "quiz"))
    case = db.scalar(select(ContentItem).where(ContentItem.topic_id == topic_id, ContentItem.kind == "case"))
    return TopicContentOut(
        quiz=ContentItemOut.model_validate(quiz) if quiz else None,
        case=ContentItemOut.model_validate(case) if case else None,
    )


# --- Генерация ---------------------------------------------------------------


@router.post("/topics/{topic_id}/quiz/generate", status_code=202, dependencies=[staff_only])
def generate_quiz(topic_id: int, body: GenerateQuizIn, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)
    _require_approved_digest(db, topic_id)
    _no_running_job(db, topic_id, "quiz")
    job = GenerationJob(topic_id=topic_id, kind="quiz", created_by=user.id)
    db.add(job)
    db.commit()
    jobs.submit(service.run_quiz_job, job.id, body.count, body.pass_threshold, body.max_attempts)
    return {"job_id": job.id}


@router.post("/topics/{topic_id}/case/generate", status_code=202, dependencies=[staff_only])
def generate_case(topic_id: int, body: GenerateCaseIn, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)
    _require_approved_digest(db, topic_id)
    _no_running_job(db, topic_id, "case")
    job = GenerationJob(topic_id=topic_id, kind="case", created_by=user.id)
    db.add(job)
    db.commit()
    jobs.submit(service.run_case_job, job.id, body.fmt)
    return {"job_id": job.id}


# --- Чтение (открытие в редакторе = отметка reviewed) ------------------------


def _mark_reviewed(db: DbSession, item: ContentItem) -> None:
    if not item.reviewed:
        item.reviewed = True
        item.review_opened_at = datetime.now(timezone.utc)
        db.commit()


@router.get("/quizzes/{content_id}", response_model=QuizDetailOut, dependencies=[staff_only])
def get_quiz(content_id: int, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    _mark_reviewed(db, item)
    quiz = db.scalar(select(Quiz).where(Quiz.content_item_id == item.id))
    questions = db.scalars(
        select(Question).where(Question.quiz_id == quiz.id).order_by(Question.order_index)
    ).all()
    return QuizDetailOut(
        content=ContentItemOut.model_validate(item),
        pass_threshold=quiz.pass_threshold,
        max_attempts=quiz.max_attempts,
        questions=[QuestionOut.model_validate(q) for q in questions],
    )


@router.get("/cases/{content_id}", response_model=CaseDetailOut, dependencies=[staff_only])
def get_case(content_id: int, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    _mark_reviewed(db, item)
    case = db.scalar(select(ClinicalCase).where(ClinicalCase.content_item_id == item.id))
    return CaseDetailOut(
        content=ContentItemOut.model_validate(item),
        case_json=case.case_json, fmt=case.fmt, factcheck_json=case.factcheck_json,
    )


# --- Редактирование ----------------------------------------------------------


@router.put("/quizzes/{content_id}", response_model=QuizDetailOut, dependencies=[staff_only])
def update_quiz(content_id: int, body: QuizUpdateIn, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    if item.status == "published":
        raise ApiError(409, "published_locked", "Chop etilgan kontent tahrirlanmaydi", "Опубликованный контент нельзя менять")
    quiz = db.scalar(select(Quiz).where(Quiz.content_item_id == item.id))
    quiz.pass_threshold = body.pass_threshold
    quiz.max_attempts = body.max_attempts
    for old in db.scalars(select(Question).where(Question.quiz_id == quiz.id)):
        db.delete(old)
    db.flush()
    for idx, q in enumerate(body.questions):
        db.add(Question(
            quiz_id=quiz.id, order_index=idx,
            question_uz=q.question_uz, question_ru=q.question_ru,
            options_json=q.options_json, correct_index=q.correct_index,
            explanations_json=q.explanations_json, difficulty=q.difficulty,
            source_fragment=q.source_fragment, factcheck_status="resolved",
        ))
    # ручная правка: помечаем и снимаем возможное утверждение (контрольная точка)
    item.edited_by_teacher = True
    item.factcheck_flags_resolved = True
    if item.status == "approved":
        item.status = "review"
        item.approved_at = None
        item.approved_by = None
    db.commit()
    return get_quiz(content_id, user, db)


@router.put("/cases/{content_id}", response_model=CaseDetailOut, dependencies=[staff_only])
def update_case(content_id: int, body: CaseUpdateIn, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    if item.status == "published":
        raise ApiError(409, "published_locked", "Chop etilgan kontent tahrirlanmaydi", "Опубликованный контент нельзя менять")
    case = db.scalar(select(ClinicalCase).where(ClinicalCase.content_item_id == item.id))
    case.case_json = body.case_json
    case.fmt = body.fmt
    for flag in case.factcheck_json:
        flag["resolved"] = True
    case.factcheck_json = list(case.factcheck_json)
    item.edited_by_teacher = True
    item.factcheck_flags_resolved = True
    if item.status == "approved":
        item.status = "review"
        item.approved_at = None
    db.commit()
    return get_case(content_id, user, db)


@router.post("/questions/{question_id}/resolve-flag", response_model=QuestionOut, dependencies=[staff_only])
def resolve_question_flag(question_id: int, user: CurrentUser, db: DbSession):
    """Преподаватель подтверждает спорное утверждение фактчека без правки."""
    question = db.get(Question, question_id)
    if question is None:
        raise not_found()
    quiz = db.get(Quiz, question.quiz_id)
    item = _content_for_write(db, quiz.content_item_id, user)
    question.factcheck_status = "resolved"
    db.flush()
    remaining = db.scalar(
        select(Question).where(Question.quiz_id == quiz.id, Question.factcheck_status == "flagged")
    )
    item.factcheck_flags_resolved = remaining is None
    db.commit()
    return QuestionOut.model_validate(question)


# --- Утверждение и публикация (контрольная точка 2, план §5.1) ----------------


@router.get("/content/{content_id}/readiness", response_model=ReadinessOut, dependencies=[staff_only])
def readiness(content_id: int, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == item.topic_id))
    digest_ok = bool(digest and digest.approved_by_teacher)
    can_approve = digest_ok and item.reviewed and item.factcheck_flags_resolved and item.status in ("review", "draft")
    return ReadinessOut(
        digest_approved=digest_ok,
        reviewed=item.reviewed,
        factcheck_resolved=item.factcheck_flags_resolved,
        can_approve=can_approve,
        can_publish=item.status == "approved",
    )


@router.post("/content/{content_id}/approve", response_model=ContentItemOut, dependencies=[staff_only])
def approve_content(content_id: int, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == item.topic_id))
    if not (digest and digest.approved_by_teacher):
        raise ApiError(409, "digest_not_approved", "Konspekt tasdiqlanmagan", "Конспект не утверждён")
    if not item.reviewed:
        raise ApiError(409, "not_reviewed",
                       "Kontentni tahrirlashda oching (koʻrilmagan)",
                       "Откройте контент в редакторе — он ни разу не открывался")
    if not item.factcheck_flags_resolved:
        raise ApiError(409, "factcheck_unresolved",
                       "Faktcheck belgilariga ishlov bering", "Обработайте флаги фактчека")
    item.status = "approved"
    item.approved_by = user.id
    item.approved_at = datetime.now(timezone.utc)
    db.commit()
    return ContentItemOut.model_validate(item)


@router.post("/content/{content_id}/publish", response_model=ContentItemOut, dependencies=[staff_only])
def publish_content(content_id: int, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    if item.status != "approved":
        raise ApiError(409, "not_approved", "Avval tasdiqlang", "Сначала утвердите контент")
    item.status = "published"
    db.commit()
    return ContentItemOut.model_validate(item)


# --- Экспорт теста -----------------------------------------------------------


@router.get("/quizzes/{content_id}/export", dependencies=[staff_only])
def export_quiz(content_id: int, user: CurrentUser, db: DbSession, format: str = "moodle_xml", lang: str = "ru"):
    item = _content_for_write(db, content_id, user)
    quiz = db.scalar(select(Quiz).where(Quiz.content_item_id == item.id))
    questions = db.scalars(
        select(Question).where(Question.quiz_id == quiz.id).order_by(Question.order_index)
    ).all()
    topic = db.get(Topic, item.topic_id)
    title = topic.title_ru if lang == "ru" else topic.title_uz

    if format == "moodle_xml":
        return Response(export.to_moodle_xml(questions, lang), media_type="application/xml",
                        headers={"Content-Disposition": f'attachment; filename="quiz_{content_id}.xml"'})
    if format == "gift":
        return Response(export.to_gift(questions, lang), media_type="text/plain; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="quiz_{content_id}.gift.txt"'})
    if format == "pdf":
        return Response(export.to_pdf(questions, title, lang), media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="quiz_{content_id}.pdf"'})
    raise ApiError(422, "bad_format", "Format notoʻgʻri", "Неверный формат (moodle_xml|gift|pdf)")
