"""Файловое хранилище. Dev — локальная папка (ADR-0001); на сервере — MinIO/S3."""
import uuid
from pathlib import Path

from app.core.config import settings


def _root() -> Path:
    root = Path(settings.storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_bytes(subdir: str, filename: str, data: bytes) -> str:
    """Сохраняет файл, возвращает относительный путь (он же file_url в БД)."""
    safe_name = f"{uuid.uuid4().hex[:8]}_{Path(filename).name}"
    target = _root() / subdir
    target.mkdir(parents=True, exist_ok=True)
    path = target / safe_name
    path.write_bytes(data)
    return f"{subdir}/{safe_name}"


def full_path(rel_path: str) -> Path:
    return _root() / rel_path


def read_text(rel_path: str) -> str:
    return full_path(rel_path).read_text(encoding="utf-8")


def save_text(subdir: str, filename: str, text: str) -> str:
    return save_bytes(subdir, filename, text.encode("utf-8"))


def delete(rel_path: str) -> None:
    full_path(rel_path).unlink(missing_ok=True)
