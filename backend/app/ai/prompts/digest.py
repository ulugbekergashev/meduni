"""Промпт и схема конспекта темы (TopicDigest). Версия: v1.
Правила качества — план §5.3: только из материала, глоссарий в каждом промпте."""

DIGEST_SYSTEM = """\
Ты — методист медицинского университета в Узбекистане. Твоя задача — составить
структурированный учебный конспект темы СТРОГО по предоставленному материалу.

ЖЁСТКИЕ ПРАВИЛА:
1. Используй ТОЛЬКО факты из материала. ЗАПРЕЩЕНО добавлять факты, дозировки,
   протоколы, классификации «из головы», даже если ты их знаешь.
2. Если в материале чего-то нет — просто не включай это в конспект.
3. Каждое поле заполняй на двух языках: узбекский (ЛАТИНИЦА, апострофы oʻ/gʻ)
   и русский. Медицинскую терминологию передавай точно.
4. Если дан глоссарий кафедры — используй ровно эти варианты перевода терминов.
5. Пиши кратко и учебно: конспект — основа для слайдов, тестов и видео.
"""

DIGEST_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "learning_objectives": {
            "type": "ARRAY",
            "description": "Цели обучения: что студент должен знать/уметь после темы",
            "items": {
                "type": "OBJECT",
                "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}},
                "required": ["uz", "ru"],
            },
        },
        "key_concepts": {
            "type": "ARRAY",
            "description": "Ключевые концепции темы с кратким разбором",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title_uz": {"type": "STRING"},
                    "title_ru": {"type": "STRING"},
                    "body_uz": {"type": "STRING"},
                    "body_ru": {"type": "STRING"},
                },
                "required": ["title_uz", "title_ru", "body_uz", "body_ru"],
            },
        },
        "terms": {
            "type": "ARRAY",
            "description": "Термины темы",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "uz": {"type": "STRING"},
                    "ru": {"type": "STRING"},
                    "lat": {"type": "STRING", "description": "Латинское название, если есть в материале"},
                },
                "required": ["uz", "ru"],
            },
        },
        "key_facts": {
            "type": "ARRAY",
            "description": "Важные факты, цифры, дозировки — только из материала",
            "items": {
                "type": "OBJECT",
                "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}},
                "required": ["uz", "ru"],
            },
        },
        "illustration_ideas": {
            "type": "ARRAY",
            "description": "Описания иллюстраций/схем, которые помогут объяснить тему",
            "items": {
                "type": "OBJECT",
                "properties": {"uz": {"type": "STRING"}, "ru": {"type": "STRING"}},
                "required": ["uz", "ru"],
            },
        },
    },
    "required": ["learning_objectives", "key_concepts", "terms", "key_facts", "illustration_ideas"],
}


def build_digest_user_prompt(topic_title: str, material_text: str, glossary: list[dict]) -> str:
    parts = [f"ТЕМА: {topic_title}\n"]
    if glossary:
        lines = "\n".join(
            f"- {g['term_ru']} = {g['term_uz']}" + (f" (lat: {g['term_lat']})" if g.get("term_lat") else "")
            for g in glossary
        )
        parts.append(f"ГЛОССАРИЙ КАФЕДРЫ (используй именно эти переводы):\n{lines}\n")
    parts.append(f"МАТЕРИАЛ:\n{material_text}")
    return "\n".join(parts)
