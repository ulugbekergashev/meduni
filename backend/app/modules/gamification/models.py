from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.modules.topics.models import utcnow


class XPEvent(Base):
    __tablename__ = "xp_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))  # lesson_completed/quiz_passed/quiz_perfect/...
    ref_id: Mapped[int | None] = mapped_column()  # для идемпотентности (topic_id/session_id/...)
    points: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class StudentStats(Base):
    __tablename__ = "student_stats"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    current_streak_days: Mapped[int] = mapped_column(Integer, default=0)
    best_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_date: Mapped[date | None] = mapped_column(Date)


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    title_uz: Mapped[str] = mapped_column(String(128))
    title_ru: Mapped[str] = mapped_column(String(128))
    icon: Mapped[str] = mapped_column(String(8), default="🏅")
    rule_json: Mapped[dict] = mapped_column(JSON, default=dict)


class StudentBadge(Base):
    __tablename__ = "student_badges"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id"))
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class XPConfig(Base):
    """Значения XP (правятся админом, план §7). Одна строка."""

    __tablename__ = "xp_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    values_json: Mapped[dict] = mapped_column(JSON, default=dict)
