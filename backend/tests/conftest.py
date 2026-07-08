import os

os.environ["DATABASE_URL"] = "sqlite://"  # in-memory до импорта приложения
os.environ["JOBS_SYNC"] = "1"  # фоновые задачи — синхронно (ADR-0003)
os.environ["STORAGE_DIR"] = "./test_storage"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

import app.core.db as db_module
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Один in-memory движок на все сессии теста
engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
db_module.engine = engine
db_module.SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

from app.main import app  # noqa: E402
from app.core.db import Base, SessionLocal  # noqa: E402
from app.modules.org.schemas import UserCreate  # noqa: E402
from app.modules.org.service import create_user  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    for role in ("admin", "teacher", "student"):
        create_user(db, UserCreate(
            role=role, full_name=role.title(),
            email=f"{role}@test.uz", password="pass1234",
        ))
    db.commit()
    db.close()
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, role: str) -> dict:
    response = client.post("/api/v1/auth/login",
                           json={"email": f"{role}@test.uz", "password": "pass1234"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
