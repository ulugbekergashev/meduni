"""M3: генерация теста/кейса из утверждённого конспекта, фактчек, approve/publish, экспорт."""
import app.modules.content.service as content_service
import app.modules.topics.service as topics_service
from app.ai.base import TextModel
from tests.conftest import login
from tests.test_topics_digest import FAKE_DIGEST, FakeTextModel, _setup_course

FAKE_QUIZ = {
    "questions": [
        {
            "question_uz": "Yurakda nechta kamera bor?",
            "question_ru": "Сколько камер в сердце?",
            "options": [{"uz": "2", "ru": "2"}, {"uz": "3", "ru": "3"},
                        {"uz": "4", "ru": "4"}, {"uz": "5", "ru": "5"}],
            "correct_index": 2,
            "explanations": [{"uz": "Notoʻgʻri", "ru": "Неверно"}, {"uz": "Notoʻgʻri", "ru": "Неверно"},
                             {"uz": "Toʻgʻri", "ru": "Верно"}, {"uz": "Notoʻgʻri", "ru": "Неверно"}],
            "difficulty": "recall",
            "source_fragment": "4 камеры",
        },
    ]
}

FAKE_CASE = {
    "complaints": {"uz": "Koʻkrak ogʻrigʻi", "ru": "Боль в груди"},
    "anamnesis": {"uz": "...", "ru": "..."},
    "objective": {"uz": "...", "ru": "АД 120/80"},
    "labs": {"uz": "...", "ru": "Норма"},
    "questions": [{"uz": "Tashxis?", "ru": "Диагноз?"}],
    "reference_analysis": {"uz": "...", "ru": "Разбор"},
}

FAKE_FACTCHECK = {"results": [{"index": 0, "grounded": True, "note": ""}]}


class QuizCaseModel(TextModel):
    """Возвращает нужный ответ по маркеру в system-промпте."""
    def generate_json(self, system, user, schema):
        if "тестовые вопросы" in system or "тестовых" in user:
            return FAKE_QUIZ, 100
        if "клинический кейс" in system:
            return FAKE_CASE, 100
        if "фактчекер" in system:
            return FAKE_FACTCHECK, 50
        return FAKE_DIGEST, 100


def _approved_topic(client, monkeypatch):
    """Создаёт тему с утверждённым конспектом, возвращает (headers, topic_id)."""
    monkeypatch.setattr(topics_service, "get_text_model", lambda: FakeTextModel())
    monkeypatch.setattr(content_service, "get_text_model", lambda: QuizCaseModel())
    admin = login(client, "admin")
    teacher = login(client, "teacher")
    course_id = _setup_course(client, admin)
    topic_id = client.post(f"/api/v1/courses/{course_id}/topics", headers=teacher,
                           json={"title_uz": "T", "title_ru": "Т"}).json()["id"]
    client.post(f"/api/v1/topics/{topic_id}/materials", headers=teacher,
                files={"file": ("m.txt", "Сердце имеет 4 камеры.".encode(), "text/plain")})
    job = client.post(f"/api/v1/topics/{topic_id}/digest/generate", headers=teacher).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=teacher).json()["status"] == "done"
    client.post(f"/api/v1/topics/{topic_id}/digest/approve", headers=teacher)
    return teacher, topic_id


def test_quiz_generation_blocked_without_approved_digest(client, monkeypatch):
    monkeypatch.setattr(topics_service, "get_text_model", lambda: FakeTextModel())
    admin = login(client, "admin")
    teacher = login(client, "teacher")
    course_id = _setup_course(client, admin)
    topic_id = client.post(f"/api/v1/courses/{course_id}/topics", headers=teacher,
                           json={"title_uz": "T", "title_ru": "Т"}).json()["id"]
    # конспекта нет → 409
    r = client.post(f"/api/v1/topics/{topic_id}/quiz/generate", headers=teacher, json={"count": 3})
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "digest_not_approved"


def test_quiz_full_workflow(client, monkeypatch):
    teacher, topic_id = _approved_topic(client, monkeypatch)

    # генерация теста
    job = client.post(f"/api/v1/topics/{topic_id}/quiz/generate", headers=teacher,
                      json={"count": 1}).json()
    assert client.get(f"/api/v1/jobs/{job['job_id']}", headers=teacher).json()["status"] == "done"

    content = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()
    quiz_id = content["quiz"]["id"]
    assert content["quiz"]["status"] == "review"
    assert content["quiz"]["reviewed"] is False

    # нельзя утвердить, пока не открыт в редакторе
    denied = client.post(f"/api/v1/content/{quiz_id}/approve", headers=teacher)
    assert denied.status_code == 409 and denied.json()["detail"]["code"] == "not_reviewed"

    # открытие = reviewed
    quiz = client.get(f"/api/v1/quizzes/{quiz_id}", headers=teacher).json()
    assert quiz["questions"][0]["correct_index"] == 2
    readiness = client.get(f"/api/v1/content/{quiz_id}/readiness", headers=teacher).json()
    assert readiness["reviewed"] is True and readiness["can_approve"] is True

    # утверждение и публикация
    assert client.post(f"/api/v1/content/{quiz_id}/approve", headers=teacher).json()["status"] == "approved"
    assert client.post(f"/api/v1/content/{quiz_id}/publish", headers=teacher).json()["status"] == "published"


def test_quiz_edit_resets_approval(client, monkeypatch):
    teacher, topic_id = _approved_topic(client, monkeypatch)
    job = client.post(f"/api/v1/topics/{topic_id}/quiz/generate", headers=teacher, json={"count": 1}).json()
    content = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()
    quiz_id = content["quiz"]["id"]
    quiz = client.get(f"/api/v1/quizzes/{quiz_id}", headers=teacher).json()
    client.post(f"/api/v1/content/{quiz_id}/approve", headers=teacher)

    # правка утверждённого теста → снова review
    body = {"pass_threshold": 80, "max_attempts": 2, "questions": [{
        "question_uz": q["question_uz"], "question_ru": q["question_ru"],
        "options_json": q["options_json"], "correct_index": q["correct_index"],
        "explanations_json": q["explanations_json"], "difficulty": q["difficulty"],
    } for q in quiz["questions"]]}
    updated = client.put(f"/api/v1/quizzes/{quiz_id}", headers=teacher, json=body)
    assert updated.json()["content"]["status"] == "review"
    assert updated.json()["content"]["edited_by_teacher"] is True


def test_quiz_export_formats(client, monkeypatch):
    teacher, topic_id = _approved_topic(client, monkeypatch)
    client.post(f"/api/v1/topics/{topic_id}/quiz/generate", headers=teacher, json={"count": 1})
    quiz_id = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()["quiz"]["id"]

    xml = client.get(f"/api/v1/quizzes/{quiz_id}/export?format=moodle_xml", headers=teacher)
    assert xml.status_code == 200 and "<quiz>" in xml.text and "multichoice" in xml.text
    gift = client.get(f"/api/v1/quizzes/{quiz_id}/export?format=gift", headers=teacher)
    assert gift.status_code == 200 and "::Q1::" in gift.text and "=" in gift.text
    pdf = client.get(f"/api/v1/quizzes/{quiz_id}/export?format=pdf", headers=teacher)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_case_generation_and_publish(client, monkeypatch):
    teacher, topic_id = _approved_topic(client, monkeypatch)
    job = client.post(f"/api/v1/topics/{topic_id}/case/generate", headers=teacher,
                      json={"fmt": "short"}).json()
    assert client.get(f"/api/v1/jobs/{job['job_id']}", headers=teacher).json()["status"] == "done"
    case_id = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()["case"]["id"]
    case = client.get(f"/api/v1/cases/{case_id}", headers=teacher).json()
    assert case["case_json"]["complaints"]["ru"] == "Боль в груди"
    client.post(f"/api/v1/content/{case_id}/approve", headers=teacher)
    assert client.post(f"/api/v1/content/{case_id}/publish", headers=teacher).json()["status"] == "published"


def test_student_cannot_access_content(client, monkeypatch):
    teacher, topic_id = _approved_topic(client, monkeypatch)
    client.post(f"/api/v1/topics/{topic_id}/quiz/generate", headers=teacher, json={"count": 1})
    quiz_id = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()["quiz"]["id"]
    student = login(client, "student")
    assert client.get(f"/api/v1/quizzes/{quiz_id}", headers=student).status_code == 403
    assert client.post(f"/api/v1/topics/{topic_id}/quiz/generate", headers=student, json={"count": 1}).status_code == 403
