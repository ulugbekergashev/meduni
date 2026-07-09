"""Аналитика: расход AI по кафедрам, квоты, статистика вуза, heatmap прогресса."""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.analytics.models import AIQuota
from app.modules.auth.models import User
from app.modules.content.models import ContentItem
from app.modules.courses.models import Course, Enrollment
from app.modules.learning.models import CaseAttempt, Progress
from app.modules.org.models import Department, Subject
from app.modules.topics.models import GenerationJob, Topic


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


def department_of_topic(db: Session, topic_id: int) -> int | None:
    topic = db.get(Topic, topic_id)
    if topic is None:
        return None
    course = db.get(Course, topic.course_id)
    subject = db.get(Subject, course.subject_id) if course else None
    return subject.department_id if subject else None


def month_tokens_for_department(db: Session, department_id: int) -> int:
    """Сумма токенов генераций кафедры за текущий месяц."""
    subject_ids = select(Subject.id).where(Subject.department_id == department_id)
    course_ids = select(Course.id).where(Course.subject_id.in_(subject_ids))
    topic_ids = select(Topic.id).where(Topic.course_id.in_(course_ids))
    total = db.scalar(
        select(func.coalesce(func.sum(GenerationJob.tokens_used), 0)).where(
            GenerationJob.topic_id.in_(topic_ids),
            GenerationJob.created_at >= _month_start(),
        )
    )
    return int(total or 0)


def check_quota(db: Session, topic_id: int) -> None:
    """Бросает ошибку, если месячная квота кафедры исчерпана (план §13)."""
    from app.core.errors import ApiError

    dep_id = department_of_topic(db, topic_id)
    if dep_id is None:
        return
    quota = db.scalar(select(AIQuota).where(AIQuota.department_id == dep_id))
    if quota is None or quota.monthly_tokens <= 0:
        return  # без лимита
    if month_tokens_for_department(db, dep_id) >= quota.monthly_tokens:
        raise ApiError(429, "quota_exceeded",
                       "Kafedra oylik AI-limiti tugadi", "Месячный AI-лимит кафедры исчерпан")


def ai_usage_by_department(db: Session) -> list[dict]:
    """Расход токенов и число генераций по кафедрам за текущий месяц."""
    rows = []
    for dep in db.scalars(select(Department).order_by(Department.id)).all():
        subject_ids = select(Subject.id).where(Subject.department_id == dep.id)
        course_ids = select(Course.id).where(Course.subject_id.in_(subject_ids))
        topic_ids = select(Topic.id).where(Topic.course_id.in_(course_ids))
        jobs = db.execute(
            select(func.coalesce(func.sum(GenerationJob.tokens_used), 0), func.count()).where(
                GenerationJob.topic_id.in_(topic_ids),
                GenerationJob.created_at >= _month_start(),
            )
        ).one()
        quota = db.scalar(select(AIQuota).where(AIQuota.department_id == dep.id))
        rows.append({
            "department_id": dep.id, "name_uz": dep.name_uz, "name_ru": dep.name_ru,
            "tokens": int(jobs[0] or 0), "generations": int(jobs[1] or 0),
            "quota": quota.monthly_tokens if quota else 0,
        })
    return rows


def university_stats(db: Session) -> dict:
    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    return {
        "students": count(User, User.role == "student"),
        "teachers": count(User, User.role == "teacher"),
        "courses": count(Course),
        "topics_published": count(Topic, Topic.status == "published"),
        "content_published": count(ContentItem, ContentItem.status == "published"),
        "pending_cases": count(CaseAttempt, CaseAttempt.status == "submitted"),
        "tokens_this_month": db.scalar(
            select(func.coalesce(func.sum(GenerationJob.tokens_used), 0)).where(
                GenerationJob.created_at >= _month_start())) or 0,
    }


def course_heatmap(db: Session, course_id: int) -> dict:
    """Матрица студенты × темы: состояние прогресса (для heatmap преподавателя)."""
    topics = db.scalars(
        select(Topic).where(Topic.course_id == course_id).order_by(Topic.order_index, Topic.id)
    ).all()
    student_ids = db.scalars(select(Enrollment.student_id).where(
        Enrollment.course_id == course_id, Enrollment.status == "active")).all()
    students = db.scalars(select(User).where(User.id.in_(student_ids)).order_by(User.full_name)).all()

    progress = {(p.student_id, p.topic_id): p.state for p in db.scalars(
        select(Progress).where(Progress.topic_id.in_([t.id for t in topics])))}

    rows = []
    for student in students:
        cells = [progress.get((student.id, t.id), "locked") for t in topics]
        rows.append({"student_id": student.id, "name": student.full_name, "cells": cells})
    return {
        "topics": [{"id": t.id, "title_uz": t.title_uz, "title_ru": t.title_ru} for t in topics],
        "rows": rows,
    }


def teacher_tasks(db: Session, teacher_id: int) -> dict:
    """Задачи преподавателя: кейсы на проверку, контент на утверждении."""
    course_ids = select(Course.id).where(Course.teacher_id == teacher_id)
    topic_ids = select(Topic.id).where(Topic.course_id.in_(course_ids))

    from app.modules.content.models import ClinicalCase
    case_ids = select(ClinicalCase.id).join(
        ContentItem, ClinicalCase.content_item_id == ContentItem.id
    ).where(ContentItem.topic_id.in_(topic_ids))
    pending_cases = db.scalar(select(func.count()).select_from(CaseAttempt).where(
        CaseAttempt.case_id.in_(case_ids), CaseAttempt.status == "submitted")) or 0

    content_in_review = db.scalar(select(func.count()).select_from(ContentItem).where(
        ContentItem.topic_id.in_(topic_ids), ContentItem.status == "review")) or 0

    return {"pending_cases": int(pending_cases), "content_in_review": int(content_in_review)}
