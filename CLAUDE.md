# MedUni AI Platform

Платформа медицинского университета: AI-генерация учебного контента (контур A) + LMS для студентов (контур B).
Полное ТЗ: `docs/this-plan.md`. Архитектурные решения: `docs/decisions/`.

## Статус

- **M1 (Фундамент) — в работе.** Auth (JWT+RBAC), орг-структура, админка, i18n uz/ru.
- M2–M8 — см. план, раздел 14.

## Стек

- `backend/` — FastAPI (Python 3.12+), SQLAlchemy 2 (sync), Pydantic v2. Dev-БД — SQLite (`DATABASE_URL`), прод — PostgreSQL 16.
- `frontend/` — Next.js 15 (App Router) + TypeScript + Tailwind, next-intl (uz-Latn / ru), TanStack Query. Dev-прокси `/api/*` → `localhost:8000`.
- Docker на dev-машине отсутствует — локально всё запускается напрямую; `docker-compose.yml` для сервера (см. ADR-0001).
- AI: сначала бесплатные API (Gemini free tier, Edge TTS) через слой адаптеров `backend/app/ai/` (см. ADR-0002). Провайдер меняется конфигом, не кодом.

## Запуск (dev, Windows)

```powershell
# backend (порт 8000)
cd backend; .\.venv\Scripts\python -m uvicorn app.main:app --reload
# сиды (админ admin@meduni.uz / admin123)
cd backend; .\.venv\Scripts\python -m scripts.seed
# tests
cd backend; .\.venv\Scripts\python -m pytest
# frontend (порт 3000)
cd frontend; npm run dev
```

## Конвенции

- Языки интерфейса и данных: uz (латиница, апострофы oʻ/gʻ) и ru. Все именованные сущности — поля `name_uz`/`name_ru`.
- Каждый модуль бэкенда: `router.py`, `service.py`, `models.py`, `schemas.py` в `app/modules/<name>/`.
- RBAC на каждом эндпоинте через `require_roles(...)`; студент никогда не видит неопубликованный контент.
- Ошибки API: `{error: {code, message_uz, message_ru}}`.
- Ничего не публикуется без явного утверждения преподавателем (две контрольные точки, план §5.1) — блокировки на бэкенде, не только в UI.
- После каждого milestone обновлять этот файл и `docs/decisions/`.
