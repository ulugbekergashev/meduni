from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.errors import not_found
from app.modules.auth.models import User
from app.modules.auth.schemas import UserOut
from app.modules.courses import service
from app.modules.courses.models import Course, Enrollment
from app.modules.courses.schemas import CourseIn, CourseOut, MyCourseOut
from app.modules.org.models import Subject

router = APIRouter(tags=["courses"])
admin_only = require_roles("admin")


def _with_names(db: DbSession, courses: list[Course]) -> list[MyCourseOut]:
    result = []
    for course in courses:
        subject = db.get(Subject, course.subject_id)
        teacher = db.get(User, course.teacher_id)
        out = MyCourseOut.model_validate(course)
        if subject:
            out.subject_name_uz, out.subject_name_ru = subject.name_uz, subject.name_ru
        if teacher:
            out.teacher_name = teacher.full_name
        result.append(out)
    return result


@router.get("/courses", response_model=list[MyCourseOut], dependencies=[admin_only])
def list_courses(db: DbSession):
    return _with_names(db, db.scalars(select(Course).order_by(Course.id)).all())


@router.post("/courses", response_model=CourseOut, status_code=201, dependencies=[admin_only])
def create_course(body: CourseIn, db: DbSession):
    course = service.create_course(db, body)
    db.commit()
    return course


@router.delete("/courses/{course_id}", dependencies=[admin_only])
def delete_course(course_id: int, db: DbSession):
    course = db.get(Course, course_id)
    if course is None:
        raise not_found()
    for enrollment in db.scalars(select(Enrollment).where(Enrollment.course_id == course_id)):
        db.delete(enrollment)
    course.groups = []
    db.delete(course)
    db.commit()
    return {"ok": True}


@router.get("/courses/{course_id}/students", response_model=list[UserOut],
            dependencies=[require_roles("admin", "teacher")])
def course_students(course_id: int, db: DbSession):
    if db.get(Course, course_id) is None:
        raise not_found()
    student_ids = select(Enrollment.student_id).where(Enrollment.course_id == course_id)
    return db.scalars(select(User).where(User.id.in_(student_ids)).order_by(User.full_name)).all()


@router.get("/me/courses", response_model=list[MyCourseOut])
def my_courses(user: CurrentUser, db: DbSession):
    if user.role == "teacher":
        courses = db.scalars(select(Course).where(Course.teacher_id == user.id)).all()
    elif user.role == "student":
        course_ids = select(Enrollment.course_id).where(
            Enrollment.student_id == user.id, Enrollment.status == "active"
        )
        courses = db.scalars(select(Course).where(Course.id.in_(course_ids))).all()
    else:
        courses = db.scalars(select(Course).order_by(Course.id)).all()
    return _with_names(db, courses)
