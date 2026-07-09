from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.modules.topics.models import utcnow


class LessonSession(Base):
    """Занятие по расписанию (план §4.3). qr_secret — база для ротации QR (TOTP-like)."""

    __tablename__ = "lesson_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    room: Mapped[str | None] = mapped_column(String(64))
    attendance_open: Mapped[bool] = mapped_column(Boolean, default=False)
    qr_secret: Mapped[str] = mapped_column(String(64))
    # порог опоздания в минутах от starts_at
    late_after_min: Mapped[int] = mapped_column(default=10)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("lesson_sessions.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(12), default="present")  # present/late/absent/excused
    method: Mapped[str] = mapped_column(String(8), default="qr")  # qr/manual
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    """Аудит важных действий (план §4.5): ручные правки посещаемости, оценки, утверждения."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(64))
    entity: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[int | None] = mapped_column()
    payload: Mapped[str | None] = mapped_column(String(1024))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
