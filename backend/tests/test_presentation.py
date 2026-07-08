"""M4: генерация слайдов из конспекта, иллюстрация слайда, сборка PPTX, шаблоны."""
import app.modules.content.presentation_service as pres_service
import app.modules.topics.service as topics_service
from app.ai.base import ImageModel, TextModel
from tests.conftest import login
from tests.test_topics_digest import FakeTextModel, _setup_course

# минимальный валидный 1x1 PNG
PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000d49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082"
)

FAKE_SLIDES = {
    "slides": [
        {"title_uz": "Kirish", "title_ru": "Введение", "bullets_uz": ["a"], "bullets_ru": ["а"],
         "notes_uz": "n", "notes_ru": "н", "image_prompt": ""},
        {"title_uz": "Yurak", "title_ru": "Сердце", "bullets_uz": ["4 kamera"], "bullets_ru": ["4 камеры"],
         "notes_uz": "n", "notes_ru": "н", "image_prompt": "human heart anatomy diagram"},
    ]
}


class SlidesModel(TextModel):
    def generate_json(self, system, user, schema):
        if "слайды" in system.lower() or "слайд" in user.lower():
            return FAKE_SLIDES, 200
        return FakeTextModel().generate_json(system, user, schema)


class FakeImageModel(ImageModel):
    def generate_image(self, prompt: str) -> bytes:
        return PNG_1X1


def _approved_topic(client, monkeypatch):
    monkeypatch.setattr(topics_service, "get_text_model", lambda: FakeTextModel())
    monkeypatch.setattr(pres_service, "get_text_model", lambda: SlidesModel())
    monkeypatch.setattr(pres_service, "get_image_model", lambda: FakeImageModel())
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


def test_presentation_full_flow(client, monkeypatch):
    teacher, topic_id = _approved_topic(client, monkeypatch)

    job = client.post(f"/api/v1/topics/{topic_id}/presentation/generate", headers=teacher).json()
    assert client.get(f"/api/v1/jobs/{job['job_id']}", headers=teacher).json()["status"] == "done"

    content = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()
    pres_id = content["presentation"]["id"]
    assert content["presentation"]["status"] == "review"

    pres = client.get(f"/api/v1/presentations/{pres_id}", headers=teacher).json()
    assert len(pres["slides_json"]) == 2
    assert pres["slides_json"][1]["image_status"] == "idle"

    # генерация иллюстрации второго слайда (у первого нет prompt)
    no_img = client.post(f"/api/v1/presentations/{pres_id}/slides/0/image", headers=teacher)
    assert no_img.status_code == 422  # нет image_prompt
    ok = client.post(f"/api/v1/presentations/{pres_id}/slides/1/image", headers=teacher)
    assert ok.status_code == 202
    pres = client.get(f"/api/v1/presentations/{pres_id}", headers=teacher).json()
    assert pres["slides_json"][1]["image_status"] == "done"
    assert pres["slides_json"][1]["image_url"]

    # скачивание PPTX (соберётся автоматически)
    dl = client.get(f"/api/v1/presentations/{pres_id}/download?lang=ru", headers=teacher)
    assert dl.status_code == 200
    assert dl.content[:2] == b"PK"  # PPTX = zip
    assert len(dl.content) > 1000

    # утверждение и публикация
    client.post(f"/api/v1/content/{pres_id}/approve", headers=teacher)
    assert client.post(f"/api/v1/content/{pres_id}/publish", headers=teacher).json()["status"] == "published"


def test_presentation_edit_resets_approval(client, monkeypatch):
    teacher, topic_id = _approved_topic(client, monkeypatch)
    job = client.post(f"/api/v1/topics/{topic_id}/presentation/generate", headers=teacher).json()
    client.get(f"/api/v1/jobs/{job['job_id']}", headers=teacher)
    pres_id = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()["presentation"]["id"]
    pres = client.get(f"/api/v1/presentations/{pres_id}", headers=teacher).json()
    client.post(f"/api/v1/content/{pres_id}/approve", headers=teacher)

    slides = pres["slides_json"]
    slides[0]["title_ru"] = "Изменённое"
    updated = client.put(f"/api/v1/presentations/{pres_id}", headers=teacher, json={"slides_json": slides})
    assert updated.json()["content"]["status"] == "review"
    assert updated.json()["pptx_stale"] is True


def test_template_crud_and_default(client, monkeypatch):
    admin = login(client, "admin")
    teacher = login(client, "teacher")
    t1 = client.post("/api/v1/presentation-templates", headers=admin,
                     json={"name": "MedUni", "primary_color": "0D9488", "is_default": True})
    assert t1.status_code == 201
    t2 = client.post("/api/v1/presentation-templates", headers=admin,
                     json={"name": "Second", "is_default": True})
    # у второго default → у первого сброшен
    templates = client.get("/api/v1/presentation-templates", headers=teacher).json()
    defaults = [t for t in templates if t["is_default"]]
    assert len(defaults) == 1 and defaults[0]["id"] == t2.json()["id"]

    # логотип
    logo = client.post(f"/api/v1/presentation-templates/{t1.json()['id']}/logo", headers=admin,
                       files={"file": ("logo.png", b"\x89PNG\r\n\x1a\n", "image/png")})
    assert logo.status_code == 200 and logo.json()["logo_url"]

    # преподаватель не может создавать шаблоны
    assert client.post("/api/v1/presentation-templates", headers=teacher,
                       json={"name": "X"}).status_code == 403
