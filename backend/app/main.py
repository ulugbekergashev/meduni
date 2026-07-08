from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.db import Base, engine
from app.modules.auth.router import router as auth_router
from app.modules.courses.router import router as courses_router
from app.modules.content.router import router as content_router
from app.modules.org.router import router as org_router
from app.modules.topics.router import router as topics_router

# Импорт моделей, чтобы Base.metadata знал все таблицы
from app.modules.auth import models as _auth_models  # noqa: F401
from app.modules.content import models as _content_models  # noqa: F401
from app.modules.courses import models as _courses_models  # noqa: F401
from app.modules.org import models as _org_models  # noqa: F401
from app.modules.topics import models as _topics_models  # noqa: F401


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Dev-удобство; для прод-СУБД схему ведёт Alembic
    Base.metadata.create_all(bind=engine)
    from app.modules.topics.service import fail_stale_jobs

    fail_stale_jobs()
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
    media_type = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(ext, "application/octet-stream")
    return Response(path.read_bytes(), media_type=media_type,
                    headers={"Cache-Control": "max-age=3600"})


for router in (auth_router, org_router, courses_router, topics_router, content_router):
    app.include_router(router, prefix="/api/v1")
