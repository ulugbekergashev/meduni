"""M5: генерация сценария из презентации, state-машина утверждения.
Полная сборка MP4 (TTS+ffmpeg) проверяется в реальном e2e (сеть+ffmpeg)."""
import app.modules.content.presentation_service as pres_service
import app.modules.content.video_service as video_service
import app.modules.topics.service as topics_service
from app.ai.base import TextModel
from tests.conftest import login
from tests.test_presentation import FAKE_SLIDES, FakeImageModel, SlidesModel
from tests.test_topics_digest import FakeTextModel, _setup_course

FAKE_SCRIPT = {"script": [
    {"slide_index": 0, "text": "Добро пожаловать на урок по анатомии сердца."},
    {"slide_index": 1, "text": "Сердце состоит из четырёх камер."},
]}


class ScriptModel(TextModel):
    def generate_json(self, system, user, schema):
        if "озвучк" in system.lower() or "диктора" in system.lower():
            return FAKE_SCRIPT, 150
        return SlidesModel().generate_json(system, user, schema)


def _topic_with_presentation(client, monkeypatch):
    monkeypatch.setattr(topics_service, "get_text_model", lambda: FakeTextModel())
    monkeypatch.setattr(pres_service, "get_text_model", lambda: SlidesModel())
    monkeypatch.setattr(pres_service, "get_image_model", lambda: FakeImageModel())
    monkeypatch.setattr(video_service, "get_text_model", lambda: ScriptModel())
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


def test_video_script_requires_presentation(client, monkeypatch):
    teacher, topic_id = _topic_with_presentation(client, monkeypatch)
    # презентации ещё нет → 409
    r = client.post(f"/api/v1/topics/{topic_id}/video/generate", headers=teacher, json={"language": "ru"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "no_presentation"


def test_video_script_flow_and_edit_resets(client, monkeypatch):
    teacher, topic_id = _topic_with_presentation(client, monkeypatch)
    # создаём презентацию
    pj = client.post(f"/api/v1/topics/{topic_id}/presentation/generate", headers=teacher).json()
    assert client.get(f"/api/v1/jobs/{pj['job_id']}", headers=teacher).json()["status"] == "done"

    # сценарий
    vj = client.post(f"/api/v1/topics/{topic_id}/video/generate", headers=teacher,
                     json={"language": "ru"}).json()
    assert client.get(f"/api/v1/jobs/{vj['job_id']}", headers=teacher).json()["status"] == "done"

    content = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()
    video_id = content["video"]["id"]
    assert content["video"]["status"] == "review"

    video = client.get(f"/api/v1/videos/{video_id}", headers=teacher).json()
    assert video["language"] == "ru"
    assert len(video["script_json"]) == 2
    assert video["voice_id"] == "ru-RU-SvetlanaNeural"
    assert video["video_stale"] is True

    # правка сценария после утверждения → снова review + video_stale
    client.post(f"/api/v1/content/{video_id}/approve", headers=teacher)
    new_script = [{"slide_index": 0, "text": "Изменённый текст."},
                  {"slide_index": 1, "text": "Второй слайд."}]
    updated = client.put(f"/api/v1/videos/{video_id}", headers=teacher, json={"script_json": new_script})
    assert updated.json()["content"]["status"] == "review"
    assert updated.json()["video_stale"] is True


def test_video_uz_voice(client, monkeypatch):
    teacher, topic_id = _topic_with_presentation(client, monkeypatch)
    pj = client.post(f"/api/v1/topics/{topic_id}/presentation/generate", headers=teacher).json()
    client.get(f"/api/v1/jobs/{pj['job_id']}", headers=teacher)
    vj = client.post(f"/api/v1/topics/{topic_id}/video/generate", headers=teacher,
                     json={"language": "uz"}).json()
    client.get(f"/api/v1/jobs/{vj['job_id']}", headers=teacher)
    video_id = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()["video"]["id"]
    video = client.get(f"/api/v1/videos/{video_id}", headers=teacher).json()
    assert video["voice_id"] == "uz-UZ-MadinaNeural"


def test_student_cannot_access_video(client, monkeypatch):
    teacher, topic_id = _topic_with_presentation(client, monkeypatch)
    pj = client.post(f"/api/v1/topics/{topic_id}/presentation/generate", headers=teacher).json()
    client.get(f"/api/v1/jobs/{pj['job_id']}", headers=teacher)
    vj = client.post(f"/api/v1/topics/{topic_id}/video/generate", headers=teacher,
                     json={"language": "ru"}).json()
    client.get(f"/api/v1/jobs/{vj['job_id']}", headers=teacher)
    video_id = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()["video"]["id"]
    student = login(client, "student")
    assert client.get(f"/api/v1/videos/{video_id}", headers=student).status_code == 403
