from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import Response
from sqlalchemy import select

from pathlib import Path

from fastapi import UploadFile

from app.core import jobs, storage
from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.errors import ApiError, not_found
from app.modules.content import export, presentation_service, service, video_service
from app.modules.content.models import (
    ClinicalCase, ContentItem, Presentation, PresentationTemplate, Question, Quiz, Video,
)
from app.modules.content.schemas import (
    CaseDetailOut, CaseUpdateIn, ContentItemOut, GenerateCaseIn, GenerateQuizIn,
    GenerateVideoIn, PresentationDetailOut, QuestionOut, QuizDetailOut, QuizUpdateIn,
    ReadinessOut, ScriptUpdateIn, SlidesUpdateIn, TemplateIn, TemplateOut,
    TopicContentOut, VideoDetailOut,
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


def _check_quota(db: DbSession, topic_id: int) -> None:
    from app.modules.analytics.service import check_quota
    check_quota(db, topic_id)


# --- Сводка по теме ----------------------------------------------------------


@router.get("/topics/{topic_id}/content", response_model=TopicContentOut, dependencies=[staff_only])
def topic_content(topic_id: int, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)

    def item(kind: str):
        found = db.scalar(select(ContentItem).where(ContentItem.topic_id == topic_id, ContentItem.kind == kind))
        return ContentItemOut.model_validate(found) if found else None

    return TopicContentOut(quiz=item("quiz"), case=item("case"),
                           presentation=item("presentation"), video=item("video"))


# --- Генерация ---------------------------------------------------------------


@router.post("/topics/{topic_id}/quiz/generate", status_code=202, dependencies=[staff_only])
def generate_quiz(topic_id: int, body: GenerateQuizIn, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)
    _require_approved_digest(db, topic_id)
    _no_running_job(db, topic_id, "quiz")
    _check_quota(db, topic_id)
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
    _check_quota(db, topic_id)
    job = GenerationJob(topic_id=topic_id, kind="case", created_by=user.id)
    db.add(job)
    db.commit()
    jobs.submit(service.run_case_job, job.id, body.fmt)
    return {"job_id": job.id}


@router.post("/topics/{topic_id}/presentation/generate", status_code=202, dependencies=[staff_only])
def generate_presentation(topic_id: int, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)
    _require_approved_digest(db, topic_id)
    _no_running_job(db, topic_id, "presentation")
    _check_quota(db, topic_id)
    job = GenerationJob(topic_id=topic_id, kind="presentation", created_by=user.id)
    db.add(job)
    db.commit()
    jobs.submit(presentation_service.run_slides_job, job.id)
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


# --- Презентации (M4) --------------------------------------------------------


@router.get("/presentations/{content_id}", response_model=PresentationDetailOut, dependencies=[staff_only])
def get_presentation(content_id: int, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    _mark_reviewed(db, item)
    pres = db.scalar(select(Presentation).where(Presentation.content_item_id == item.id))
    return PresentationDetailOut(
        content=ContentItemOut.model_validate(item),
        slides_json=pres.slides_json, template_id=pres.template_id,
        pptx_url=pres.pptx_url, pptx_stale=pres.pptx_stale,
    )


@router.put("/presentations/{content_id}", response_model=PresentationDetailOut, dependencies=[staff_only])
def update_presentation(content_id: int, body: SlidesUpdateIn, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    if item.status == "published":
        raise ApiError(409, "published_locked", "Chop etilgan kontent tahrirlanmaydi", "Опубликованный контент нельзя менять")
    pres = db.scalar(select(Presentation).where(Presentation.content_item_id == item.id))
    pres.slides_json = body.slides_json
    pres.pptx_stale = True
    item.edited_by_teacher = True
    if item.status == "approved":
        item.status = "review"
        item.approved_at = None
        item.approved_by = None
    db.commit()
    return get_presentation(content_id, user, db)


@router.post("/presentations/{content_id}/slides/{slide_index}/image", status_code=202,
             dependencies=[staff_only])
def regenerate_slide_image(content_id: int, slide_index: int, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    pres = db.scalar(select(Presentation).where(Presentation.content_item_id == item.id))
    if slide_index >= len(pres.slides_json):
        raise not_found("Slayd")
    slides = list(pres.slides_json)
    slide = dict(slides[slide_index])
    if not (slide.get("image_prompt") or "").strip():
        raise ApiError(422, "no_prompt", "Bu slaydda rasm tavsifi yoʻq", "У слайда нет описания иллюстрации")
    slide["image_status"] = "running"
    slides[slide_index] = slide
    pres.slides_json = slides
    db.commit()
    jobs.submit(presentation_service.run_image_task, content_id, slide_index)
    return {"ok": True}


@router.post("/presentations/{content_id}/build", response_model=PresentationDetailOut,
             dependencies=[staff_only])
def build_presentation(content_id: int, user: CurrentUser, db: DbSession, lang: str = "ru"):
    _content_for_write(db, content_id, user)
    presentation_service.build_pptx(content_id, lang)
    return get_presentation(content_id, user, db)


@router.get("/presentations/{content_id}/download", dependencies=[staff_only])
def download_presentation(content_id: int, user: CurrentUser, db: DbSession, lang: str = "ru"):
    item = _content_for_write(db, content_id, user)
    pres = db.scalar(select(Presentation).where(Presentation.content_item_id == item.id))
    if pres.pptx_url is None or pres.pptx_stale:
        presentation_service.build_pptx(content_id, lang)
        db.refresh(pres)
    data = storage.full_path(pres.pptx_url).read_bytes()
    return Response(
        data,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="presentation_{content_id}.pptx"'},
    )


# --- Видео (M5) --------------------------------------------------------------


@router.post("/topics/{topic_id}/video/generate", status_code=202, dependencies=[staff_only])
def generate_video_script(topic_id: int, body: GenerateVideoIn, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)
    _require_approved_digest(db, topic_id)
    pres = db.scalar(select(ContentItem).where(
        ContentItem.topic_id == topic_id, ContentItem.kind == "presentation"
    ))
    if pres is None:
        raise ApiError(409, "no_presentation",
                       "Avval prezentatsiya (slaydlar) yarating", "Сначала создайте презентацию (слайды)")
    _no_running_job(db, topic_id, "video")
    _check_quota(db, topic_id)
    if body.language not in ("uz", "ru"):
        raise ApiError(422, "bad_lang", "Til uz yoki ru", "Язык uz или ru")
    job = GenerationJob(topic_id=topic_id, kind="video", created_by=user.id)
    db.add(job)
    db.commit()
    jobs.submit(video_service.run_script_job, job.id, body.language)
    return {"job_id": job.id}


@router.get("/videos/{content_id}", response_model=VideoDetailOut, dependencies=[staff_only])
def get_video(content_id: int, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    _mark_reviewed(db, item)
    video = db.scalar(select(Video).where(Video.content_item_id == item.id))
    return VideoDetailOut(
        content=ContentItemOut.model_validate(item),
        language=video.language, script_json=video.script_json, voice_id=video.voice_id,
        mp4_url=video.mp4_url, srt_url=video.srt_url, duration_sec=video.duration_sec,
        video_stale=video.video_stale,
    )


@router.put("/videos/{content_id}", response_model=VideoDetailOut, dependencies=[staff_only])
def update_video_script(content_id: int, body: ScriptUpdateIn, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    if item.status == "published":
        raise ApiError(409, "published_locked", "Chop etilgan kontent tahrirlanmaydi", "Опубликованный контент нельзя менять")
    video = db.scalar(select(Video).where(Video.content_item_id == item.id))
    video.script_json = body.script_json
    video.video_stale = True  # сценарий изменён — нужна пересборка
    item.edited_by_teacher = True
    if item.status == "approved":
        item.status = "review"
        item.approved_at = None
        item.approved_by = None
    db.commit()
    return get_video(content_id, user, db)


@router.post("/videos/{content_id}/build", status_code=202, dependencies=[staff_only])
def build_video(content_id: int, user: CurrentUser, db: DbSession):
    item = _content_for_write(db, content_id, user)
    _no_running_job(db, item.topic_id, "video_build")
    job = GenerationJob(topic_id=item.topic_id, kind="video_build", created_by=user.id)
    db.add(job)
    db.commit()
    jobs.submit(video_service.run_build_video, job.id)
    return {"job_id": job.id}


# --- Шаблоны презентаций (админ) ---------------------------------------------

admin_only = require_roles("admin")


@router.get("/presentation-templates", response_model=list[TemplateOut], dependencies=[staff_only])
def list_templates(db: DbSession):
    return db.scalars(select(PresentationTemplate).order_by(PresentationTemplate.id)).all()


@router.post("/presentation-templates", response_model=TemplateOut, status_code=201, dependencies=[admin_only])
def create_template(body: TemplateIn, db: DbSession):
    if body.is_default:
        for tpl in db.scalars(select(PresentationTemplate).where(PresentationTemplate.is_default == True)):  # noqa: E712
            tpl.is_default = False
    tpl = PresentationTemplate(**body.model_dump())
    db.add(tpl)
    db.commit()
    return tpl


@router.put("/presentation-templates/{template_id}", response_model=TemplateOut, dependencies=[admin_only])
def update_template(template_id: int, body: TemplateIn, db: DbSession):
    tpl = db.get(PresentationTemplate, template_id)
    if tpl is None:
        raise not_found()
    if body.is_default:
        for other in db.scalars(select(PresentationTemplate).where(PresentationTemplate.is_default == True)):  # noqa: E712
            other.is_default = False
    for key, value in body.model_dump().items():
        setattr(tpl, key, value)
    db.commit()
    return tpl


@router.post("/presentation-templates/{template_id}/logo", response_model=TemplateOut, dependencies=[admin_only])
async def upload_template_logo(template_id: int, file: UploadFile, db: DbSession):
    tpl = db.get(PresentationTemplate, template_id)
    if tpl is None:
        raise not_found()
    ext = Path(file.filename or "").suffix.lstrip(".").lower()
    if ext not in ("png", "jpg", "jpeg"):
        raise ApiError(422, "bad_logo", "Faqat PNG/JPG", "Только PNG/JPG")
    data = await file.read()
    if tpl.logo_url:
        storage.delete(tpl.logo_url)
    tpl.logo_url = storage.save_bytes("templates", file.filename or "logo.png", data)
    db.commit()
    return tpl


@router.delete("/presentation-templates/{template_id}", dependencies=[admin_only])
def delete_template(template_id: int, db: DbSession):
    tpl = db.get(PresentationTemplate, template_id)
    if tpl is None:
        raise not_found()
    if tpl.logo_url:
        storage.delete(tpl.logo_url)
    db.delete(tpl)
    db.commit()
    return {"ok": True}
