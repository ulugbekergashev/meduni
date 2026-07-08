from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GenerateQuizIn(BaseModel):
    count: int = 5
    pass_threshold: int = 70
    max_attempts: int = 3


class GenerateCaseIn(BaseModel):
    fmt: str = "short"  # short / extended


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_index: int
    question_uz: str
    question_ru: str
    options_json: list
    correct_index: int
    explanations_json: list
    difficulty: str
    source_fragment: str | None = None
    factcheck_status: str
    factcheck_note: str | None = None


class QuestionIn(BaseModel):
    question_uz: str
    question_ru: str
    options_json: list
    correct_index: int
    explanations_json: list = []
    difficulty: str = "understand"
    source_fragment: str | None = None


class QuizUpdateIn(BaseModel):
    pass_threshold: int
    max_attempts: int
    questions: list[QuestionIn]


class CaseUpdateIn(BaseModel):
    case_json: dict
    fmt: str = "short"


class ContentItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    kind: str
    status: str
    version: int
    reviewed: bool
    edited_by_teacher: bool
    factcheck_flags_resolved: bool
    approved_at: datetime | None = None
    source_digest_version: int | None = None


class QuizDetailOut(BaseModel):
    content: ContentItemOut
    pass_threshold: int
    max_attempts: int
    questions: list[QuestionOut]


class CaseDetailOut(BaseModel):
    content: ContentItemOut
    case_json: dict
    fmt: str
    factcheck_json: list


class TopicContentOut(BaseModel):
    """Сводка контента темы для конструктора: статусы теста, кейса и презентации."""
    quiz: ContentItemOut | None = None
    case: ContentItemOut | None = None
    presentation: ContentItemOut | None = None


class PresentationDetailOut(BaseModel):
    content: ContentItemOut
    slides_json: list
    template_id: int | None = None
    pptx_url: str | None = None
    pptx_stale: bool


class SlidesUpdateIn(BaseModel):
    slides_json: list


class TemplateIn(BaseModel):
    name: str
    primary_color: str = "0D9488"
    accent_color: str = "0F172A"
    is_default: bool = False


class TemplateOut(TemplateIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    logo_url: str | None = None


class ReadinessOut(BaseModel):
    """Чеклист готовности к публикации (план §9.3)."""
    digest_approved: bool
    reviewed: bool
    factcheck_resolved: bool
    can_approve: bool
    can_publish: bool
