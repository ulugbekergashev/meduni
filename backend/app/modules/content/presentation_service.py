"""Генерация слайдов, иллюстраций и сборка PPTX (M4).
Изображения генерируются по одному (бережём бесплатную квоту, ADR-0002)."""
from datetime import datetime, timezone

from sqlalchemy import select

from app.ai import get_image_model, get_text_model
from app.ai.prompts.slides import SLIDES_SCHEMA, SLIDES_SYSTEM, build_slides_prompt
from app.core import storage
from app.core.db import SessionLocal
from app.modules.content.models import ContentItem, Presentation, PresentationTemplate
from app.modules.content.pptx_render import render_pptx
from app.modules.topics.models import GenerationJob, Topic, TopicDigest
from app.modules.topics.service import get_topic_glossary


def _set_step(db, job: GenerationJob, step: str, status: str) -> None:
    steps = [s for s in job.steps_json if s["step"] != step]
    steps.append({"step": step, "status": status})
    job.steps_json = steps
    db.commit()


def run_slides_job(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.get(GenerationJob, job_id)
        if job is None:
            return
        job.status = "running"
        db.commit()
        try:
            topic = db.get(Topic, job.topic_id)
            digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic.id))

            _set_step(db, job, "generate", "running")
            model = get_text_model()
            glossary = get_topic_glossary(db, topic)
            data, tokens = model.generate_json(
                SLIDES_SYSTEM, build_slides_prompt(digest.digest_json, glossary), SLIDES_SCHEMA
            )
            job.tokens_used += tokens
            slides = data.get("slides", [])
            for s in slides:
                s["image_url"] = None
                s["image_status"] = "idle"  # idle / running / done / error
            _set_step(db, job, "generate", "done")

            _set_step(db, job, "save", "running")
            # заменяем прежнюю презентацию темы
            for item in db.scalars(select(ContentItem).where(
                ContentItem.topic_id == topic.id, ContentItem.kind == "presentation"
            )).all():
                pres = db.scalar(select(Presentation).where(Presentation.content_item_id == item.id))
                if pres:
                    if pres.pptx_url:
                        storage.delete(pres.pptx_url)
                    db.delete(pres)
                db.delete(item)
            db.flush()

            default_tpl = db.scalar(select(PresentationTemplate).where(PresentationTemplate.is_default == True))  # noqa: E712
            item = ContentItem(topic_id=topic.id, kind="presentation", status="review",
                               source_digest_version=digest.version)
            db.add(item)
            db.flush()
            db.add(Presentation(content_item_id=item.id, slides_json=slides,
                                template_id=default_tpl.id if default_tpl else None, pptx_stale=True))
            _set_step(db, job, "save", "done")

            job.status = "done"
        except Exception as e:
            job.status = "error"
            job.error = str(e)[:2000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def run_image_task(content_id: int, slide_index: int) -> None:
    db = SessionLocal()
    try:
        pres = db.scalar(select(Presentation).where(Presentation.content_item_id == content_id))
        if pres is None or slide_index >= len(pres.slides_json):
            return
        slides = list(pres.slides_json)
        slide = dict(slides[slide_index])
        prompt = slide.get("image_prompt") or ""
        if not prompt.strip():
            return
        try:
            model = get_image_model()
            image_bytes = model.generate_image(prompt)
            if slide.get("image_url"):
                storage.delete(slide["image_url"])
            slide["image_url"] = storage.save_bytes(
                f"topics/{pres.content_item_id}/slides", f"slide_{slide_index}.png", image_bytes
            )
            slide["image_status"] = "done"
        except Exception:
            slide["image_status"] = "error"
        slides[slide_index] = slide
        pres.slides_json = slides
        pres.pptx_stale = True
        db.commit()
    finally:
        db.close()


def build_pptx(content_id: int, lang: str = "ru") -> str:
    """Рендерит PPTX, сохраняет и возвращает pptx_url."""
    db = SessionLocal()
    try:
        pres = db.scalar(select(Presentation).where(Presentation.content_item_id == content_id))
        if pres is None:
            raise ValueError("Презентация не найдена")
        template = None
        if pres.template_id:
            tpl = db.get(PresentationTemplate, pres.template_id)
            if tpl:
                template = {
                    "primary_color": tpl.primary_color, "accent_color": tpl.accent_color,
                    "logo_url": tpl.logo_url,
                }
        pptx_bytes = render_pptx(pres.slides_json, template, lang)
        if pres.pptx_url:
            storage.delete(pres.pptx_url)
        pres.pptx_url = storage.save_bytes(f"topics/{content_id}/pptx", f"presentation_{lang}.pptx", pptx_bytes)
        pres.pptx_stale = False
        db.commit()
        return pres.pptx_url
    finally:
        db.close()
