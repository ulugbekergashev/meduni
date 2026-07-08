"""Экспорт теста: Moodle XML, GIFT, PDF (план §10). Язык выбирается параметром."""
from xml.sax.saxutils import escape

from app.modules.content.models import Question


def _q_text(q: Question, lang: str) -> str:
    return q.question_ru if lang == "ru" else q.question_uz


def _opt_text(option: dict, lang: str) -> str:
    return option.get(lang) or option.get("ru") or option.get("uz") or ""


def _expl_text(q: Question, i: int, lang: str) -> str:
    if i < len(q.explanations_json):
        e = q.explanations_json[i]
        return e.get(lang) or e.get("ru") or ""
    return ""


def to_moodle_xml(questions: list[Question], lang: str = "ru") -> str:
    out = ['<?xml version="1.0" encoding="UTF-8"?>', "<quiz>"]
    for n, q in enumerate(questions, start=1):
        out.append('  <question type="multichoice">')
        out.append(f"    <name><text>Q{n}</text></name>")
        out.append('    <questiontext format="html">')
        out.append(f"      <text><![CDATA[{_q_text(q, lang)}]]></text>")
        out.append("    </questiontext>")
        out.append("    <single>true</single>")
        out.append("    <shuffleanswers>true</shuffleanswers>")
        for i, option in enumerate(q.options_json):
            fraction = 100 if i == q.correct_index else 0
            out.append(f'    <answer fraction="{fraction}">')
            out.append(f"      <text><![CDATA[{_opt_text(option, lang)}]]></text>")
            out.append(f"      <feedback><text><![CDATA[{_expl_text(q, i, lang)}]]></text></feedback>")
            out.append("    </answer>")
        out.append("  </question>")
    out.append("</quiz>")
    return "\n".join(out)


def to_gift(questions: list[Question], lang: str = "ru") -> str:
    def esc(s: str) -> str:
        return s.replace("~", "\\~").replace("=", "\\=").replace("#", "\\#").replace("{", "\\{").replace("}", "\\}")

    blocks = []
    for n, q in enumerate(questions, start=1):
        lines = [f"::Q{n}:: {esc(_q_text(q, lang))} {{"]
        for i, option in enumerate(q.options_json):
            prefix = "=" if i == q.correct_index else "~"
            expl = _expl_text(q, i, lang)
            suffix = f" #{esc(expl)}" if expl else ""
            lines.append(f"    {prefix}{esc(_opt_text(option, lang))}{suffix}")
        lines.append("}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def to_pdf(questions: list[Question], title: str, lang: str = "ru") -> bytes:
    """Простой PDF без внешних библиотек (минимальный PDF-writer)."""
    lines: list[str] = [title, ""]
    for n, q in enumerate(questions, start=1):
        lines.append(f"{n}. {_q_text(q, lang)}")
        for i, option in enumerate(q.options_json):
            mark = "(*)" if i == q.correct_index else "( )"
            letter = chr(ord("A") + i)
            lines.append(f"    {mark} {letter}) {_opt_text(option, lang)}")
        lines.append("")
    return _simple_pdf(lines)


def _simple_pdf(lines: list[str]) -> bytes:
    """Одностраничный (при необходимости — обрезка) текстовый PDF, стандартный шрифт."""
    def pdf_escape(s: str) -> str:
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    # WinAnsi-шрифт Helvetica не покрывает кириллицу полноценно; для учебного
    # экспорта достаточно, полноценная типографика uz/ru — later (M4, PPTX/PDF по шаблону).
    content_lines = ["BT", "/F1 11 Tf", "50 780 Td", "13 TL"]
    for line in lines[:60]:
        content_lines.append(f"({pdf_escape(line[:95])}) Tj")
        content_lines.append("T*")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref_pos = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n".encode()
    pdf += b"0000000000 65535 f \n"
    for off in offsets:
        pdf += f"{off:010d} 00000 n \n".encode()
    pdf += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF".encode()
    return pdf
