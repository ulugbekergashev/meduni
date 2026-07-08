"""Фактчек-проход (план §5.3): сверка сгенерированных утверждений с исходником.
Отдельный LLM-вызов; несовпадения подсвечиваются преподавателю."""

FACTCHECK_SYSTEM = """\
Ты — медицинский фактчекер. Тебе дан ИСХОДНЫЙ МАТЕРИАЛ и набор УТВЕРЖДЕНИЙ,
сгенерированных из него. Для каждого утверждения определи, подтверждается ли оно
исходным материалом.

Правила:
- grounded = true, если утверждение прямо следует из материала.
- grounded = false, если факт/цифра/дозировка НЕ найдены в материале или противоречат ему.
- В note кратко (на русском) укажи причину, если grounded = false. Если true — note пустой.
Отвечай строго по схеме, сохраняя порядок и index утверждений.
"""

FACTCHECK_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "results": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "index": {"type": "INTEGER"},
                    "grounded": {"type": "BOOLEAN"},
                    "note": {"type": "STRING"},
                },
                "required": ["index", "grounded", "note"],
            },
        }
    },
    "required": ["results"],
}


def build_factcheck_prompt(material_text: str, statements: list[str]) -> str:
    numbered = "\n".join(f"[{i}] {s}" for i, s in enumerate(statements))
    return f"ИСХОДНЫЙ МАТЕРИАЛ:\n{material_text}\n\nУТВЕРЖДЕНИЯ:\n{numbered}"
