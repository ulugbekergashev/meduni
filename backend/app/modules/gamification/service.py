"""XP-движок: начисление (идемпотентно по kind+ref), стрики, бейджи, лидерборды."""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.gamification.models import (
    Badge, StudentBadge, StudentStats, XPConfig, XPEvent,
)

DEFAULT_XP = {
    "lesson_completed": 50,
    "quiz_passed": 30,
    "quiz_perfect": 20,
    "case_submitted": 40,
    "attendance": 10,
    "streak_bonus": 25,
}


def get_xp_values(db: Session) -> dict:
    cfg = db.scalar(select(XPConfig))
    values = dict(DEFAULT_XP)
    if cfg and cfg.values_json:
        values.update(cfg.values_json)
    return values


def _stats(db: Session, student_id: int) -> StudentStats:
    stats = db.scalar(select(StudentStats).where(StudentStats.student_id == student_id))
    if stats is None:
        stats = StudentStats(student_id=student_id, total_xp=0, current_streak_days=0, best_streak=0)
        db.add(stats)
        db.flush()
    return stats


def _update_streak(db: Session, stats: StudentStats) -> int:
    """Обновляет стрик по дате активности. Возвращает бонус за стрик (кратно 5 дням)."""
    today = date.today()
    last = stats.last_activity_date
    if last == today:
        return 0  # активность уже засчитана сегодня
    if last == today - timedelta(days=1):
        stats.current_streak_days += 1
    else:
        stats.current_streak_days = 1
    stats.last_activity_date = today
    stats.best_streak = max(stats.best_streak, stats.current_streak_days)
    # бонус каждые 5 дней подряд
    return stats.current_streak_days if stats.current_streak_days % 5 == 0 else 0


def award(db: Session, student_id: int, course_id: int | None, kind: str, ref_id: int | None = None) -> int:
    """Начисляет XP за событие. Идемпотентно: (student, kind, ref_id) не дублируется.
    Возвращает начисленные очки (0 — если уже было)."""
    if ref_id is not None:
        exists = db.scalar(select(XPEvent).where(
            XPEvent.student_id == student_id, XPEvent.kind == kind, XPEvent.ref_id == ref_id))
        if exists:
            return 0

    values = get_xp_values(db)
    points = values.get(kind, 0)
    if points <= 0:
        return 0

    db.add(XPEvent(student_id=student_id, course_id=course_id, kind=kind, ref_id=ref_id, points=points))
    stats = _stats(db, student_id)
    stats.total_xp += points

    # стрик — только за «содержательные» события обучения (не за каждое)
    if kind in ("lesson_completed", "quiz_passed", "case_submitted", "attendance"):
        streak_days = _update_streak(db, stats)
        if streak_days:
            bonus = values.get("streak_bonus", 0)
            if bonus:
                db.add(XPEvent(student_id=student_id, course_id=course_id, kind="streak_bonus",
                               ref_id=int(f"{streak_days}{date.today().toordinal()}"), points=bonus))
                stats.total_xp += bonus

    db.flush()
    check_badges(db, student_id)
    return points


# --- Бейджи ------------------------------------------------------------------


def check_badges(db: Session, student_id: int) -> None:
    """Проверяет правила бейджей и выдаёт новые. rule_json: {type, ...}."""
    earned = {sb.badge_id for sb in db.scalars(
        select(StudentBadge).where(StudentBadge.student_id == student_id))}
    for badge in db.scalars(select(Badge)).all():
        if badge.id in earned:
            continue
        if _badge_met(db, student_id, badge.rule_json):
            db.add(StudentBadge(student_id=student_id, badge_id=badge.id))
    db.flush()


def _badge_met(db: Session, student_id: int, rule: dict) -> bool:
    rtype = rule.get("type")
    if rtype == "first_lesson":
        return db.scalar(select(func.count()).select_from(XPEvent).where(
            XPEvent.student_id == student_id, XPEvent.kind == "lesson_completed")) >= 1
    if rtype == "lessons_count":
        n = rule.get("n", 5)
        return db.scalar(select(func.count()).select_from(XPEvent).where(
            XPEvent.student_id == student_id, XPEvent.kind == "lesson_completed")) >= n
    if rtype == "streak":
        stats = db.scalar(select(StudentStats).where(StudentStats.student_id == student_id))
        return bool(stats and stats.best_streak >= rule.get("days", 14))
    if rtype == "total_xp":
        stats = db.scalar(select(StudentStats).where(StudentStats.student_id == student_id))
        return bool(stats and stats.total_xp >= rule.get("xp", 500))
    return False


def seed_default_badges(db: Session) -> None:
    defaults = [
        ("first_lesson", "Birinchi mavzu", "Первая тема", "🎓", {"type": "first_lesson"}),
        ("five_lessons", "Besh mavzu", "Пять тем", "📚", {"type": "lessons_count", "n": 5}),
        ("marathoner", "Marafonchi", "Марафонец", "🔥", {"type": "streak", "days": 14}),
        ("xp_500", "500 XP", "500 XP", "⭐", {"type": "total_xp", "xp": 500}),
    ]
    for code, uz, ru, icon, rule in defaults:
        if not db.scalar(select(Badge).where(Badge.code == code)):
            db.add(Badge(code=code, title_uz=uz, title_ru=ru, icon=icon, rule_json=rule))
    db.commit()


# --- Лидерборды --------------------------------------------------------------


def _period_start(period: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    if period == "week":
        return now - timedelta(days=now.weekday(), hours=now.hour, minutes=now.minute)
    return None  # semester = всё время (упрощённо)


def leaderboard(db: Session, student_ids: list[int], me_id: int, period: str = "week") -> dict:
    """Топ-10 + позиция текущего студента (план §7: не демотивировать нижнюю часть)."""
    from app.modules.auth.models import User

    q = select(XPEvent.student_id, func.sum(XPEvent.points).label("xp")).where(
        XPEvent.student_id.in_(student_ids))
    start = _period_start(period)
    if start is not None:
        q = q.where(XPEvent.created_at >= start)
    q = q.group_by(XPEvent.student_id).order_by(func.sum(XPEvent.points).desc())
    rows = db.execute(q).all()

    ranked = []
    for rank, (sid, xp) in enumerate(rows, start=1):
        user = db.get(User, sid)
        ranked.append({"rank": rank, "student_id": sid,
                       "name": user.full_name if user else "?", "xp": int(xp or 0)})

    me_rank = next((r for r in ranked if r["student_id"] == me_id), None)
    return {
        "top": ranked[:10],
        "me": me_rank,
        "total": len(student_ids),
    }
