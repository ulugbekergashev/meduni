from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TopicIn(BaseModel):
    title_uz: str
    title_ru: str


class TopicOut(TopicIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    order_index: int
    status: str


class ReorderIn(BaseModel):
    course_id: int
    topic_ids: list[int]


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    file_type: str
    parse_status: str
    parse_error: str | None = None


class DigestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    digest_json: dict
    version: int
    approved_by_teacher: bool
    approved_at: datetime | None = None


class DigestIn(BaseModel):
    digest_json: dict


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    status: str
    steps_json: list
    error: str | None = None
    tokens_used: int


class TopicDetailOut(BaseModel):
    topic: TopicOut
    materials: list[MaterialOut]
    digest: DigestOut | None = None
    active_job: JobOut | None = None


class GlossaryIn(BaseModel):
    department_id: int
    term_uz: str
    term_ru: str
    term_lat: str | None = None


class GlossaryOut(GlossaryIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
