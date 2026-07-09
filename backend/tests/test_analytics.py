"""M8: статистика вуза, расход AI, квоты (блокировка генерации), heatmap, задачи, аудит."""
import app.modules.content.service as content_service
import app.modules.topics.service as topics_service
from tests.conftest import login
from tests.test_learning import _bootstrap, _make_topic_with_quiz


def test_admin_stats(client, monkeypatch):
    _bootstrap(client, monkeypatch)
    admin = login(client, "admin")
    stats = client.get("/api/v1/admin/stats", headers=admin).json()
    assert "students" in stats and "teachers" in stats
    assert stats["teachers"] >= 1


def test_ai_usage_and_quota_block(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")

    # ставим квоту 1 токен на кафедру
    dep_id = client.get("/api/v1/departments", headers=admin).json()[0]["id"]
    client.put("/api/v1/admin/quotas", headers=admin,
               json={"department_id": dep_id, "monthly_tokens": 1})

    # создаём тему с материалом
    topic_id = client.post(f"/api/v1/courses/{course['id']}/topics", headers=teacher,
                           json={"title_uz": "T", "title_ru": "Т"}).json()["id"]
    client.post(f"/api/v1/topics/{topic_id}/materials", headers=teacher,
                files={"file": ("m.txt", "Сердце.".encode(), "text/plain")})
    # первая генерация проходит (usage=0 < 1)
    j = client.post(f"/api/v1/topics/{topic_id}/digest/generate", headers=teacher)
    assert j.status_code == 202
    assert client.get(f"/api/v1/jobs/{j.json()['id']}", headers=teacher).json()["status"] == "done"
    client.post(f"/api/v1/topics/{topic_id}/digest/approve", headers=teacher)

    # usage теперь > квоты (FakeTextModel вернул 100 токенов) → следующая блокируется
    usage = client.get("/api/v1/admin/ai-usage", headers=admin).json()
    dep_row = next(r for r in usage if r["department_id"] == dep_id)
    assert dep_row["tokens"] >= 100
    assert dep_row["quota"] == 1

    # конспект утверждён, но квота исчерпана → 429 (не 409)
    j2 = client.post(f"/api/v1/topics/{topic_id}/quiz/generate", headers=teacher, json={"count": 1})
    assert j2.status_code == 429 and j2.json()["detail"]["code"] == "quota_exceeded"


def test_teacher_tasks_and_heatmap(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student = login(client, "student")
    t1, quiz1 = _make_topic_with_quiz(client, teacher, course["id"], "Тема 1")

    # задачи преподавателя (после публикации теста content_in_review = 0)
    tasks = client.get("/api/v1/teach/tasks", headers=teacher).json()
    assert "pending_cases" in tasks and "content_in_review" in tasks

    # студент проходит → heatmap показывает completed
    start = client.post(f"/api/v1/me/learn/quizzes/{quiz1}/start", headers=student).json()
    client.post(f"/api/v1/me/learn/attempts/{start['attempt_id']}/submit", headers=student,
                json={"answers": {str(q["id"]): 2 for q in start["questions"]}})
    client.get(f"/api/v1/me/learn/courses/{course['id']}", headers=student)  # пересчёт прогресса

    hm = client.get(f"/api/v1/teach/courses/{course['id']}/heatmap", headers=teacher).json()
    assert len(hm["topics"]) >= 1
    assert len(hm["rows"]) >= 1
    assert "completed" in hm["rows"][0]["cells"]


def test_audit_visible_to_admin(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student_id = client.get("/api/v1/users?role=student", headers=admin).json()[0]["id"]
    session = client.post("/api/v1/sessions", headers=teacher, json={"course_id": course["id"]}).json()
    client.patch(f"/api/v1/sessions/{session['id']}/attendance", headers=teacher,
                 json={"student_id": student_id, "status": "excused"})

    audit = client.get("/api/v1/admin/audit", headers=admin).json()
    assert any(a["action"] == "attendance_manual" for a in audit)


def test_analytics_rbac(client, monkeypatch):
    _bootstrap(client, monkeypatch)
    student = login(client, "student")
    teacher = login(client, "teacher")
    assert client.get("/api/v1/admin/stats", headers=student).status_code == 403
    assert client.get("/api/v1/admin/stats", headers=teacher).status_code == 403
    assert client.get("/api/v1/admin/audit", headers=teacher).status_code == 403
