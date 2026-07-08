"""Воркеры M2: парсинг материала и генерация конспекта.
Каждый воркер открывает собственную сессию БД — совместимо с переездом на Celery."""
from datetime import datetime, timezone

from sqlalchemy import select

from app.ai import get_text_model
from app.ai.prompts.digest import DIGEST_SCHEMA, DIGEST_SYSTEM, build_digest_user_prompt
from app.core import storage
from app.core.config import settings
from app.core.db import SessionLocal
from app.modules.courses.models import Course
from app.modules.org.models import Subject
from app.modules.topics.models import (
    GenerationJob, GlossaryTerm, SourceMaterial, Topic, TopicDigest,
)
from app.modules.topics.parsing import extract_text


def run_parse_material(material_id: int) -> None:
    db = SessionLocal()
    try:
        material = db.get(SourceMaterial, material_id)
        if material is None:
            return
        material.parse_status = "running"
        db.commit()
        try:
            data = storage.full_path(material.file_url).read_bytes()
            text = extract_text(data, material.file_type).strip()
            if not text:
                raise ValueError("Файл не содержит извлекаемого текста (скан? OCR будет позже)")
            material.parsed_text_url = storage.save_text(
                f"topics/{material.topic_id}/parsed", f"{material.id}.txt", text
            )
            material.parse_status = "done"
            material.parse_error = None
        except Exception as e:
            material.parse_status = "error"
            material.parse_error = str(e)[:1000]
        db.commit()
    finally:
        db.close()


def _set_step(db, job: GenerationJob, step: str, status: str) -> None:
    steps = [s for s in job.steps_json if s["step"] != step]
    steps.append({"step": step, "status": status})
    job.steps_json = steps
    db.commit()


def collect_material_text(db, topic_id: int) -> str:
    materials = db.scalars(
        select(SourceMaterial).where(
            SourceMaterial.topic_id == topic_id, SourceMaterial.parse_status == "done"
        )
    ).all()
    chunks = [storage.read_text(m.parsed_text_url) for m in materials if m.parsed_text_url]
    return "\n\n---\n\n".join(chunks)[: settings.max_material_chars]


def get_topic_glossary(db, topic: Topic) -> list[dict]:
    course = db.get(Course, topic.course_id)
    subject = db.get(Subject, course.subject_id) if course else None
    if subject is None:
        return []
    terms = db.scalars(
        select(GlossaryTerm).where(GlossaryTerm.department_id == subject.department_id)
    ).all()
    return [{"term_uz": t.term_uz, "term_ru": t.term_ru, "term_lat": t.term_lat} for t in terms]


def run_digest_job(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.get(GenerationJob, job_id)
        if job is None:
            return
        job.status = "running"
        db.commit()
        try:
            topic = db.get(Topic, job.topic_id)

            _set_step(db, job, "collect", "running")
            material_text = collect_material_text(db, topic.id)
            if not material_text:
                raise ValueError("Нет распарсенных материалов по теме")
            glossary = get_topic_glossary(db, topic)
            _set_step(db, job, "collect", "done")

            _set_step(db, job, "llm", "running")
            model = get_text_model()
            user_prompt = build_digest_user_prompt(
                f"{topic.title_ru} / {topic.title_uz}", material_text, glossary
            )
            digest_data, tokens = model.generate_json(DIGEST_SYSTEM, user_prompt, DIGEST_SCHEMA)
            job.tokens_used = tokens
            _set_step(db, job, "llm", "done")

            _set_step(db, job, "save", "running")
            digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic.id))
            if digest is None:
                digest = TopicDigest(topic_id=topic.id, digest_json=digest_data, version=1)
                db.add(digest)
            else:
                digest.digest_json = digest_data
                digest.version += 1
                digest.approved_by_teacher = False
                digest.approved_at = None
            _set_step(db, job, "save", "done")

            job.status = "done"
        except Exception as e:
            job.status = "error"
            job.error = str(e)[:2000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def fail_stale_jobs() -> None:
    """При старте приложения: running-задачи из прошлого процесса — в error (ADR-0003)."""
    db = SessionLocal()
    try:
        stale = db.scalars(
            select(GenerationJob).where(GenerationJob.status.in_(("queued", "running")))
        ).all()
        for job in stale:
            job.status = "error"
            job.error = "Прервано перезапуском сервера"
        db.commit()
    finally:
        db.close()
