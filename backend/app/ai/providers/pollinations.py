"""Pollinations.ai — бесплатная генерация изображений без ключа (резерв к Gemini, ADR-0002)."""
import time
import urllib.parse

import httpx

from app.ai.base import ImageModel


class PollinationsImageModel(ImageModel):
    def generate_image(self, prompt: str) -> bytes:
        full_prompt = (
            "Educational medical illustration, textbook style, clean, no text labels. " + prompt
        )
        url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(full_prompt)}"
        params = {"width": 1024, "height": 768, "nologo": "true"}
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = httpx.get(url, params=params, timeout=180)
                response.raise_for_status()
                if response.content[:4] not in (b"\x89PNG", b"\xff\xd8\xff\xe0", b"\xff\xd8\xff\xe1"):
                    raise RuntimeError("Pollinations вернул не изображение")
                return response.content
            except httpx.HTTPError as e:
                last_error = e
                time.sleep(3 * (attempt + 1))
        raise RuntimeError(f"Pollinations недоступен: {last_error}")
