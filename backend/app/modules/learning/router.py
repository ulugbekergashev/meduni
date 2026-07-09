from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.errors import ApiError, forbidden, not_found
from app.modules.auth.models import User
from app.modules.content.models import ClinicalCase, ContentItem, Presentation, Question, Quiz, Video
from app.modules.courses.models import Course
from app.modules.learning import service
from app.modules.learning.models import CaseAttempt, Progress, QuizAttempt
from app.modules.learning.schemas import (
    CaseReviewIn, CaseReviewItem, CaseSubmitIn, CaseView, CourseMapOut, LessonOut,
    PresentationView, QuestionReview, QuizResultOut, QuizStartOut, QuizSubmitIn,
    QuizView, TopicNode, UnlockRuleIn, VideoProgressIn, VideoView,
)
from app.modules.org.models import Subject
from app.modules.topics.models import Topic
from app.modules.topics.router import _topic_for_write

router = APIRouter(tags=["learning"])
student_only = require_roles("student")


def _require_enrolled(db: DbSession, user, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise not_found("Kurs")
    if not service.is_enrolled(db, user.id, course_id):
        raise forbidden()
    return course


# --- Карта курса (путь) ------------------------------------------------------


@router.get("/me/learn/courses/{course_id}", response_model=CourseMapOut, dependencies=[student_only])
def course_map(course_id: int, user: CurrentUser, db: DbSession):
    course = _require_enrolled(db, user, course_id)
    rows = service.recompute_course(db, user.id, course_id)
    subject = db.get(Subject, course.subject_id)
    teacher = db.get(User, course.teacher_id)
    nodes = [
        TopicNode(
            id=r["topic"].id, title_uz=r["topic"].title_uz, title_ru=r["topic"].title_ru,
            order_index=r["topic"].order_index, state=r["state"], video_pct=r["video_pct"],
        )
        for r in rows
    ]
    return CourseMapOut(
        course_id=course_id,
        subject_name_uz=subject.name_uz if subject else "",
        subject_name_ru=subject.name_ru if subject else "",
        teacher_name=teacher.full_name if teacher else "",
        topics=nodes,
        completed_count=sum(1 for n in nodes if n.state == "completed"),
        total_count=len(nodes),
    )


# --- Урок --------------------------------------------------------------------


def _published(db, topic_id: int, kind: str):
    return db.scalar(select(ContentItem).where(
        ContentItem.topic_id == topic_id, ContentItem.kind == kind, ContentItem.status == "published"
    ))


@router.get("/me/learn/topics/{topic_id}", response_model=LessonOut, dependencies=[student_only])
def lesson(topic_id: int, user: CurrentUser, db: DbSession):
    topic = db.get(Topic, topic_id)
    if topic is None or topic.status != "published":
        raise not_found("Mavzu")
    _require_enrolled(db, user, topic.course_id)
    state = service.topic_state(db, user.id, topic)
    if state == "locked":
        raise ApiError(423, "topic_locked", "Bu mavzu hali ochilmagan", "Тема ещё не открыта")

    out = LessonOut(topic_id=topic.id, course_id=topic.course_id,
                    title_uz=topic.title_uz, title_ru=topic.title_ru, state=state)

    if (vi := _published(db, topic_id, "video")):
        video = db.scalar(select(Video).where(Video.content_item_id == vi.id))
        if video and video.mp4_url:
            out.video = VideoView(content_id=vi.id, mp4_url=video.mp4_url, srt_url=video.srt_url,
                                  duration_sec=video.duration_sec, language=video.language)

    if (pi := _published(db, topic_id, "presentation")):
        pres = db.scalar(select(Presentation).where(Presentation.content_item_id == pi.id))
        out.presentation = PresentationView(content_id=pi.id, slides_json=pres.slides_json)

    if (qi := _published(db, topic_id, "quiz")):
        quiz = db.scalar(select(Quiz).where(Quiz.content_item_id == qi.id))
        count = len(db.scalars(select(Question).where(Question.quiz_id == quiz.id)).all())
        attempts = db.scalars(select(QuizAttempt).where(
            QuizAttempt.quiz_id == quiz.id, QuizAttempt.student_id == user.id,
            QuizAttempt.finished_at.isnot(None))).all()
        out.quiz = QuizView(
            content_id=qi.id, quiz_id=quiz.id, question_count=count,
            pass_threshold=quiz.pass_threshold, max_attempts=quiz.max_attempts,
            attempts_used=len(attempts),
            best_score=max((a.score_pct for a in attempts), default=0.0),
            passed=any(a.passed for a in attempts),
        )

    if (ci := _published(db, topic_id, "case")):
        case = db.scalar(select(ClinicalCase).where(ClinicalCase.content_item_id == ci.id))
        attempt = db.scalar(select(CaseAttempt).where(
            CaseAttempt.case_id == case.id, CaseAttempt.student_id == user.id))
        case_json = dict(case.case_json)
        if attempt is None:
            case_json.pop("reference_analysis", None)  # эталон скрыт до отправки
        out.case = CaseView(
            content_id=ci.id, case_id=case.id, case_json=case_json,
            submitted=attempt is not None,
            my_answers=attempt.answers_json if attempt else [],
            teacher_feedback=attempt.teacher_feedback if attempt else None,
            score=attempt.score if attempt else None,
            reviewed=attempt.status == "reviewed" if attempt else False,
        )

    return out


@router.post("/me/learn/topics/{topic_id}/video-progress", dependencies=[student_only])
def video_progress(topic_id: int, body: VideoProgressIn, user: CurrentUser, db: DbSession):
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise not_found()
    _require_enrolled(db, user, topic.course_id)
    progress = db.scalar(select(Progress).where(
        Progress.student_id == user.id, Progress.topic_id == topic_id))
    if progress is None:
        progress = Progress(student_id=user.id, topic_id=topic_id, video_watched_pct=0)
        db.add(progress)
    progress.video_watched_pct = max(progress.video_watched_pct or 0, min(100, max(0, body.pct)))
    db.commit()
    return {"video_watched_pct": progress.video_watched_pct}


# --- Тест --------------------------------------------------------------------


@router.post("/me/learn/quizzes/{content_id}/start", response_model=QuizStartOut, dependencies=[student_only])
def start_quiz(content_id: int, user: CurrentUser, db: DbSession):
    item = db.get(ContentItem, content_id)
    if item is None or item.status != "published" or item.kind != "quiz":
        raise not_found("Test")
    topic = db.get(Topic, item.topic_id)
    _require_enrolled(db, user, topic.course_id)
    quiz = db.scalar(select(Quiz).where(Quiz.content_item_id == item.id))
    used = db.scalars(select(QuizAttempt).where(
        QuizAttempt.quiz_id == quiz.id, QuizAttempt.student_id == user.id)).all()
    if len(used) >= quiz.max_attempts:
        raise ApiError(409, "no_attempts_left", "Urinishlar tugadi", "Попытки исчерпаны")

    attempt = QuizAttempt(quiz_id=quiz.id, student_id=user.id, attempt_no=len(used) + 1)
    db.add(attempt)
    db.commit()
    questions = db.scalars(select(Question).where(Question.quiz_id == quiz.id)
                           .order_by(Question.order_index)).all()
    return QuizStartOut(
        attempt_id=attempt.id, attempt_no=attempt.attempt_no, max_attempts=quiz.max_attempts,
        questions=[{"id": q.id, "question_uz": q.question_uz, "question_ru": q.question_ru,
                    "options_json": q.options_json} for q in questions],
    )


@router.post("/me/learn/attempts/{attempt_id}/submit", response_model=QuizResultOut, dependencies=[student_only])
def submit_quiz(attempt_id: int, body: QuizSubmitIn, user: CurrentUser, db: DbSession):
    attempt = db.get(QuizAttempt, attempt_id)
    if attempt is None or attempt.student_id != user.id:
        raise not_found("Urinish")
    if attempt.finished_at is not None:
        raise ApiError(409, "already_submitted", "Urinish yakunlangan", "Попытка уже завершена")
    quiz = db.get(Quiz, attempt.quiz_id)
    score, review = service.grade_quiz(db, quiz, body.answers)
    attempt.answers_json = {str(k): v for k, v in body.answers.items()}
    attempt.score_pct = score
    attempt.passed = score >= quiz.pass_threshold
    attempt.finished_at = datetime.now(timezone.utc)

    # XP: за сдачу теста и за 100% (идемпотентно по quiz_id)
    if attempt.passed:
        from app.modules.gamification.service import award
        topic = db.get(Topic, db.get(ContentItem, quiz.content_item_id).topic_id)
        course_id = topic.course_id if topic else None
        award(db, user.id, course_id, "quiz_passed", ref_id=quiz.id)
        if score >= 100.0:
            award(db, user.id, course_id, "quiz_perfect", ref_id=quiz.id)
    db.commit()

    used = db.scalars(select(QuizAttempt).where(
        QuizAttempt.quiz_id == quiz.id, QuizAttempt.student_id == user.id)).all()
    attempts_left = max(0, quiz.max_attempts - len(used))
    # разбор ошибок с объяснениями — после закрытия попыток или при прохождении (план §9.2)
    show_review = attempt.passed or attempts_left == 0

    review_out = []
    if show_review:
        questions = {q.id: q for q in db.scalars(select(Question).where(Question.quiz_id == quiz.id))}
        for r in review:
            q = questions.get(r["question_id"])
            review_out.append(QuestionReview(
                question_id=r["question_id"], chosen=r["chosen"],
                correct_index=r["correct_index"], is_correct=r["is_correct"],
                explanations_json=q.explanations_json if q else [],
            ))

    return QuizResultOut(
        score_pct=score, passed=attempt.passed, attempt_no=attempt.attempt_no,
        attempts_left=attempts_left, show_review=show_review, review=review_out,
    )


# --- Кейс --------------------------------------------------------------------


@router.post("/me/learn/cases/{content_id}/submit", dependencies=[student_only])
def submit_case(content_id: int, body: CaseSubmitIn, user: CurrentUser, db: DbSession):
    item = db.get(ContentItem, content_id)
    if item is None or item.status != "published" or item.kind != "case":
        raise not_found("Keys")
    topic = db.get(Topic, item.topic_id)
    _require_enrolled(db, user, topic.course_id)
    case = db.scalar(select(ClinicalCase).where(ClinicalCase.content_item_id == item.id))
    existing = db.scalar(select(CaseAttempt).where(
        CaseAttempt.case_id == case.id, CaseAttempt.student_id == user.id))
    if existing:
        raise ApiError(409, "already_submitted", "Keys allaqachon yuborilgan", "Кейс уже отправлен")
    db.add(CaseAttempt(case_id=case.id, student_id=user.id, answers_json=body.answers))
    from app.modules.gamification.service import award
    award(db, user.id, topic.course_id, "case_submitted", ref_id=case.id)
    db.commit()
    return {"ok": True, "reference_analysis": case.case_json.get("reference_analysis")}


# --- Преподаватель: очередь проверки кейсов ----------------------------------


@router.get("/teach/case-review", response_model=list[CaseReviewItem], dependencies=[require_roles("teacher", "admin")])
def case_review_queue(user: CurrentUser, db: DbSession):
    # кейсы студентов курсов этого преподавателя, статус submitted
    my_courses = select(Course.id).where(Course.teacher_id == user.id) if user.role == "teacher" else select(Course.id)
    topic_ids = select(Topic.id).where(Topic.course_id.in_(my_courses))
    case_ids = select(ClinicalCase.id).join(
        ContentItem, ClinicalCase.content_item_id == ContentItem.id
    ).where(ContentItem.topic_id.in_(topic_ids))
    attempts = db.scalars(select(CaseAttempt).where(
        CaseAttempt.case_id.in_(case_ids), CaseAttempt.status == "submitted"
    ).order_by(CaseAttempt.submitted_at)).all()

    out = []
    for a in attempts:
        student = db.get(User, a.student_id)
        case = db.get(ClinicalCase, a.case_id)
        item = db.get(ContentItem, case.content_item_id)
        topic = db.get(Topic, item.topic_id)
        row = CaseReviewItem.model_validate(a)
        row.student_name = student.full_name if student else ""
        row.topic_title = topic.title_ru if topic else ""
        out.append(row)
    return out


@router.post("/teach/case-attempts/{attempt_id}/review", dependencies=[require_roles("teacher", "admin")])
def review_case(attempt_id: int, body: CaseReviewIn, user: CurrentUser, db: DbSession):
    attempt = db.get(CaseAttempt, attempt_id)
    if attempt is None:
        raise not_found()
    case = db.get(ClinicalCase, attempt.case_id)
    item = db.get(ContentItem, case.content_item_id)
    _topic_for_write(db, item.topic_id, user)  # проверка, что тема этого преподавателя
    attempt.teacher_feedback = body.feedback
    attempt.score = max(0, min(100, body.score))
    attempt.status = "reviewed"
    attempt.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# --- Правила открытия (преподаватель) ----------------------------------------


@router.put("/topics/{topic_id}/unlock-rule", dependencies=[require_roles("teacher", "admin")])
def set_unlock_rule(topic_id: int, body: UnlockRuleIn, user: CurrentUser, db: DbSession):
    topic = _topic_for_write(db, topic_id, user)
    topic.unlock_rule_json = body.unlock_rule_json
    db.commit()
    return {"ok": True}


@router.put("/courses/{course_id}/default-unlock-rule", dependencies=[require_roles("teacher", "admin")])
def set_course_default_rule(course_id: int, body: UnlockRuleIn, user: CurrentUser, db: DbSession):
    course = db.get(Course, course_id)
    if course is None:
        raise not_found()
    if user.role != "admin" and course.teacher_id != user.id:
        raise forbidden()
    settings = dict(course.settings_json or {})
    settings["default_unlock_rule"] = body.unlock_rule_json
    course.settings_json = settings
    db.commit()
    return {"ok": True}


@router.post("/teach/topics/{topic_id}/manual-unlock/{student_id}", dependencies=[require_roles("teacher", "admin")])
def manual_unlock(topic_id: int, student_id: int, user: CurrentUser, db: DbSession):
    topic = _topic_for_write(db, topic_id, user)
    progress = db.scalar(select(Progress).where(
        Progress.student_id == student_id, Progress.topic_id == topic_id))
    if progress is None:
        progress = Progress(student_id=student_id, topic_id=topic_id)
        db.add(progress)
    progress.manual_unlock = True
    db.commit()
    return {"ok": True}
