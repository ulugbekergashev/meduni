from pathlib import Path

from fastapi import APIRouter, UploadFile
from sqlalchemy import func, select

from app.core import jobs, storage
from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.errors import ApiError, forbidden, not_found
from app.modules.courses.models import Course
from app.modules.topics import service
from app.modules.topics.models import (
    GenerationJob, GlossaryTerm, SourceMaterial, Topic, TopicDigest,
)
from app.modules.topics.parsing import SUPPORTED
from app.modules.topics.schemas import (
    DigestIn, DigestOut, GlossaryIn, GlossaryOut, JobOut, MaterialOut,
    ReorderIn, TopicDetailOut, TopicIn, TopicOut,
)

router = APIRouter(tags=["topics"])
staff_only = require_roles("admin", "teacher")


def _course_for_write(db: DbSession, course_id: int, user) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise not_found("Kurs")
    if user.role != "admin" and course.teacher_id != user.id:
        raise forbidden()
    return course


def _topic_for_write(db: DbSession, topic_id: int, user) -> Topic:
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise not_found("Mavzu")
    _course_for_write(db, topic.course_id, user)
    return topic


# --- Темы -----------------------------------------------------------------


@router.get("/courses/{course_id}/topics", response_model=list[TopicOut],
            dependencies=[staff_only])
def list_topics(course_id: int, user: CurrentUser, db: DbSession):
    _course_for_write(db, course_id, user)
    return db.scalars(
        select(Topic).where(Topic.course_id == course_id).order_by(Topic.order_index, Topic.id)
    ).all()


@router.post("/courses/{course_id}/topics", response_model=TopicOut, status_code=201,
             dependencies=[staff_only])
def create_topic(course_id: int, body: TopicIn, user: CurrentUser, db: DbSession):
    _course_for_write(db, course_id, user)
    max_order = db.scalar(
        select(func.max(Topic.order_index)).where(Topic.course_id == course_id)
    ) or 0
    topic = Topic(course_id=course_id, title_uz=body.title_uz, title_ru=body.title_ru,
                  order_index=max_order + 1)
    db.add(topic)
    db.commit()
    return topic


@router.patch("/topics/reorder", dependencies=[staff_only])
def reorder_topics(body: ReorderIn, user: CurrentUser, db: DbSession):
    _course_for_write(db, body.course_id, user)
    topics = {
        t.id: t for t in db.scalars(select(Topic).where(Topic.course_id == body.course_id))
    }
    for index, topic_id in enumerate(body.topic_ids, start=1):
        if topic_id in topics:
            topics[topic_id].order_index = index
    db.commit()
    return {"ok": True}


@router.get("/topics/{topic_id}", response_model=TopicDetailOut, dependencies=[staff_only])
def topic_detail(topic_id: int, user: CurrentUser, db: DbSession):
    topic = _topic_for_write(db, topic_id, user)
    materials = db.scalars(
        select(SourceMaterial).where(SourceMaterial.topic_id == topic_id).order_by(SourceMaterial.id)
    ).all()
    digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic_id))
    active_job = db.scalar(
        select(GenerationJob)
        .where(GenerationJob.topic_id == topic_id, GenerationJob.kind == "digest")
        .order_by(GenerationJob.id.desc())
        .limit(1)
    )
    return TopicDetailOut(
        topic=TopicOut.model_validate(topic),
        materials=[MaterialOut.model_validate(m) for m in materials],
        digest=DigestOut.model_validate(digest) if digest else None,
        active_job=JobOut.model_validate(active_job) if active_job else None,
    )


@router.put("/topics/{topic_id}", response_model=TopicOut, dependencies=[staff_only])
def update_topic(topic_id: int, body: TopicIn, user: CurrentUser, db: DbSession):
    topic = _topic_for_write(db, topic_id, user)
    topic.title_uz, topic.title_ru = body.title_uz, body.title_ru
    db.commit()
    return topic


@router.post("/topics/{topic_id}/publish", response_model=TopicOut, dependencies=[staff_only])
def publish_topic(topic_id: int, user: CurrentUser, db: DbSession):
    """Открывает тему студентам. Публиковать можно, если есть хотя бы один
    опубликованный элемент контента (иначе урок пустой)."""
    topic = _topic_for_write(db, topic_id, user)
    from app.modules.content.models import ContentItem

    has_published = db.scalar(select(ContentItem).where(
        ContentItem.topic_id == topic_id, ContentItem.status == "published"))
    if not has_published:
        raise ApiError(409, "no_published_content",
                       "Avval kamida bitta kontentni chop eting",
                       "Сначала опубликуйте хотя бы один элемент контента")
    topic.status = "published"
    db.commit()
    return topic


@router.post("/topics/{topic_id}/unpublish", response_model=TopicOut, dependencies=[staff_only])
def unpublish_topic(topic_id: int, user: CurrentUser, db: DbSession):
    topic = _topic_for_write(db, topic_id, user)
    topic.status = "draft"
    db.commit()
    return topic


@router.delete("/topics/{topic_id}", dependencies=[staff_only])
def delete_topic(topic_id: int, user: CurrentUser, db: DbSession):
    topic = _topic_for_write(db, topic_id, user)
    for material in db.scalars(select(SourceMaterial).where(SourceMaterial.topic_id == topic_id)):
        storage.delete(material.file_url)
        if material.parsed_text_url:
            storage.delete(material.parsed_text_url)
        db.delete(material)
    for job in db.scalars(select(GenerationJob).where(GenerationJob.topic_id == topic_id)):
        db.delete(job)
    digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic_id))
    if digest:
        db.delete(digest)
    db.delete(topic)
    db.commit()
    return {"ok": True}


# --- Материалы ---------------------------------------------------------------


@router.post("/topics/{topic_id}/materials", response_model=MaterialOut, status_code=201,
             dependencies=[staff_only])
async def upload_material(topic_id: int, file: UploadFile, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)
    file_type = Path(file.filename or "").suffix.lstrip(".").lower()
    if file_type not in SUPPORTED:
        raise ApiError(422, "bad_file_type",
                       f"Format qoʻllab-quvvatlanmaydi: {file_type or '—'}",
                       f"Формат не поддерживается: {file_type or '—'} (нужны: {', '.join(sorted(SUPPORTED))})")
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise ApiError(413, "file_too_large", "Fayl juda katta (maks. 50 MB)", "Файл слишком большой (макс. 50 МБ)")

    material = SourceMaterial(
        topic_id=topic_id,
        file_name=file.filename or "file",
        file_url=storage.save_bytes(f"topics/{topic_id}/materials", file.filename or "file", data),
        file_type=file_type,
        uploaded_by=user.id,
    )
    db.add(material)
    db.commit()
    jobs.submit(service.run_parse_material, material.id)
    return material


@router.delete("/materials/{material_id}", dependencies=[staff_only])
def delete_material(material_id: int, user: CurrentUser, db: DbSession):
    material = db.get(SourceMaterial, material_id)
    if material is None:
        raise not_found()
    _topic_for_write(db, material.topic_id, user)
    storage.delete(material.file_url)
    if material.parsed_text_url:
        storage.delete(material.parsed_text_url)
    db.delete(material)
    db.commit()
    return {"ok": True}


# --- Конспект (TopicDigest) ---------------------------------------------------


@router.post("/topics/{topic_id}/digest/generate", response_model=JobOut, status_code=202,
             dependencies=[staff_only])
def generate_digest(topic_id: int, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)
    running = db.scalar(
        select(GenerationJob).where(
            GenerationJob.topic_id == topic_id,
            GenerationJob.status.in_(("queued", "running")),
        )
    )
    if running:
        raise ApiError(409, "job_running", "Generatsiya allaqachon ketmoqda", "Генерация уже идёт")
    has_parsed = db.scalar(
        select(SourceMaterial).where(
            SourceMaterial.topic_id == topic_id, SourceMaterial.parse_status == "done"
        )
    )
    if not has_parsed:
        raise ApiError(409, "no_materials",
                       "Avval material yuklang (parsing tugagan boʻlishi kerak)",
                       "Сначала загрузите материал (парсинг должен завершиться)")

    job = GenerationJob(topic_id=topic_id, kind="digest", created_by=user.id)
    db.add(job)
    db.commit()
    jobs.submit(service.run_digest_job, job.id)
    db.refresh(job)
    return job


@router.get("/jobs/{job_id}", response_model=JobOut, dependencies=[staff_only])
def get_job(job_id: int, user: CurrentUser, db: DbSession):
    job = db.get(GenerationJob, job_id)
    if job is None:
        raise not_found()
    _topic_for_write(db, job.topic_id, user)
    return job


@router.put("/topics/{topic_id}/digest", response_model=DigestOut, dependencies=[staff_only])
def update_digest(topic_id: int, body: DigestIn, user: CurrentUser, db: DbSession):
    _topic_for_write(db, topic_id, user)
    digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic_id))
    if digest is None:
        raise not_found("Konspekt")
    digest.digest_json = body.digest_json
    # правка после утверждения снимает утверждение — контрольная точка честная
    digest.approved_by_teacher = False
    digest.approved_at = None
    db.commit()
    return digest


@router.post("/topics/{topic_id}/digest/approve", response_model=DigestOut,
             dependencies=[staff_only])
def approve_digest(topic_id: int, user: CurrentUser, db: DbSession):
    from datetime import datetime, timezone

    _topic_for_write(db, topic_id, user)
    digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic_id))
    if digest is None:
        raise not_found("Konspekt")
    digest.approved_by_teacher = True
    digest.approved_at = datetime.now(timezone.utc)
    db.commit()
    return digest


# --- Глоссарий кафедры ---------------------------------------------------------


@router.get("/glossary", response_model=list[GlossaryOut], dependencies=[staff_only])
def list_glossary(db: DbSession, department_id: int | None = None):
    query = select(GlossaryTerm).order_by(GlossaryTerm.id)
    if department_id:
        query = query.where(GlossaryTerm.department_id == department_id)
    return db.scalars(query).all()


@router.post("/glossary", response_model=GlossaryOut, status_code=201,
             dependencies=[require_roles("admin")])
def create_term(body: GlossaryIn, db: DbSession):
    term = GlossaryTerm(**body.model_dump())
    db.add(term)
    db.commit()
    return term


@router.put("/glossary/{term_id}", response_model=GlossaryOut,
            dependencies=[require_roles("admin")])
def update_term(term_id: int, body: GlossaryIn, db: DbSession):
    term = db.get(GlossaryTerm, term_id)
    if term is None:
        raise not_found()
    for key, value in body.model_dump().items():
        setattr(term, key, value)
    db.commit()
    return term


@router.delete("/glossary/{term_id}", dependencies=[require_roles("admin")])
def delete_term(term_id: int, db: DbSession):
    term = db.get(GlossaryTerm, term_id)
    if term is None:
        raise not_found()
    db.delete(term)
    db.commit()
    return {"ok": True}
