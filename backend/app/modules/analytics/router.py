from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.errors import forbidden, not_found
from app.modules.analytics import service
from app.modules.analytics.models import AIQuota
from app.modules.attendance.models import AuditLog
from app.modules.auth.models import User
from app.modules.courses.models import Course

router = APIRouter(tags=["analytics"])
admin_only = require_roles("admin")
staff = require_roles("teacher", "admin")


class QuotaIn(BaseModel):
    department_id: int
    monthly_tokens: int


# --- Админ: дашборд вуза ------------------------------------------------------


@router.get("/admin/stats", dependencies=[admin_only])
def admin_stats(db: DbSession):
    return service.university_stats(db)


@router.get("/admin/ai-usage", dependencies=[admin_only])
def admin_ai_usage(db: DbSession):
    return service.ai_usage_by_department(db)


@router.put("/admin/quotas", dependencies=[admin_only])
def set_quota(body: QuotaIn, db: DbSession):
    quota = db.scalar(select(AIQuota).where(AIQuota.department_id == body.department_id))
    if quota is None:
        quota = AIQuota(department_id=body.department_id, monthly_tokens=body.monthly_tokens)
        db.add(quota)
    else:
        quota.monthly_tokens = body.monthly_tokens
    db.commit()
    return {"ok": True}


@router.get("/admin/audit", dependencies=[admin_only])
def admin_audit(db: DbSession, limit: int = 100):
    logs = db.scalars(select(AuditLog).order_by(AuditLog.ts.desc()).limit(limit)).all()
    out = []
    for log in logs:
        actor = db.get(User, log.actor_id)
        out.append({
            "id": log.id, "actor": actor.full_name if actor else "?",
            "action": log.action, "entity": log.entity, "entity_id": log.entity_id,
            "payload": log.payload, "ts": log.ts,
        })
    return out


# --- Преподаватель: аналитика курса ------------------------------------------


@router.get("/teach/tasks", dependencies=[require_roles("teacher")])
def my_tasks(user: CurrentUser, db: DbSession):
    return service.teacher_tasks(db, user.id)


@router.get("/teach/courses/{course_id}/heatmap", dependencies=[staff])
def heatmap(course_id: int, user: CurrentUser, db: DbSession):
    course = db.get(Course, course_id)
    if course is None:
        raise not_found()
    if user.role != "admin" and course.teacher_id != user.id:
        raise forbidden()
    return service.course_heatmap(db, course_id)
