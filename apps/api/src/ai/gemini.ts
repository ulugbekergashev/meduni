import { GoogleGenAI } from "@google/genai";
import { ApiError } from "../lib/errors";
import { recordAiUsage } from "./usage";

// `gemini-2.5-flash` is blocked for new API accounts; `gemini-flash-latest` is the
// current stable flash alias (works with responseSchema + thinkingBudget:0).
const MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new ApiError(500, "no_api_key", "Gemini API kaliti sozlanmagan", "Ключ Gemini API не настроен");
  }
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function toApiError(err: unknown): ApiError {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403 || /API key|permission|unauthenticated/i.test(msg)) {
    return new ApiError(502, "ai_key_error", "Gemini API kaliti ishlamayapti", "Ключ Gemini API не работает");
  }
  if (status === 429 || /quota|rate limit|resource_exhausted/i.test(msg)) {
    return new ApiError(502, "ai_quota", "Gemini limiti tugadi, keyinroq urinib koʻring", "Лимит Gemini исчерпан, попробуйте позже");
  }
  return new ApiError(502, "ai_error", "Konspekt yaratilmadi, qayta urinish", "Не удалось сгенерировать, повторите");
}

export interface GenerateOpts {
  systemInstruction: string;
  userContent: string;
  responseSchema: unknown;
  kind: string;
  topicId?: number;
  departmentId?: number | null;
  userId?: number | null;
}

/** Calls Gemini for structured JSON, logs token usage, retries transient failures. */
export async function generateStructured<T>(opts: GenerateOpts): Promise<T> {
  const ai = getClient();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents: opts.userContent,
          config: {
            systemInstruction: opts.systemInstruction,
            responseMimeType: "application/json",
            responseSchema: opts.responseSchema as never,
            // Disable "thinking": for extraction tasks it's ~5s vs ~40s+, uses
            // ~2.6x fewer tokens (free-tier friendly), and quality holds.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        TIMEOUT_MS
      );

      const usage = res.usageMetadata;
      await recordAiUsage({
        kind: opts.kind,
        model: MODEL,
        topicId: opts.topicId,
        departmentId: opts.departmentId,
        userId: opts.userId,
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
      });

      const text = res.text ?? "";
      return JSON.parse(text) as T;
    } catch (err) {
      lastErr = err;
      // Don't retry auth/quota errors.
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403 || status === 429) break;
    }
  }

  throw toApiError(lastErr);
}

const IMAGE_MODEL = "gemini-3-pro-image-preview";

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

/** Generates a single image via Nano Banana Pro. Logs one AiUsage row. */
export async function generateImage(
  prompt: string,
  opts: { kind: string; topicId?: number; departmentId?: number | null; userId?: number | null }
): Promise<GeneratedImage> {
  const ai = getClient();
  try {
    const res = await withTimeout(
      ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: prompt,
        config: { responseModalities: ["IMAGE"] },
      }),
      TIMEOUT_MS
    );

    const usage = res.usageMetadata;
    await recordAiUsage({
      kind: opts.kind,
      model: IMAGE_MODEL,
      topicId: opts.topicId,
      departmentId: opts.departmentId,
      userId: opts.userId,
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
      images: 1,
    });

    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    if (!imgPart?.inlineData?.data) {
      throw new ApiError(502, "ai_no_image", "Rasm yaratilmadi", "Изображение не создано");
    }
    return {
      buffer: Buffer.from(imgPart.inlineData.data, "base64"),
      mimeType: imgPart.inlineData.mimeType ?? "image/png",
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw toApiError(err);
  }
}
