from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.modules.topics.models import utcnow

# Жизненный цикл контента (план §4.2): draft → review → approved → published.
STATUSES = ("draft", "review", "approved", "published")


class ContentItem(Base):
    """Базовая сущность контента темы (тест/кейс). Контроль качества — план §5.3."""

    __tablename__ = "content_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), index=True)
    kind: Mapped[str] = mapped_column(String(24), index=True)  # quiz / case
    status: Mapped[str] = mapped_column(String(16), default="review")
    version: Mapped[int] = mapped_column(default=1)

    # Аудит проверки преподавателем (правки «Путь 3»)
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    review_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    edited_by_teacher: Mapped[bool] = mapped_column(Boolean, default=False)
    factcheck_flags_resolved: Mapped[bool] = mapped_column(Boolean, default=True)

    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Прослеживаемость (план §13): на чём основан артефакт
    source_digest_version: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(primary_key=True)
    content_item_id: Mapped[int] = mapped_column(ForeignKey("content_items.id"), unique=True, index=True)
    pass_threshold: Mapped[int] = mapped_column(default=70)  # % для сдачи
    max_attempts: Mapped[int] = mapped_column(default=3)


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id"), index=True)
    order_index: Mapped[int] = mapped_column(default=0)
    question_uz: Mapped[str] = mapped_column(Text)
    question_ru: Mapped[str] = mapped_column(Text)
    options_json: Mapped[list] = mapped_column(JSON)  # [{uz, ru}, ...]
    correct_index: Mapped[int] = mapped_column()
    explanations_json: Mapped[list] = mapped_column(JSON, default=list)  # [{uz, ru}, ...]
    difficulty: Mapped[str] = mapped_column(String(16), default="understand")  # recall/understand/apply
    source_fragment: Mapped[str | None] = mapped_column(Text)

    # Фактчек: ok / flagged / resolved
    factcheck_status: Mapped[str] = mapped_column(String(12), default="ok")
    factcheck_note: Mapped[str | None] = mapped_column(Text)


class ClinicalCase(Base):
    __tablename__ = "clinical_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    content_item_id: Mapped[int] = mapped_column(ForeignKey("content_items.id"), unique=True, index=True)
    case_json: Mapped[dict] = mapped_column(JSON, default=dict)
    fmt: Mapped[str] = mapped_column(String(12), default="short")  # short / extended
    # Фактчек кейса: список {location, note, resolved}
    factcheck_json: Mapped[list] = mapped_column(JSON, default=list)


class Presentation(Base):
    __tablename__ = "presentations"

    id: Mapped[int] = mapped_column(primary_key=True)
    content_item_id: Mapped[int] = mapped_column(ForeignKey("content_items.id"), unique=True, index=True)
    # slides_json: [{title_uz, title_ru, bullets_uz[], bullets_ru[], notes_uz, notes_ru,
    #                image_prompt, image_url|None, image_status}]
    slides_json: Mapped[list] = mapped_column(JSON, default=list)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("presentation_templates.id"))
    pptx_url: Mapped[str | None] = mapped_column(String(512))
    pptx_stale: Mapped[bool] = mapped_column(Boolean, default=True)  # нужна пересборка после правок


class PresentationTemplate(Base):
    __tablename__ = "presentation_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    # Фирменные цвета вуза (hex без #)
    primary_color: Mapped[str] = mapped_column(String(8), default="0D9488")
    accent_color: Mapped[str] = mapped_column(String(8), default="0F172A")
    logo_url: Mapped[str | None] = mapped_column(String(512))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(primary_key=True)
    content_item_id: Mapped[int] = mapped_column(ForeignKey("content_items.id"), unique=True, index=True)
    language: Mapped[str] = mapped_column(String(4), default="ru")  # uz / ru — озвучка одного языка
    # script_json: [{slide_index, text}] — текст озвучки по слайдам
    script_json: Mapped[list] = mapped_column(JSON, default=list)
    voice_id: Mapped[str | None] = mapped_column(String(64))
    mp4_url: Mapped[str | None] = mapped_column(String(512))
    srt_url: Mapped[str | None] = mapped_column(String(512))
    duration_sec: Mapped[int] = mapped_column(default=0)
    video_stale: Mapped[bool] = mapped_column(Boolean, default=True)
