"""Публичные страницы предмета и преподавателя (план §9.1).
Доступны любому авторизованному пользователю платформы."""
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession
from app.core.errors import not_found
from app.modules.auth.models import User
from app.modules.courses.models import Course
from app.modules.org.models import Department, Subject, TeacherProfile

router = APIRouter(tags=["public"])


class CourseBrief(BaseModel):
    id: int
    semester: int
    academic_year: str
    subject_name_uz: str = ""
    subject_name_ru: str = ""
    teacher_name: str = ""


class SubjectPageOut(BaseModel):
    id: int
    name_uz: str
    name_ru: str
    description: str | None
    department_name_uz: str
    department_name_ru: str
    teachers: list[dict]
    courses: list[CourseBrief]


class TeacherPageOut(BaseModel):
    id: int
    full_name: str
    avatar_url: str | None
    department_name_uz: str = ""
    department_name_ru: str = ""
    position: str | None = None
    bio: str | None = None
    courses: list[CourseBrief]


def _course_brief(db, course: Course) -> CourseBrief:
    subject = db.get(Subject, course.subject_id)
    teacher = db.get(User, course.teacher_id)
    return CourseBrief(
        id=course.id, semester=course.semester, academic_year=course.academic_year,
        subject_name_uz=subject.name_uz if subject else "",
        subject_name_ru=subject.name_ru if subject else "",
        teacher_name=teacher.full_name if teacher else "",
    )


@router.get("/public/subjects/{subject_id}", response_model=SubjectPageOut)
def subject_page(subject_id: int, user: CurrentUser, db: DbSession):
    subject = db.get(Subject, subject_id)
    if subject is None:
        raise not_found("Fan")
    department = db.get(Department, subject.department_id)
    courses = db.scalars(select(Course).where(Course.subject_id == subject_id)).all()
    teacher_ids = {c.teacher_id for c in courses}
    teachers = []
    for tid in teacher_ids:
        teacher = db.get(User, tid)
        if teacher:
            teachers.append({"id": teacher.id, "full_name": teacher.full_name, "avatar_url": teacher.avatar_url})
    return SubjectPageOut(
        id=subject.id, name_uz=subject.name_uz, name_ru=subject.name_ru, description=subject.description,
        department_name_uz=department.name_uz if department else "",
        department_name_ru=department.name_ru if department else "",
        teachers=teachers,
        courses=[_course_brief(db, c) for c in courses],
    )


@router.get("/public/teachers/{teacher_id}", response_model=TeacherPageOut)
def teacher_page(teacher_id: int, user: CurrentUser, db: DbSession):
    teacher = db.get(User, teacher_id)
    if teacher is None or teacher.role != "teacher":
        raise not_found("Oʻqituvchi")
    profile = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == teacher_id))
    department = db.get(Department, profile.department_id) if profile and profile.department_id else None
    courses = db.scalars(select(Course).where(Course.teacher_id == teacher_id)).all()
    return TeacherPageOut(
        id=teacher.id, full_name=teacher.full_name, avatar_url=teacher.avatar_url,
        department_name_uz=department.name_uz if department else "",
        department_name_ru=department.name_ru if department else "",
        position=profile.position if profile else None,
        bio=profile.bio if profile else None,
        courses=[_course_brief(db, c) for c in courses],
    )
