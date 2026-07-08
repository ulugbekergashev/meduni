"""Промпт и схема клинического кейса из конспекта. Версия: v1."""

CASE_SYSTEM = """\
Ты — клинический преподаватель медицинского университета в Узбекистане. Составь
учебный клинический кейс СТРОГО на основе конспекта темы.

ЖЁСТКИЕ ПРАВИЛА:
1. Кейс должен опираться на факты, дозировки и подходы ТОЛЬКО из конспекта.
   ЗАПРЕЩЕНО выдумывать протоколы и цифры.
2. Все поля — на двух языках: узбекский (ЛАТИНИЦА, oʻ/gʻ) и русский.
3. Кейс правдоподобный и учебный: жалобы, анамнез, объективный статус,
   лабораторные/инструментальные данные, вопросы студенту и эталонный разбор.
4. Вопросы должны проверять клиническое мышление по теме.
"""

CASE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "complaints": {"type": "OBJECT", "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}}, "required": ["uz", "ru"]},
        "anamnesis": {"type": "OBJECT", "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}}, "required": ["uz", "ru"]},
        "objective": {"type": "OBJECT", "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}}, "required": ["uz", "ru"]},
        "labs": {"type": "OBJECT", "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}}, "required": ["uz", "ru"]},
        "questions": {
            "type": "ARRAY",
            "items": {"type": "OBJECT", "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}}, "required": ["uz", "ru"]},
        },
        "reference_analysis": {"type": "OBJECT", "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}}, "required": ["uz", "ru"]},
    },
    "required": ["complaints", "anamnesis", "objective", "labs", "questions", "reference_analysis"],
}


def build_case_prompt(digest_json: dict, fmt: str, glossary: list[dict]) -> str:
    import json

    length = "развёрнутый (extended)" if fmt == "extended" else "короткий (short)"
    parts = [f"Составь {length} клинический кейс по конспекту.\n"]
    if glossary:
        lines = "\n".join(f"- {g['term_ru']} = {g['term_uz']}" for g in glossary)
        parts.append(f"ГЛОССАРИЙ:\n{lines}\n")
    parts.append("КОНСПЕКТ (JSON):\n" + json.dumps(digest_json, ensure_ascii=False, indent=1))
    return "\n".join(parts)
