"""Google Gemini через REST (free tier, ADR-0002). Без SDK — один httpx-вызов."""
import json
import time

import httpx

from app.ai.base import TextModel
from app.core.config import settings

_API = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiTextModel(TextModel):
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY не задан в backend/.env")
        self.model = settings.gemini_text_model

    def generate_json(self, system: str, user: str, schema: dict) -> tuple[dict, int]:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
                "temperature": 0.3,
            },
        }
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = httpx.post(
                    f"{_API}/{self.model}:generateContent",
                    headers={"x-goog-api-key": settings.gemini_api_key},
                    json=body,
                    timeout=180,
                )
                if response.status_code in (429, 500, 503):
                    # free tier: лимиты запросов — ждём и повторяем
                    last_error = RuntimeError(f"Gemini HTTP {response.status_code}: {response.text[:300]}")
                    time.sleep(5 * (attempt + 1))
                    continue
                response.raise_for_status()
                payload = response.json()
                text = payload["candidates"][0]["content"]["parts"][0]["text"]
                tokens = payload.get("usageMetadata", {}).get("totalTokenCount", 0)
                return json.loads(text), tokens
            except (httpx.HTTPError, KeyError, json.JSONDecodeError) as e:
                last_error = e
                time.sleep(3 * (attempt + 1))
        raise RuntimeError(f"Gemini недоступен после 3 попыток: {last_error}")
