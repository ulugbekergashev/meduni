import { GoogleGenAI } from "@google/genai";
import { ApiError } from "../lib/errors";
import { recordAiUsage } from "./usage";

// `gemini-2.5-flash` is blocked for new API accounts. We try the best flash first
// for quality, then fall back to the lite alias when the primary is overloaded
// (503 "high demand"). Both support responseSchema + thinkingBudget:0.
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const TIMEOUT_MS = 90_000;
const ATTEMPTS_PER_MODEL = 2;
const MAX_TTS_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  if (status === 503 || status === 500 || /unavailable|overloaded|high demand/i.test(msg)) {
    return new ApiError(502, "ai_busy", "Gemini hozir band, biroздан keyin qayta urining", "Gemini сейчас загружен, повторите через минуту");
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
  /** Allow the model to "think" for higher-quality output (e.g. lecture scripts). */
  thinking?: boolean;
}

/** Calls Gemini for structured JSON, logs token usage, retries transient failures. */
export async function generateStructured<T>(opts: GenerateOpts): Promise<T> {
  const ai = getClient();
  let lastErr: unknown;

  // Try each model in the chain; within a model, retry transient errors with backoff.
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const res = await withTimeout(
          ai.models.generateContent({
            model,
            contents: opts.userContent,
            config: {
              systemInstruction: opts.systemInstruction,
              responseMimeType: "application/json",
              responseSchema: opts.responseSchema as never,
              // Disable "thinking" for extraction tasks (~5s vs ~40s+, ~2.6x fewer
              // tokens). Enable it where quality matters most (lecture scripts).
              ...(opts.thinking ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
            },
          }),
          TIMEOUT_MS
        );

        const usage = res.usageMetadata;
        await recordAiUsage({
          kind: opts.kind,
          model,
          topicId: opts.topicId,
          departmentId: opts.departmentId,
          userId: opts.userId,
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
        });

        return JSON.parse(res.text ?? "") as T;
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number })?.status;
        // Auth/quota won't self-resolve and won't differ across models → stop now.
        if (status === 401 || status === 403 || status === 429) throw toApiError(err);
        // Transient (503 "high demand" / 500 / timeout): back off and retry the same
        // model; if it stays down, the outer loop falls back to the next model.
        if (attempt < ATTEMPTS_PER_MODEL) await sleep(1200 * attempt);
      }
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

const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export interface GeneratedSpeech {
  /** Raw 16-bit PCM audio. */
  pcm: Buffer;
  sampleRate: number;
}

/**
 * Synthesizes speech via Gemini native TTS (studio-quality, far better than
 * edge-tts). Returns raw PCM + sample rate. Retries transient 503/timeouts.
 */
export async function generateSpeech(
  text: string,
  voiceName: string,
  opts: { topicId?: number; departmentId?: number | null; userId?: number | null } = {}
): Promise<GeneratedSpeech> {
  const ai = getClient();
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_TTS_ATTEMPTS; attempt++) {
    try {
      const res = await withTimeout(
        ai.models.generateContent({
          model: TTS_MODEL,
          contents: text,
          config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
        }),
        TIMEOUT_MS
      );
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new ApiError(502, "ai_no_audio", "Ovoz yaratilmadi", "Аудио не создано");

      await recordAiUsage({
        kind: "TTS",
        model: TTS_MODEL,
        topicId: opts.topicId,
        departmentId: opts.departmentId,
        userId: opts.userId,
        promptTokens: res.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
        ttsChars: text.length,
      });

      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? "")?.[1] ?? 24000);
      return { pcm: Buffer.from(part.inlineData.data, "base64"), sampleRate: rate };
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) throw toApiError(err);
      if (attempt < MAX_TTS_ATTEMPTS) await sleep(1500 * attempt);
    }
  }
  throw toApiError(lastErr);
}
