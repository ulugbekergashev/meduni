// OpenAI-mos rasm generatsiyasi (/images/generations). ⚠️ ESLATMA: open image
// modellar belgilangan tibbiy diagramma sifatiga (ayniqsa kirill/o'zbek yozuvli
// label) YETMAYDI — bu faqat ixtiyoriy/arzon rejim uchun; tibbiy atlaslarda
// Gemini (Nano Banana Pro) tavsiya etiladi. Default o'chirilgan.
import { ApiError } from "../../lib/errors";
import { recordAiUsage } from "../usage";
import type { OpenAiImageConfig } from "../config";

const TIMEOUT_MS = 90_000;

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

interface ImageResponse {
  data?: { b64_json?: string; url?: string }[];
}

export async function generateImageOpenAI(
  prompt: string,
  opts: { kind: string; topicId?: number; departmentId?: number | null; userId?: number | null },
  cfg: OpenAiImageConfig
): Promise<GeneratedImage> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.baseUrl}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, prompt, n: 1, response_format: "b64_json", size: "1024x1024" }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new ApiError(502, "ai_openai_image", "Open rasm modeli xatosi", "Ошибка open-модели изображений");

    const json = (await res.json()) as ImageResponse;
    const first = json.data?.[0];
    let buffer: Buffer | null = null;
    if (first?.b64_json) {
      buffer = Buffer.from(first.b64_json, "base64");
    } else if (first?.url) {
      // Ba'zi provayderlar b64 o'rniga URL qaytaradi — yuklab olamiz.
      const img = await fetch(first.url);
      if (img.ok) buffer = Buffer.from(await img.arrayBuffer());
    }
    if (!buffer) throw new ApiError(502, "ai_no_image", "Rasm yaratilmadi", "Изображение не создано");

    await recordAiUsage({
      kind: opts.kind,
      model: cfg.model,
      topicId: opts.topicId,
      departmentId: opts.departmentId,
      userId: opts.userId,
      images: 1,
    });
    return { buffer, mimeType: "image/png" };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, "ai_openai_image", "Open rasm modeli xatosi", "Ошибка open-модели изображений");
  }
}
