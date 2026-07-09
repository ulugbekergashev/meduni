from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SessionCreateIn(BaseModel):
    course_id: int
    topic_id: int | None = None
    room: str | None = None
    late_after_min: int = 10


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    topic_id: int | None
    room: str | None
    starts_at: datetime
    attendance_open: bool
    late_after_min: int


class AttendanceRow(BaseModel):
    student_id: int
    student_name: str
    status: str | None  # None = ещё не отмечен
    method: str | None = None
    marked_at: datetime | None = None


class LiveListOut(BaseModel):
    session: SessionOut
    rows: list[AttendanceRow]
    present_count: int
    total: int


class CheckinIn(BaseModel):
    session_id: int
    token: str


class ManualMarkIn(BaseModel):
    student_id: int
    status: str  # present/late/absent/excused
