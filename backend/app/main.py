from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.db import Base, engine
from app.modules.auth.router import router as auth_router
from app.modules.courses.router import router as courses_router
from app.modules.org.router import router as org_router

# Импорт моделей, чтобы Base.metadata знал все таблицы
from app.modules.auth import models as _auth_models  # noqa: F401
from app.modules.courses import models as _courses_models  # noqa: F401
from app.modules.org import models as _org_models  # noqa: F401

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Dev-удобство; для прод-СУБД схему ведёт Alembic
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="MedUni AI Platform", version="0.1.0", lifespan=lifespan)


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


for router in (auth_router, org_router, courses_router):
    app.include_router(router, prefix="/api/v1")
