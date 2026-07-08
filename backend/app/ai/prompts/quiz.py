"""Промпт и схема генерации теста из конспекта. Версия: v1."""

QUIZ_SYSTEM = """\
Ты — методист медицинского университета в Узбекистане. Составь тестовые вопросы
СТРОГО по предоставленному конспекту темы.

ЖЁСТКИЕ ПРАВИЛА:
1. Используй ТОЛЬКО факты из конспекта. ЗАПРЕЩЕНО добавлять факты, дозировки,
   протоколы «из головы».
2. Каждый вопрос — с 4 вариантами, ровно ОДИН правильный.
3. Каждое поле — на двух языках: узбекский (ЛАТИНИЦА, апострофы oʻ/gʻ) и русский.
4. К каждому варианту дай короткое объяснение: почему он верный или неверный.
5. Для каждого вопроса укажи source_fragment — короткую цитату из конспекта,
   на которой основан правильный ответ.
6. Распредели по сложности: recall (запоминание), understand (понимание),
   apply (применение).
"""

QUIZ_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "questions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "question_uz": {"type": "STRING"},
                    "question_ru": {"type": "STRING"},
                    "options": {
                        "type": "ARRAY",
                        "description": "Ровно 4 варианта",
                        "items": {
                            "type": "OBJECT",
                            "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}},
                            "required": ["uz", "ru"],
                        },
                    },
                    "correct_index": {"type": "INTEGER", "description": "0..3"},
                    "explanations": {
                        "type": "ARRAY",
                        "description": "По одному объяснению на каждый вариант",
                        "items": {
                            "type": "OBJECT",
                            "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}},
                            "required": ["uz", "ru"],
                        },
                    },
                    "difficulty": {"type": "STRING", "enum": ["recall", "understand", "apply"]},
                    "source_fragment": {"type": "STRING"},
                },
                "required": ["question_uz", "question_ru", "options", "correct_index",
                             "explanations", "difficulty", "source_fragment"],
            },
        }
    },
    "required": ["questions"],
}


def build_quiz_prompt(digest_json: dict, count: int, glossary: list[dict]) -> str:
    import json

    parts = [f"Составь {count} тестовых вопросов по конспекту.\n"]
    if glossary:
        lines = "\n".join(f"- {g['term_ru']} = {g['term_uz']}" for g in glossary)
        parts.append(f"ГЛОССАРИЙ (используй эти переводы):\n{lines}\n")
    parts.append("КОНСПЕКТ (JSON):\n" + json.dumps(digest_json, ensure_ascii=False, indent=1))
    return "\n".join(parts)
