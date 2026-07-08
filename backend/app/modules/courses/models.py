from sqlalchemy import JSON, Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

course_groups = Table(
    "course_groups",
    Base.metadata,
    Column("course_id", ForeignKey("courses.id"), primary_key=True),
    Column("group_id", ForeignKey("student_groups.id"), primary_key=True),
)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    semester: Mapped[int]
    academic_year: Mapped[str] = mapped_column(String(16))  # "2026/2027"
    settings_json: Mapped[dict] = mapped_column(JSON, default=dict)

    groups = relationship("StudentGroup", secondary=course_groups, lazy="selectin")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
