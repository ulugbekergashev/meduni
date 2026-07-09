from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.errors import not_found
from app.modules.attendance.models import Attendance, LessonSession
from app.modules.courses.models import Enrollment
from app.modules.gamification import service
from app.modules.gamification.models import Badge, StudentBadge, StudentStats, XPConfig
from app.modules.gamification.schemas import (
    BadgeOut, LeaderboardOut, MyAttendanceRow, StatsOut, XPConfigIn,
)
from app.modules.org.models import GroupMembership, StudentGroup

router = APIRouter(tags=["gamification"])
student_only = require_roles("student")
admin_only = require_roles("admin")


@router.get("/me/stats", response_model=StatsOut, dependencies=[student_only])
def my_stats(user: CurrentUser, db: DbSession):
    stats = db.scalar(select(StudentStats).where(StudentStats.student_id == user.id))
    if stats is None:
        return StatsOut(total_xp=0, current_streak_days=0, best_streak=0)
    return StatsOut(total_xp=stats.total_xp, current_streak_days=stats.current_streak_days,
                    best_streak=stats.best_streak)


@router.get("/me/badges", response_model=list[BadgeOut], dependencies=[student_only])
def my_badges(user: CurrentUser, db: DbSession):
    earned = {sb.badge_id: sb.earned_at for sb in db.scalars(
        select(StudentBadge).where(StudentBadge.student_id == user.id))}
    out = []
    for badge in db.scalars(select(Badge).order_by(Badge.id)).all():
        out.append(BadgeOut(
            code=badge.code, title_uz=badge.title_uz, title_ru=badge.title_ru, icon=badge.icon,
            earned=badge.id in earned, earned_at=earned.get(badge.id),
        ))
    return out


def _scope_student_ids(db, user, scope: str, course_id: int | None) -> list[int]:
    if scope == "course" and course_id:
        return list(db.scalars(select(Enrollment.student_id).where(
            Enrollment.course_id == course_id, Enrollment.status == "active")).all())
    # группа студента
    membership = db.scalar(select(GroupMembership).where(GroupMembership.student_id == user.id))
    if scope == "group":
        if membership is None:
            return [user.id]
        return list(db.scalars(select(GroupMembership.student_id).where(
            GroupMembership.group_id == membership.group_id)).all())
    if scope == "faculty":
        if membership is None:
            return [user.id]
        group = db.get(StudentGroup, membership.group_id)
        faculty_groups = select(StudentGroup.id).where(StudentGroup.faculty_id == group.faculty_id)
        return list(db.scalars(select(GroupMembership.student_id).where(
            GroupMembership.group_id.in_(faculty_groups))).all())
    return [user.id]


@router.get("/leaderboards", response_model=LeaderboardOut, dependencies=[student_only])
def leaderboards(user: CurrentUser, db: DbSession,
                 scope: str = "group", course_id: int | None = None, period: str = "week"):
    student_ids = _scope_student_ids(db, user, scope, course_id)
    result = service.leaderboard(db, student_ids, user.id, period)
    return LeaderboardOut(**result)


@router.get("/me/attendance", response_model=list[MyAttendanceRow], dependencies=[student_only])
def my_attendance(user: CurrentUser, db: DbSession):
    marks = db.scalars(select(Attendance).where(Attendance.student_id == user.id)
                       .order_by(Attendance.marked_at.desc())).all()
    out = []
    for mark in marks:
        session = db.get(LessonSession, mark.session_id)
        if session:
            out.append(MyAttendanceRow(
                session_id=session.id, course_id=session.course_id,
                starts_at=session.starts_at, status=mark.status, room=session.room,
            ))
    return out


@router.get("/admin/xp-config", dependencies=[admin_only])
def get_xp_config(db: DbSession):
    return service.get_xp_values(db)


@router.put("/admin/xp-config", dependencies=[admin_only])
def set_xp_config(body: XPConfigIn, db: DbSession):
    cfg = db.scalar(select(XPConfig))
    if cfg is None:
        cfg = XPConfig(values_json=body.values_json)
        db.add(cfg)
    else:
        cfg.values_json = body.values_json
    db.commit()
    return service.get_xp_values(db)
