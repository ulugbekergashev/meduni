# ADR-0002: Бесплатные AI-провайдеры на старте

**Дата:** 2026-07-08 · **Статус:** принято

## Контекст

Бюджета на платные AI API в начале нет. План (§5.4) предусматривает слой адаптеров `TextModel` / `ImageModel` / `TTSModel`, выбор провайдера — конфигурацией.

## Решение

Стартовый набор — бесплатные уровни:

| Слот | Провайдер (free) | Примечание |
|---|---|---|
| TextModel | **Google Gemini API free tier** (AI Studio ключ, модели gemini-2.x-flash) | Бесплатные лимиты запросов/день; structured output поддерживается. Резерв: Groq free tier, OpenRouter free-модели |
| ImageModel | **Pollinations** (бесплатно, без ключа) | Проверено на M4: Gemini image генерация НЕ входит во free tier (`generate_content_free_tier_requests, limit: 0`), поэтому по умолчанию `AI_IMAGE_PROVIDER=pollinations`. Gemini image (`gemini-2.5-flash-image`) / Nano Banana Pro — при переходе на платный ключ |
| TTSModel | **edge-tts** (Microsoft Edge TTS, бесплатно, без ключа) | Есть голоса uz-UZ-MadinaNeural / uz-UZ-SardorNeural и ru-RU — ровно те, что в плане для Azure |

Платные (Claude, Azure Speech, Nano Banana Pro) подключаются позже заменой значения `AI_TEXT_PROVIDER` / `AI_IMAGE_PROVIDER` / `AI_TTS_PROVIDER` в конфиге — интерфейсы уже совпадают.

## Последствия

- Free-tier лимиты (запросов/день) → очередь генераций и ретраи обязательны уже в M2; квоты по кафедрам (AIUsage) становятся важнее.
- edge-tts — неофициальный API: перед пилотом заложить проверку стабильности; Azure Speech — прямой платный эквивалент с теми же голосами.
- Сравнительный тест LLM на узбекском медконтенте (план §15 п.5) проводим на Gemini free vs Claude (платный триал) до фиксации.
