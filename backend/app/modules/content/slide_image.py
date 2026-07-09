"""Рендер одного слайда в PNG (1280×720) для видео — Pillow.
Поддержка кириллицы и узбекской латиницы (oʻ/gʻ) через системный шрифт."""
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.core import storage

W, H = 1280, 720
_FONT_CANDIDATES = [
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _font(size: int, bold: bool = False):
    names = (["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf"] if bold else []) + _FONT_CANDIDATES
    for name in names:
        if Path(name).exists():
            try:
                return ImageFont.truetype(name, size)
            except OSError:
                continue
    return ImageFont.load_default()


def _hex(color: str) -> tuple[int, int, int]:
    c = color.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _wrap(draw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def render_slide_png(slide: dict, template: dict | None, lang: str, index: int) -> bytes:
    primary = _hex((template or {}).get("primary_color", "0D9488"))
    accent = _hex((template or {}).get("accent_color", "0F172A"))
    title = slide.get(f"title_{lang}", "") or ""
    bullets = slide.get(f"bullets_{lang}", []) or []

    img = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, 12], fill=primary)  # верхняя полоса

    if index == 0:
        title_font = _font(56, bold=True)
        lines = _wrap(draw, title, title_font, W - 200)
        total_h = len(lines) * 70
        y = (H - total_h) // 2
        for line in lines:
            w = draw.textlength(line, font=title_font)
            draw.text(((W - w) / 2, y), line, font=title_font, fill=accent)
            y += 70
        return _to_png(img)

    # Заголовок
    title_font = _font(40, bold=True)
    y = 60
    for line in _wrap(draw, title, title_font, W - 120):
        draw.text((60, y), line, font=title_font, fill=primary)
        y += 52
    y += 20

    # Картинка справа, если есть
    image_url = slide.get("image_url")
    text_width = W - 120
    if image_url:
        path = storage.safe_path(image_url)
        if path:
            try:
                pic = Image.open(path).convert("RGB")
                pic.thumbnail((440, 340))
                img.paste(pic, (W - pic.width - 60, 200))
                text_width = W - 560
            except Exception:
                pass

    bullet_font = _font(28)
    for bullet in bullets:
        for j, line in enumerate(_wrap(draw, bullet, bullet_font, text_width - 40)):
            prefix = "•  " if j == 0 else "    "
            draw.text((60, y), prefix + line, font=bullet_font, fill=accent)
            y += 40
        y += 8
        if y > H - 60:
            break

    return _to_png(img)


def _to_png(img: Image.Image) -> bytes:
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
