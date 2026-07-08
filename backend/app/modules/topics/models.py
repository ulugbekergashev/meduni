from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    title_uz: Mapped[str] = mapped_column(String(255))
    title_ru: Mapped[str] = mapped_column(String(255))
    order_index: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft/published
    unlock_rule_json: Mapped[dict] = mapped_column(JSON, default=dict)


class SourceMaterial(Base):
    __tablename__ = "source_materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    file_url: Mapped[str] = mapped_column(String(512))
    file_type: Mapped[str] = mapped_column(String(16))
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    parsed_text_url: Mapped[str | None] = mapped_column(String(512))
    parse_status: Mapped[str] = mapped_column(String(16), default="pending")  # pending/running/done/error
    parse_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TopicDigest(Base):
    __tablename__ = "topic_digests"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), unique=True, index=True)
    digest_json: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(default=1)
    approved_by_teacher: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), index=True)
    kind: Mapped[str] = mapped_column(String(24))  # digest / presentation / video / quiz / case
    status: Mapped[str] = mapped_column(String(16), default="queued")  # queued/running/done/error
    steps_json: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text)
    tokens_used: Mapped[int] = mapped_column(default=0)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GlossaryTerm(Base):
    __tablename__ = "glossary_terms"

    id: Mapped[int] = mapped_column(primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), index=True)
    term_uz: Mapped[str] = mapped_column(String(255))
    term_ru: Mapped[str] = mapped_column(String(255))
    term_lat: Mapped[str | None] = mapped_column(String(255))
