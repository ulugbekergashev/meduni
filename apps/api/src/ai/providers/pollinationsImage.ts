import { ApiError } from "../../lib/errors";
import { recordAiUsage } from "../usage";

// Pollinations.ai — KALITSIZ, BEPUL rasm generatsiyasi (flux).
//
// Nega kerak: Nano Banana Pro (Gemini) pullik va kvota tugaganda yoki kalit
// ishlamaganda slayd rasmlari jimgina ERROR bo'lib qolardi — talaba esa faqat
// MATNLI slayd ko'rardi (buyurtmachi shikoyati 2026-08-02: "в некоторых
// презентации слайды не видны, только текст").
//
// ⚠️ Sifat farqi (ataylab hujjatlashtiriladi): flux ko'p YORLIQLI tibbiy
// diagrammada matnni buzadi (kirill/lotin imlosi). Shuning uchun u:
//   - default EMAS (default — Gemini, §4 sifat standarti);
//   - `AI_IMAGE_PROVIDER=pollinations` bilan ATAYLAB yoqiladi;
//   - va Gemini yiqilganda FALLBACK sifatida ishlatiladi — bo'sh slayddan yaxshi.

const BASE = "https://image.pollinations.ai/prompt";
const TIMEOUT_MS = 120_000;

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

interface ImageOpts {
  kind: string;
  topicId?: number;
  departmentId?: number | null;
  userId?: number | null;
}

/** Yorliq imlosi buzilmasin uchun prompt oxiriga qat'iy ko'rsatma qo'shiladi. */
function fluxPrompt(prompt: string): string {
  return `${prompt}\n\nStyle: clean flat vector medical illustration, white background, no watermark, no signature.`;
}

export async function generateImagePollinations(prompt: string, opts: ImageOpts): Promise<GeneratedImage> {
  // Har chaqiruvda boshqa `seed` — aks holda bir xil prompt bir xil rasmni
  // qaytaradi (qayta-yaratish tugmasi hech narsa o'zgartirmasdi).
  const seed = Math.floor(Math.random() * 1_000_000);
  const url =
    `${BASE}/${encodeURIComponent(fluxPrompt(prompt))}` +
    `?width=1280&height=720&model=flux&nologo=true&safe=false&seed=${seed}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "image/*" } });
    if (!res.ok) {
      throw new ApiError(502, "ai_no_image", `Rasm yaratilmadi (${res.status})`, `Изображение не создано (${res.status})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    // Xato holatida ba'zan JSON/HTML qaytadi — rasm emasligini shu yerda ushlaymiz.
    if (buffer.length < 2048) {
      throw new ApiError(502, "ai_no_image", "Rasm yaratilmadi", "Изображение не создано");
    }

    await recordAiUsage({
      kind: opts.kind,
      model: "pollinations/flux",
      topicId: opts.topicId,
      departmentId: opts.departmentId,
      userId: opts.userId,
      promptTokens: 0,
      completionTokens: 0,
      images: 1, // xarajat $0 (cost.ts noma'lum modelni 0 bilan loglaydi)
    });

    return { buffer, mimeType: res.headers.get("content-type") ?? "image/jpeg" };
  } finally {
    clearTimeout(timer);
  }
}
