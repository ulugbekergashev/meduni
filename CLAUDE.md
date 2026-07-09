# MedUni AI Platform

Платформа медицинского университета: AI-генерация учебного контента (контур A) + LMS для студентов (контур B).
Полное ТЗ: `docs/this-plan.md`. Архитектурные решения: `docs/decisions/`.

## Статус

- **M1 (Фундамент) — готов.** Auth (JWT+RBAC), орг-структура, админка, i18n uz/ru.
- **M2 (Ядро контента) — готов.** Темы, загрузка/парсинг материалов (PDF/DOCX/PPTX/TXT),
  генерация конспекта (TopicDigest) через Gemini, редактор конспекта, утверждение
  (контрольная точка), глоссарий кафедр, конструктор темы `/teach/topics/{id}`.
- **M3 (Тесты и кейсы) — готов.** Генерация Quiz/ClinicalCase из утверждённого
  конспекта (доступна только при `digest.approved_by_teacher = true`), отдельный
  LLM-проход фактчека (флаги на вопросах/блоках кейса), редакторы
  `/teach/content/quiz/{id}` и `/teach/content/case/{id}`, чеклист готовности +
  approve/publish (нельзя утвердить неоткрытый контент или с нерешённым
  фактчеком; правка снимает утверждение), экспорт Moodle XML / GIFT / PDF.
- **M4 (Презентации) — готов.** Генерация слайдов из конспекта (Presentation +
  slides_json), рендер PPTX (python-pptx) по фирменному шаблону (цвета+логотип),
  иллюстрации по одному слайду (бережём квоту), редактор
  `/teach/content/presentation/{id}`, скачивание PPTX, админ-шаблоны
  `/admin/templates`. Картинки: `AI_IMAGE_PROVIDER=pollinations` (Gemini image
  НЕ во free tier). Медиа-раздача `GET /api/v1/media/{path}` с защитой от traversal.
- **M5 (Видео) — готов.** Сценарий озвучки из слайдов презентации (Video +
  script_json, требует готовую презентацию), TTS через edge-tts (uz-UZ-Madina /
  ru-RU-Svetlana, бесплатно), сборка MP4 через ffmpeg (слайды-PNG рендерятся
  Pillow + аудио по слайдам + SRT-субтитры), редактор
  `/teach/content/video/{id}` с плеером и прогрессом сборки. ffmpeg — по пути
  `FFMPEG_PATH` в .env (у dev — winget shim). Медиа отдаёт mp4/srt.
- **M6 (Студенческий контур) — готов.** Модуль learning: Progress/QuizAttempt/
  CaseAttempt, движок unlock-правил (`rules.py`, конструктор И/ИЛИ: video%/quiz%/
  case/date), последовательное открытие тем (карта-путь), урок с вкладками
  video/presentation/quiz/case (студент видит только published), видеоплеер с
  трекингом %, прохождение теста (попытки, разбор ошибок после закрытия/сдачи),
  сдача кейса (эталон скрыт до отправки) + очередь проверки у преподавателя,
  публикация темы, редактор unlock-правил, публичные `/subjects/{id}` и
  `/teachers/{id}`. 30 тестов. Студент проходит тему -> открывается следующая.
- M7–M8 — см. план, раздел 14.

Следующий шаг M7: посещаемость (QR) и геймификация (XP, стрики, бейджи, лидерборды).

## Стек

- `backend/` — FastAPI (Python 3.12+), SQLAlchemy 2 (sync), Pydantic v2. Dev-БД — SQLite (`DATABASE_URL`), прод — PostgreSQL 16.
- `frontend/` — Next.js 15 (App Router) + TypeScript + Tailwind, next-intl (uz-Latn / ru), TanStack Query. Dev-прокси `/api/*` → `localhost:8000`.
- Docker на dev-машине отсутствует — локально всё запускается напрямую; `docker-compose.yml` для сервера (см. ADR-0001).
- AI: сначала бесплатные API (Gemini free tier, Edge TTS) через слой адаптеров `backend/app/ai/` (см. ADR-0002). Провайдер меняется конфигом, не кодом. Ключ — `GEMINI_API_KEY` в `backend/.env` (не в git).
- Фоновые задачи (парсинг, LLM): dev — ThreadPoolExecutor (`app/core/jobs.py`), тесты — синхронно (`JOBS_SYNC=1`); прогресс — поллинг `GET /jobs/{id}`. На сервере → Celery (ADR-0003).
- Файлы (материалы, распарсенный текст): dev — папка `backend/storage/` (`app/core/storage.py`); прод — MinIO/S3.

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
