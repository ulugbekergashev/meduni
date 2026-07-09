from datetime import datetime

from pydantic import BaseModel


class StatsOut(BaseModel):
    total_xp: int
    current_streak_days: int
    best_streak: int


class BadgeOut(BaseModel):
    code: str
    title_uz: str
    title_ru: str
    icon: str
    earned: bool
    earned_at: datetime | None = None


class LeaderRow(BaseModel):
    rank: int
    student_id: int
    name: str
    xp: int


class LeaderboardOut(BaseModel):
    top: list[LeaderRow]
    me: LeaderRow | None
    total: int


class MyAttendanceRow(BaseModel):
    session_id: int
    course_id: int
    starts_at: datetime
    status: str
    room: str | None = None


class XPConfigIn(BaseModel):
    values_json: dict
