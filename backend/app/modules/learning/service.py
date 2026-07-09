"""Учебная логика студента: доступность/завершение тем, попытки тестов и кейсов."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.content.models import ClinicalCase, ContentItem, Question, Quiz
from app.modules.courses.models import Course, Enrollment
from app.modules.learning.models import CaseAttempt, Progress, QuizAttempt
from app.modules.learning.rules import date_gate_open, evaluate_completion, resolve_rule
from app.modules.topics.models import Topic


def is_enrolled(db: Session, student_id: int, course_id: int) -> bool:
    return db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course_id,
            Enrollment.status == "active",
        )
    ) is not None


def _published(db: Session, topic_id: int, kind: str) -> ContentItem | None:
    return db.scalar(
        select(ContentItem).where(
            ContentItem.topic_id == topic_id,
            ContentItem.kind == kind,
            ContentItem.status == "published",
        )
    )


def gather_facts(db: Session, student_id: int, topic: Topic) -> dict:
    """Собирает факты о прогрессе студента по теме для оценки правила."""
    progress = _get_progress(db, student_id, topic.id)

    quiz_item = _published(db, topic.id, "quiz")
    quiz_best, quiz_passed, has_quiz, quiz_attempted = 0.0, False, False, False
    if quiz_item:
        quiz = db.scalar(select(Quiz).where(Quiz.content_item_id == quiz_item.id))
        has_quiz = True
        attempts = db.scalars(
            select(QuizAttempt).where(
                QuizAttempt.quiz_id == quiz.id, QuizAttempt.student_id == student_id,
                QuizAttempt.finished_at.isnot(None),
            )
        ).all()
        if attempts:
            quiz_attempted = True
            quiz_best = max(a.score_pct for a in attempts)
            quiz_passed = any(a.passed for a in attempts)

    case_item = _published(db, topic.id, "case")
    has_case, case_submitted, case_reviewed = False, False, False
    if case_item:
        case = db.scalar(select(ClinicalCase).where(ClinicalCase.content_item_id == case_item.id))
        has_case = True
        ca = db.scalar(
            select(CaseAttempt).where(CaseAttempt.case_id == case.id, CaseAttempt.student_id == student_id)
        )
        if ca:
            case_submitted = True
            case_reviewed = ca.status == "reviewed"

    has_video = _published(db, topic.id, "video") is not None
    any_activity = (progress.video_watched_pct or 0) > 0 or quiz_attempted or case_submitted

    return {
        "has_video": has_video, "video_pct": progress.video_watched_pct,
        "has_quiz": has_quiz, "quiz_best_score": quiz_best, "quiz_passed": quiz_passed,
        "has_case": has_case, "case_submitted": case_submitted, "case_reviewed": case_reviewed,
        "any_activity": any_activity,
    }


def _get_progress(db: Session, student_id: int, topic_id: int) -> Progress:
    progress = db.scalar(
        select(Progress).where(Progress.student_id == student_id, Progress.topic_id == topic_id)
    )
    if progress is None:
        progress = Progress(student_id=student_id, topic_id=topic_id, state="locked")
        db.add(progress)
        db.flush()
    return progress


def recompute_course(db: Session, student_id: int, course_id: int) -> list[dict]:
    """Пересчитывает состояния всех тем курса для студента. Возвращает список
    {topic, state, video_pct, completed}."""
    course = db.get(Course, course_id)
    topics = db.scalars(
        select(Topic).where(Topic.course_id == course_id, Topic.status == "published")
        .order_by(Topic.order_index, Topic.id)
    ).all()

    result = []
    prev_completed = True  # для первой темы «предыдущая завершена» = True
    for topic in topics:
        rule = resolve_rule(topic.unlock_rule_json, course.settings_json)
        progress = _get_progress(db, student_id, topic.id)
        facts = gather_facts(db, student_id, topic)
        completed = evaluate_completion(rule, facts)

        available = (prev_completed and date_gate_open(rule)) or progress.manual_unlock
        if completed and available:
            state = "completed"
            if progress.completed_at is None:
                progress.completed_at = datetime.now(timezone.utc)
                # XP за завершение темы (идемпотентно по topic_id)
                from app.modules.gamification.service import award
                award(db, student_id, course_id, "lesson_completed", ref_id=topic.id)
        elif available:
            state = "in_progress" if facts["any_activity"] else "available"
        else:
            state = "locked"

        progress.state = state
        result.append({
            "topic": topic, "state": state,
            "video_pct": progress.video_watched_pct, "completed": completed,
        })
        prev_completed = completed and available
    db.commit()
    return result


def topic_state(db: Session, student_id: int, topic: Topic) -> str:
    """Состояние конкретной темы (пересчитывает курс — состояния зависят от предыдущих)."""
    states = recompute_course(db, student_id, topic.course_id)
    for row in states:
        if row["topic"].id == topic.id:
            return row["state"]
    return "locked"


def grade_quiz(db: Session, quiz: Quiz, answers: dict[int, int]) -> tuple[float, list[dict]]:
    """answers: {question_id: chosen_index}. Возвращает (score_pct, разбор по вопросам)."""
    questions = db.scalars(
        select(Question).where(Question.quiz_id == quiz.id).order_by(Question.order_index)
    ).all()
    if not questions:
        return 0.0, []
    correct = 0
    review = []
    for q in questions:
        chosen = answers.get(q.id, answers.get(str(q.id)))
        is_correct = chosen == q.correct_index
        if is_correct:
            correct += 1
        review.append({
            "question_id": q.id, "chosen": chosen, "correct_index": q.correct_index,
            "is_correct": is_correct,
        })
    return round(100.0 * correct / len(questions), 1), review
