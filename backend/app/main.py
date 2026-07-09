from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.db import Base, engine
from app.modules.auth.router import router as auth_router
from app.modules.courses.router import router as courses_router
from app.modules.analytics.router import router as analytics_router
from app.modules.attendance.router import router as attendance_router
from app.modules.content.router import router as content_router
from app.modules.gamification.router import router as gamification_router
from app.modules.learning.router import router as learning_router
from app.modules.org.router import router as org_router
from app.modules.public.router import router as public_router
from app.modules.topics.router import router as topics_router

# Импорт моделей, чтобы Base.metadata знал все таблицы
from app.modules.analytics import models as _analytics_models  # noqa: F401
from app.modules.attendance import models as _attendance_models  # noqa: F401
from app.modules.auth import models as _auth_models  # noqa: F401
from app.modules.content import models as _content_models  # noqa: F401
from app.modules.courses import models as _courses_models  # noqa: F401
from app.modules.gamification import models as _gamification_models  # noqa: F401
from app.modules.learning import models as _learning_models  # noqa: F401
from app.modules.org import models as _org_models  # noqa: F401
from app.modules.topics import models as _topics_models  # noqa: F401


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Dev-удобство; для прод-СУБД схему ведёт Alembic
    Base.metadata.create_all(bind=engine)
    from app.modules.topics.service import fail_stale_jobs

    fail_stale_jobs()

    from app.core.db import SessionLocal
    from app.modules.gamification.service import seed_default_badges

    db = SessionLocal()
    try:
        seed_default_badges(db)
    finally:
        db.close()
    yield


app = FastAPI(title="MedUni AI Platform", version="0.1.0", lifespan=lifespan)


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


@app.get("/api/v1/media/{file_path:path}")
def media(file_path: str):
    """Отдача файлов иллюстраций/логотипов (dev; на сервере — presigned MinIO).
    Медиа не секретно; защита от path traversal — в storage.safe_path."""
    from fastapi import Response

    from app.core import storage

    path = storage.safe_path(file_path)
    if path is None:
        return Response(status_code=404)
    ext = path.suffix.lower()
    media_type = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".mp4": "video/mp4", ".srt": "text/plain; charset=utf-8", ".mp3": "audio/mpeg",
    }.get(ext, "application/octet-stream")
    return Response(path.read_bytes(), media_type=media_type,
                    headers={"Cache-Control": "max-age=3600"})


for router in (auth_router, org_router, courses_router, topics_router,
               content_router, learning_router, public_router,
               attendance_router, gamification_router, analytics_router):
    app.include_router(router, prefix="/api/v1")
