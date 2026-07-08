"""Сиды для dev: админ + демо-структура. Запуск: python -m scripts.seed"""
from sqlalchemy import select

from app.core.db import Base, SessionLocal, engine
from app.modules.auth import models as _a  # noqa: F401
from app.modules.auth.models import User
from app.modules.courses import models as _c  # noqa: F401
from app.modules.org import models as _o  # noqa: F401
from app.modules.org.models import Department, Faculty, StudentGroup, Subject
from app.modules.org.schemas import UserCreate
from app.modules.org.service import create_user


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == "admin@meduni.uz")):
            print("Сиды уже применены — пропускаю.")
            return

        create_user(db, UserCreate(
            role="admin", full_name="Administrator",
            email="admin@meduni.uz", password="admin123",
        ))

        faculty = Faculty(name_uz="Davolash ishi", name_ru="Лечебное дело")
        db.add(faculty)
        db.flush()
        department = Department(faculty_id=faculty.id, name_uz="Anatomiya kafedrasi",
                                name_ru="Кафедра анатомии")
        db.add(department)
        db.flush()
        db.add(Subject(department_id=department.id, name_uz="Odam anatomiyasi",
                       name_ru="Анатомия человека"))
        db.add(StudentGroup(faculty_id=faculty.id, name="101-A", year_of_study=1))
        db.commit()
        print("Готово: admin@meduni.uz / admin123 + демо-структура.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
