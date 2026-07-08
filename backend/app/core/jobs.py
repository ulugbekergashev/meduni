"""Запуск фоновых задач. Dev — ThreadPoolExecutor, тесты — синхронно (ADR-0003).
На сервере заменяется на Celery: submit() -> task.delay(), воркеры уже изолированы."""
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from app.core.config import settings

log = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="job")


def _safe(fn: Callable, *args) -> None:
    try:
        fn(*args)
    except Exception:  # воркер сам пишет ошибку в БД; это последний рубеж
        log.error("background job crashed:\n%s", traceback.format_exc())


def submit(fn: Callable, *args) -> None:
    if settings.jobs_sync:
        _safe(fn, *args)
    else:
        _executor.submit(_safe, fn, *args)
