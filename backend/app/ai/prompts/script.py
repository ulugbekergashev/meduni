"""Промпт и схема генерации сценария озвучки видео по слайдам. Версия: v1."""

SCRIPT_SYSTEM = """\
Ты — методист медицинского университета в Узбекистане. Тебе даны слайды учебной
презентации. Напиши текст озвучки (диктора) для видео — по одному связному
фрагменту на каждый слайд.

ЖЁСТКИЕ ПРАВИЛА:
1. Используй ТОЛЬКО содержание слайдов. НЕ добавляй новых фактов/дозировок.
2. Пиши на языке {LANG_NAME}. Это будет читать синтезатор речи — пиши живым,
   разговорным, но профессиональным языком, законченными предложениями.
3. Для каждого слайда — 2–4 предложения (титульный и итоговый — короче).
4. Не читай тезисы дословно: объясняй и связывай их в речь.
5. Верни ровно столько фрагментов, сколько слайдов, в том же порядке.
"""

SCRIPT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "script": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "slide_index": {"type": "INTEGER"},
                    "text": {"type": "STRING"},
                },
                "required": ["slide_index", "text"],
            },
        }
    },
    "required": ["script"],
}


def build_script_prompt(slides: list[dict], lang: str) -> str:
    import json

    payload = []
    for i, s in enumerate(slides):
        payload.append({
            "slide_index": i,
            "title": s.get(f"title_{lang}", ""),
            "bullets": s.get(f"bullets_{lang}", []),
            "notes": s.get(f"notes_{lang}", ""),
        })
    return "СЛАЙДЫ (JSON):\n" + json.dumps(payload, ensure_ascii=False, indent=1)


def script_system(lang: str) -> str:
    return SCRIPT_SYSTEM.replace("{LANG_NAME}", "узбекском (латиница)" if lang == "uz" else "русском")
