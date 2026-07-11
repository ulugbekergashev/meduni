import { parseOffice } from "officeparser";

/** Minimum meaningful text length; below this we treat a PDF as scanned (no text layer). */
const MIN_TEXT_LEN = 20;

export function fileTypeFromName(fileName: string): string {
  const m = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export const SUPPORTED = ["pdf", "docx", "pptx", "txt", "md"];

export type ParseErrorCode = "SCANNED" | "UNSUPPORTED" | "READ_FAILED";

export interface ParseOutcome {
  ok: boolean;
  text: string;
  errorCode?: ParseErrorCode;
}

export const parseErrorMessages: Record<ParseErrorCode, { uz: string; ru: string }> = {
  SCANNED: {
    uz: "Bu skaner fayl (matn topilmadi). OCR keyinroq qoʻshiladi.",
    ru: "Это скан-файл (текст не найден). OCR добавим позже.",
  },
  UNSUPPORTED: { uz: "Fayl turi qoʻllab-quvvatlanmaydi", ru: "Тип файла не поддерживается" },
  READ_FAILED: { uz: "Faylni oʻqib boʻlmadi", ru: "Не удалось прочитать файл" },
};

export async function extractText(buffer: Buffer, fileType: string): Promise<ParseOutcome> {
  const ext = fileType.toLowerCase();

  if (ext === "txt" || ext === "md") {
    const text = buffer.toString("utf8");
    return text.trim().length > 0 ? { ok: true, text } : { ok: false, text, errorCode: "READ_FAILED" };
  }

  if (!SUPPORTED.includes(ext)) {
    return { ok: false, text: "", errorCode: "UNSUPPORTED" };
  }

  try {
    const ast = await parseOffice(buffer);
    const text = (typeof ast?.toText === "function" ? ast.toText() : String(ast ?? "")) ?? "";
    // pdf/pptx with no extractable text — most likely a scan/image.
    if (text.trim().length < MIN_TEXT_LEN) return { ok: false, text, errorCode: "SCANNED" };
    return { ok: true, text };
  } catch {
    return { ok: false, text: "", errorCode: "READ_FAILED" };
  }
}
