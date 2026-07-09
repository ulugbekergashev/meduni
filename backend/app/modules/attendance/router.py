import io
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import Response
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.errors import ApiError, forbidden, not_found
from app.modules.attendance import qr
from app.modules.attendance.models import Attendance, AuditLog, LessonSession
from app.modules.attendance.schemas import (
    AttendanceRow, CheckinIn, LiveListOut, ManualMarkIn, SessionCreateIn, SessionOut,
)
from app.modules.auth.models import User
from app.modules.courses.models import Course, Enrollment
from app.modules.gamification.service import award

router = APIRouter(tags=["attendance"])
staff = require_roles("teacher", "admin")
student_only = require_roles("student")


def _session_for_teacher(db, session_id: int, user) -> LessonSession:
    session = db.get(LessonSession, session_id)
    if session is None:
        raise not_found("Dars")
    course = db.get(Course, session.course_id)
    if user.role != "admin" and course.teacher_id != user.id:
        raise forbidden()
    return session


def _course_students(db, course_id: int) -> list[User]:
    ids = select(Enrollment.student_id).where(
        Enrollment.course_id == course_id, Enrollment.status == "active")
    return db.scalars(select(User).where(User.id.in_(ids)).order_by(User.full_name)).all()


@router.post("/sessions", response_model=SessionOut, status_code=201, dependencies=[staff])
def create_session(body: SessionCreateIn, user: CurrentUser, db: DbSession):
    course = db.get(Course, body.course_id)
    if course is None:
        raise not_found("Kurs")
    if user.role != "admin" and course.teacher_id != user.id:
        raise forbidden()
    session = LessonSession(
        course_id=body.course_id, topic_id=body.topic_id, room=body.room,
        late_after_min=body.late_after_min, qr_secret=secrets.token_hex(16),
        created_by=user.id,
    )
    db.add(session)
    db.commit()
    return session


@router.get("/courses/{course_id}/sessions", response_model=list[SessionOut], dependencies=[staff])
def list_sessions(course_id: int, user: CurrentUser, db: DbSession):
    course = db.get(Course, course_id)
    if course is None:
        raise not_found()
    if user.role != "admin" and course.teacher_id != user.id:
        raise forbidden()
    return db.scalars(select(LessonSession).where(LessonSession.course_id == course_id)
                      .order_by(LessonSession.starts_at.desc())).all()


@router.post("/sessions/{session_id}/open", response_model=SessionOut, dependencies=[staff])
def open_session(session_id: int, user: CurrentUser, db: DbSession):
    session = _session_for_teacher(db, session_id, user)
    session.attendance_open = True
    db.commit()
    return session


@router.post("/sessions/{session_id}/close", response_model=SessionOut, dependencies=[staff])
def close_session(session_id: int, user: CurrentUser, db: DbSession):
    session = _session_for_teacher(db, session_id, user)
    session.attendance_open = False
    db.commit()
    return session


@router.get("/sessions/{session_id}/qr.png", dependencies=[staff])
def session_qr(session_id: int, user: CurrentUser, db: DbSession):
    """Текущий QR (ротация каждые 15 сек). Фронтенд обновляет img каждые ~10 сек."""
    session = _session_for_teacher(db, session_id, user)
    token = qr.current_token(session.qr_secret)
    payload = f"{session.id}:{token}"
    return Response(qr.qr_png(payload), media_type="image/png",
                    headers={"Cache-Control": "no-store"})


@router.get("/sessions/{session_id}/live", response_model=LiveListOut, dependencies=[staff])
def live_list(session_id: int, user: CurrentUser, db: DbSession):
    session = _session_for_teacher(db, session_id, user)
    students = _course_students(db, session.course_id)
    marks = {a.student_id: a for a in db.scalars(
        select(Attendance).where(Attendance.session_id == session_id))}
    rows = []
    present = 0
    for s in students:
        mark = marks.get(s.id)
        if mark and mark.status in ("present", "late"):
            present += 1
        rows.append(AttendanceRow(
            student_id=s.id, student_name=s.full_name,
            status=mark.status if mark else None,
            method=mark.method if mark else None,
            marked_at=mark.marked_at if mark else None,
        ))
    return LiveListOut(session=SessionOut.model_validate(session), rows=rows,
                       present_count=present, total=len(students))


@router.post("/attendance/checkin", dependencies=[student_only])
def checkin(body: CheckinIn, user: CurrentUser, db: DbSession):
    session = db.get(LessonSession, body.session_id)
    if session is None:
        raise not_found("Dars")
    if not session.attendance_open:
        raise ApiError(409, "closed", "Yoʻqlama yopilgan", "Отметка закрыта")
    if not qr.verify_token(session.qr_secret, body.token):
        raise ApiError(400, "bad_qr", "QR eskirgan yoki notoʻgʻri", "QR устарел или неверен")
    # студент должен быть на курсе
    from app.modules.learning.service import is_enrolled
    if not is_enrolled(db, user.id, session.course_id):
        raise forbidden()

    existing = db.scalar(select(Attendance).where(
        Attendance.session_id == session.id, Attendance.student_id == user.id))
    if existing:
        return {"status": existing.status, "already": True}

    # опоздание по времени
    now = datetime.now(timezone.utc)
    starts = session.starts_at
    if starts.tzinfo is None:
        starts = starts.replace(tzinfo=timezone.utc)
    late = (now - starts).total_seconds() > session.late_after_min * 60
    status = "late" if late else "present"
    db.add(Attendance(session_id=session.id, student_id=user.id, status=status, method="qr"))
    award(db, user.id, session.course_id, "attendance", ref_id=session.id)
    db.commit()
    return {"status": status, "already": False}


@router.patch("/sessions/{session_id}/attendance", dependencies=[staff])
def manual_mark(session_id: int, body: ManualMarkIn, user: CurrentUser, db: DbSession):
    session = _session_for_teacher(db, session_id, user)
    if body.status not in ("present", "late", "absent", "excused"):
        raise ApiError(422, "bad_status", "Notoʻgʻri holat", "Неверный статус")
    mark = db.scalar(select(Attendance).where(
        Attendance.session_id == session_id, Attendance.student_id == body.student_id))
    old = mark.status if mark else None
    if mark:
        mark.status = body.status
        mark.method = "manual"
    else:
        db.add(Attendance(session_id=session_id, student_id=body.student_id,
                          status=body.status, method="manual"))
    # аудит ручной правки (план §4.5)
    db.add(AuditLog(actor_id=user.id, action="attendance_manual", entity="attendance",
                    entity_id=session_id,
                    payload=f"student={body.student_id} {old}->{body.status}"))
    db.commit()
    return {"ok": True}


@router.get("/courses/{course_id}/attendance.xlsx", dependencies=[staff])
def export_journal(course_id: int, user: CurrentUser, db: DbSession):
    from openpyxl import Workbook

    course = db.get(Course, course_id)
    if course is None:
        raise not_found()
    if user.role != "admin" and course.teacher_id != user.id:
        raise forbidden()
    sessions = db.scalars(select(LessonSession).where(LessonSession.course_id == course_id)
                          .order_by(LessonSession.starts_at)).all()
    students = _course_students(db, course_id)
    marks = {(a.session_id, a.student_id): a.status for a in db.scalars(
        select(Attendance).where(Attendance.session_id.in_([s.id for s in sessions])))}

    wb = Workbook()
    ws = wb.active
    ws.title = "Posещaemost"
    symbol = {"present": "+", "late": "L", "absent": "-", "excused": "У"}
    ws.append(["Talaba \\ Dars"] + [s.starts_at.strftime("%d.%m") for s in sessions])
    for student in students:
        row = [student.full_name]
        for session in sessions:
            row.append(symbol.get(marks.get((session.id, student.id)), ""))
        ws.append(row)

    buffer = io.BytesIO()
    wb.save(buffer)
    return Response(
        buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="attendance_{course_id}.xlsx"'},
    )
