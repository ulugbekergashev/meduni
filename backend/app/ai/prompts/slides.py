"""Промпт и схема генерации слайдов презентации из конспекта. Версия: v1."""

SLIDES_SYSTEM = """\
Ты — методист медицинского университета в Узбекистане. Составь слайды учебной
презентации СТРОГО по предоставленному конспекту темы.

ЖЁСТКИЕ ПРАВИЛА:
1. Используй ТОЛЬКО факты из конспекта. НЕ добавляй факты/дозировки «из головы».
2. Каждое поле — на двух языках: узбекский (ЛАТИНИЦА, oʻ/gʻ) и русский.
3. Структура: 1 титульный слайд, слайды по целям и концепциям, 1 итоговый.
4. На слайде — короткий заголовок и 3–5 кратких тезисов (не абзацы!).
5. notes — текст для заметок докладчика (2–4 предложения), тоже uz/ru.
6. image_prompt — короткое описание уместной учебной иллюстрации/схемы на
   АНГЛИЙСКОМ (для генератора изображений), медицински точное, без текста на картинке.
   Если иллюстрация не нужна (титул, итог) — пустая строка.
"""

SLIDES_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "slides": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title_uz": {"type": "STRING"},
                    "title_ru": {"type": "STRING"},
                    "bullets_uz": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "bullets_ru": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "notes_uz": {"type": "STRING"},
                    "notes_ru": {"type": "STRING"},
                    "image_prompt": {"type": "STRING"},
                },
                "required": ["title_uz", "title_ru", "bullets_uz", "bullets_ru",
                             "notes_uz", "notes_ru", "image_prompt"],
            },
        }
    },
    "required": ["slides"],
}


def build_slides_prompt(digest_json: dict, glossary: list[dict]) -> str:
    import json

    parts = ["Составь слайды презентации по конспекту.\n"]
    if glossary:
        lines = "\n".join(f"- {g['term_ru']} = {g['term_uz']}" for g in glossary)
        parts.append(f"ГЛОССАРИЙ:\n{lines}\n")
    parts.append("КОНСПЕКТ (JSON):\n" + json.dumps(digest_json, ensure_ascii=False, indent=1))
    return "\n".join(parts)
