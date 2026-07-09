"""M7: динамический QR + чек-ин, XP-начисление, стрики, бейджи, лидерборды."""
import app.modules.content.service as content_service
import app.modules.topics.service as topics_service
from app.modules.attendance import qr
from tests.conftest import login
from tests.test_learning import _bootstrap, _make_topic_with_quiz


def test_qr_token_rotation():
    secret = "abc123"
    token = qr.current_token(secret)
    assert qr.verify_token(secret, token) is True
    assert qr.verify_token(secret, "deadbeef0000") is False
    # QR PNG генерируется
    png = qr.qr_png(f"1:{token}")
    assert png[:4].hex() == "89504e47"


def test_attendance_checkin_and_xp(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student = login(client, "student")
    course_id = course["id"]

    # преподаватель создаёт и открывает сессию
    session = client.post("/api/v1/sessions", headers=teacher,
                          json={"course_id": course_id, "room": "101"}).json()
    assert client.post(f"/api/v1/sessions/{session['id']}/open", headers=teacher).json()["attendance_open"]

    # получаем секрет из БД для формирования валидного токена
    import app.modules.attendance.models as am
    from app.core.db import SessionLocal
    db = SessionLocal()
    from sqlalchemy import select
    secret = db.scalar(select(am.LessonSession).where(am.LessonSession.id == session["id"])).qr_secret
    db.close()
    token = qr.current_token(secret)

    # чек-ин студента
    r = client.post("/api/v1/attendance/checkin", headers=student,
                    json={"session_id": session["id"], "token": token})
    assert r.status_code == 200 and r.json()["status"] == "present"

    # повторный чек-ин — already
    r2 = client.post("/api/v1/attendance/checkin", headers=student,
                     json={"session_id": session["id"], "token": qr.current_token(secret)})
    assert r2.json()["already"] is True

    # неверный токен отклоняется
    r3 = client.post("/api/v1/attendance/checkin", headers=student,
                     json={"session_id": session["id"], "token": "000000000000"})
    assert r3.status_code == 400

    # XP начислен за посещение
    stats = client.get("/api/v1/me/stats", headers=student).json()
    assert stats["total_xp"] >= 10
    assert stats["current_streak_days"] == 1

    # live-список у преподавателя
    live = client.get(f"/api/v1/sessions/{session['id']}/live", headers=teacher).json()
    assert live["present_count"] == 1


def test_manual_mark_and_audit(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student_id = client.get("/api/v1/users?role=student", headers=admin).json()[0]["id"]
    session = client.post("/api/v1/sessions", headers=teacher,
                          json={"course_id": course["id"]}).json()
    r = client.patch(f"/api/v1/sessions/{session['id']}/attendance", headers=teacher,
                     json={"student_id": student_id, "status": "excused"})
    assert r.status_code == 200
    live = client.get(f"/api/v1/sessions/{session['id']}/live", headers=teacher).json()
    assert any(row["status"] == "excused" for row in live["rows"])
    # аудит записан
    from app.core.db import SessionLocal
    from sqlalchemy import select
    import app.modules.attendance.models as am
    db = SessionLocal()
    log = db.scalar(select(am.AuditLog).where(am.AuditLog.action == "attendance_manual"))
    db.close()
    assert log is not None


def test_xp_on_lesson_and_quiz(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student = login(client, "student")
    t1, quiz1 = _make_topic_with_quiz(client, teacher, course["id"], "Тема 1")

    # проходим тест на 100% → quiz_passed + quiz_perfect + lesson_completed
    start = client.post(f"/api/v1/me/learn/quizzes/{quiz1}/start", headers=student).json()
    answers = {str(q["id"]): 2 for q in start["questions"]}  # correct=2 в FAKE_QUIZ
    client.post(f"/api/v1/me/learn/attempts/{start['attempt_id']}/submit", headers=student,
                json={"answers": answers})
    # обновляем состояние курса (награда за завершение темы)
    client.get(f"/api/v1/me/learn/courses/{course['id']}", headers=student)

    stats = client.get("/api/v1/me/stats", headers=student).json()
    # quiz_passed(30) + quiz_perfect(20) + lesson_completed(50) = 100
    assert stats["total_xp"] >= 100

    # бейдж «Первая тема» выдан
    badges = client.get("/api/v1/me/badges", headers=student).json()
    first = next(b for b in badges if b["code"] == "first_lesson")
    assert first["earned"] is True


def test_leaderboard_top_and_me(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student = login(client, "student")
    t1, quiz1 = _make_topic_with_quiz(client, teacher, course["id"], "Тема 1")
    start = client.post(f"/api/v1/me/learn/quizzes/{quiz1}/start", headers=student).json()
    answers = {str(q["id"]): 2 for q in start["questions"]}
    client.post(f"/api/v1/me/learn/attempts/{start['attempt_id']}/submit", headers=student,
                json={"answers": answers})

    lb = client.get("/api/v1/leaderboards?scope=group&period=week", headers=student).json()
    assert lb["me"] is not None
    assert lb["me"]["xp"] >= 30
    assert lb["total"] >= 1


def test_student_cannot_create_session(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    student = login(client, "student")
    assert client.post("/api/v1/sessions", headers=student,
                       json={"course_id": course["id"]}).status_code == 403


def test_admin_xp_config(client, monkeypatch):
    _bootstrap(client, monkeypatch)
    admin = login(client, "admin")
    cfg = client.get("/api/v1/admin/xp-config", headers=admin).json()
    assert cfg["lesson_completed"] == 50
    updated = client.put("/api/v1/admin/xp-config", headers=admin,
                         json={"values_json": {"lesson_completed": 100}}).json()
    assert updated["lesson_completed"] == 100
