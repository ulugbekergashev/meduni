# ADR-0001: Локальная разработка без Docker

**Дата:** 2026-07-08 · **Статус:** принято

## Контекст

На dev-машине (Windows 11) нет Docker. План предполагает Postgres + Redis + MinIO в Docker Compose.

## Решение

- Dev: SQLite через `DATABASE_URL=sqlite:///./dev.db` (SQLAlchemy скрывает разницу), файловое хранилище `backend/storage/` вместо MinIO, Redis не требуется до M2 (Celery).
- Прод/сервер: `docker-compose.yml` в корне — Postgres 16, Redis, MinIO, backend, frontend.
- В моделях не использовать Postgres-специфичные типы без fallback: JSON-поля — `sqlalchemy.JSON` (в Postgres автоматически JSONB-совместимо), UUID — строковые id.

## Последствия

- Перед пилотом (M8) обязателен прогон всех миграций и тестов на реальном PostgreSQL.
- Alembic-миграции пишутся с оглядкой на оба диалекта.
