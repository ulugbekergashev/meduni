"""edge-tts — бесплатный TTS Microsoft Edge (ADR-0002). Голоса uz-UZ и ru-RU.
Неофициальный API: перед пилотом заложить проверку стабильности; платный
эквивалент с теми же голосами — Azure Speech."""
import asyncio
import time

import edge_tts

from app.ai.base import TTSModel


class EdgeTTSModel(TTSModel):
    def synthesize(self, text: str, voice: str) -> bytes:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                return asyncio.run(self._synth(text, voice))
            except Exception as e:
                last_error = e
                time.sleep(2 * (attempt + 1))
        raise RuntimeError(f"edge-tts не ответил после 3 попыток: {last_error}")

    @staticmethod
    async def _synth(text: str, voice: str) -> bytes:
        communicate = edge_tts.Communicate(text, voice)
        chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        if not chunks:
            raise RuntimeError("edge-tts вернул пустое аудио")
        return b"".join(chunks)
