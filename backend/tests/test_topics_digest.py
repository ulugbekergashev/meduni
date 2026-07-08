"""M2: темы → материал → парсинг → генерация конспекта (mock LLM) → правка → утверждение."""
import app.modules.topics.service as topics_service
from app.ai.base import TextModel
from tests.conftest import login

FAKE_DIGEST = {
    "learning_objectives": [{"uz": "Anatomiyani bilish", "ru": "Знать анатомию"}],
    "key_concepts": [{"title_uz": "Yurak", "title_ru": "Сердце",
                      "body_uz": "Yurak — muskul organ", "body_ru": "Сердце — мышечный орган"}],
    "terms": [{"uz": "yurak", "ru": "сердце", "lat": "cor"}],
    "key_facts": [{"uz": "4 kamera", "ru": "4 камеры"}],
    "illustration_ideas": [{"uz": "Yurak sxemasi", "ru": "Схема сердца"}],
}


class FakeTextModel(TextModel):
    def generate_json(self, system, user, schema):
        assert "МАТЕРИАЛ" in user
        return FAKE_DIGEST, 1234


def _setup_course(client, admin_headers) -> int:
    faculty = client.post("/api/v1/faculties", headers=admin_headers,
                          json={"name_uz": "F", "name_ru": "Ф"}).json()
    department = client.post("/api/v1/departments", headers=admin_headers,
                             json={"faculty_id": faculty["id"], "name_uz": "K", "name_ru": "К"}).json()
    subject = client.post("/api/v1/subjects", headers=admin_headers,
                          json={"department_id": department["id"], "name_uz": "Fan", "name_ru": "Предмет"}).json()
    teacher_id = [u for u in client.get("/api/v1/users?role=teacher", headers=admin_headers).json()][0]["id"]
    course = client.post("/api/v1/courses", headers=admin_headers,
                         json={"subject_id": subject["id"], "teacher_id": teacher_id,
                               "semester": 1, "academic_year": "2026/2027", "group_ids": []}).json()
    client.post("/api/v1/glossary", headers=admin_headers,
                json={"department_id": department["id"], "term_uz": "yurak",
                      "term_ru": "сердце", "term_lat": "cor"})
    return course["id"]


def test_full_digest_flow(client, monkeypatch):
    monkeypatch.setattr(topics_service, "get_text_model", lambda: FakeTextModel())
    admin = login(client, "admin")
    teacher = login(client, "teacher")
    course_id = _setup_course(client, admin)

    # тема
    topic = client.post(f"/api/v1/courses/{course_id}/topics", headers=teacher,
                        json={"title_uz": "Yurak anatomiyasi", "title_ru": "Анатомия сердца"})
    assert topic.status_code == 201
    topic_id = topic.json()["id"]

    # генерация без материалов запрещена
    denied = client.post(f"/api/v1/topics/{topic_id}/digest/generate", headers=teacher)
    assert denied.status_code == 409

    # материал (txt) → парсинг синхронный
    upload = client.post(
        f"/api/v1/topics/{topic_id}/materials", headers=teacher,
        files={"file": ("lecture.txt", "Сердце — полый мышечный орган с четырьмя камерами.".encode(), "text/plain")},
    )
    assert upload.status_code == 201, upload.text
    assert upload.json()["parse_status"] in ("pending", "done")

    detail = client.get(f"/api/v1/topics/{topic_id}", headers=teacher).json()
    assert detail["materials"][0]["parse_status"] == "done"

    # генерация конспекта (mock LLM, синхронно)
    job = client.post(f"/api/v1/topics/{topic_id}/digest/generate", headers=teacher)
    assert job.status_code == 202, job.text
    job_data = client.get(f"/api/v1/jobs/{job.json()['id']}", headers=teacher).json()
    assert job_data["status"] == "done", job_data
    assert job_data["tokens_used"] == 1234

    detail = client.get(f"/api/v1/topics/{topic_id}", headers=teacher).json()
    assert detail["digest"]["digest_json"]["terms"][0]["lat"] == "cor"
    assert detail["digest"]["approved_by_teacher"] is False

    # правка и утверждение
    edited = dict(FAKE_DIGEST, key_facts=[{"uz": "Toʻrt kamera", "ru": "Четыре камеры"}])
    updated = client.put(f"/api/v1/topics/{topic_id}/digest", headers=teacher,
                         json={"digest_json": edited})
    assert updated.status_code == 200
    approved = client.post(f"/api/v1/topics/{topic_id}/digest/approve", headers=teacher)
    assert approved.json()["approved_by_teacher"] is True

    # правка после утверждения снимает утверждение
    client.put(f"/api/v1/topics/{topic_id}/digest", headers=teacher, json={"digest_json": edited})
    detail = client.get(f"/api/v1/topics/{topic_id}", headers=teacher).json()
    assert detail["digest"]["approved_by_teacher"] is False


def test_rbac_student_and_foreign_teacher(client, monkeypatch):
    monkeypatch.setattr(topics_service, "get_text_model", lambda: FakeTextModel())
    admin = login(client, "admin")
    teacher = login(client, "teacher")
    student = login(client, "student")
    course_id = _setup_course(client, admin)

    topic_id = client.post(f"/api/v1/courses/{course_id}/topics", headers=teacher,
                           json={"title_uz": "T", "title_ru": "Т"}).json()["id"]

    # студент не видит конструктор темы
    assert client.get(f"/api/v1/topics/{topic_id}", headers=student).status_code == 403
    # студент не может управлять глоссарием
    assert client.post("/api/v1/glossary", headers=student,
                       json={"department_id": 1, "term_uz": "x", "term_ru": "x"}).status_code == 403

    # чужой преподаватель не имеет доступа к курсу
    other = client.post("/api/v1/users", headers=admin, json={
        "role": "teacher", "full_name": "Other Teacher",
        "email": "other@test.uz", "password": "pass1234"})
    assert other.status_code == 201
    other_headers = login(client, "other")
    assert client.get(f"/api/v1/topics/{topic_id}", headers=other_headers).status_code == 403


def test_unsupported_file_rejected(client):
    admin = login(client, "admin")
    teacher = login(client, "teacher")
    course_id = _setup_course(client, admin)
    topic_id = client.post(f"/api/v1/courses/{course_id}/topics", headers=teacher,
                           json={"title_uz": "T", "title_ru": "Т"}).json()["id"]
    response = client.post(
        f"/api/v1/topics/{topic_id}/materials", headers=teacher,
        files={"file": ("virus.exe", b"MZ", "application/octet-stream")},
    )
    assert response.status_code == 422
