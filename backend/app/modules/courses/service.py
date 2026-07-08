from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.auth.models import User
from app.modules.courses.models import Course, Enrollment
from app.modules.courses.schemas import CourseIn
from app.modules.org.models import GroupMembership, StudentGroup


def create_course(db: Session, data: CourseIn) -> Course:
    teacher = db.get(User, data.teacher_id)
    if teacher is None or teacher.role != "teacher":
        raise ApiError(422, "bad_teacher", "Oʻqituvchi topilmadi", "Преподаватель не найден")

    course = Course(
        subject_id=data.subject_id,
        teacher_id=data.teacher_id,
        semester=data.semester,
        academic_year=data.academic_year,
    )
    course.groups = list(
        db.scalars(select(StudentGroup).where(StudentGroup.id.in_(data.group_ids))).all()
    )
    db.add(course)
    db.flush()
    sync_enrollments(db, course)
    return course


def sync_enrollments(db: Session, course: Course) -> None:
    """Все студенты групп курса получают активный Enrollment (идемпотентно)."""
    group_ids = [g.id for g in course.groups]
    student_ids = set(
        db.scalars(
            select(GroupMembership.student_id).where(GroupMembership.group_id.in_(group_ids))
        ).all()
    )
    existing = set(
        db.scalars(select(Enrollment.student_id).where(Enrollment.course_id == course.id)).all()
    )
    for student_id in student_ids - existing:
        db.add(Enrollment(student_id=student_id, course_id=course.id))
