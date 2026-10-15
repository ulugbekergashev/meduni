import type { GoogleGenAI } from "@google/genai";
import { ApiError } from "../lib/errors";
import { recordAiUsage } from "./usage";
import { AI_KEY_MISSING, clientFor, isKeyFatal, resolveGeminiKey } from "./keys";
import { imageProvider, openaiImageConfig, openaiTextConfig, textChain, textProviderFor, type ImageProviderName } from "./config";
import { generateStructuredOpenAI } from "./providers/openaiText";
import { generateImageOpenAI } from "./providers/openaiImage";
import { generateImagePollinations } from "./providers/pollinationsImage";
import type { GenerateOpts } from "./textTypes";

export type { GenerateOpts } from "./textTypes";

// `gemini-2.5-flash` is blocked for new API accounts. We try the best flash first
// for quality, then fall back to the lite alias when the primary is overloaded
// (503 "high demand").
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const TIMEOUT_MS = 90_000;
const ATTEMPTS_PER_MODEL = 2;
const MAX_TTS_ATTEMPTS = 3;

// Minimal thinking budget for extraction tasks. `thinkingBudget: 0` used to mean
// "thinking off", but the current models REJECT it (400 INVALID_ARGUMENT) — that
// silently broke every generation (digest/quiz/case/slides/factcheck). Measured
// 2026-07-22: budget 128 behaves like the old 0 (~1.3s, 0 thinking tokens),
// while omitting the config costs ~3.6s and ~470 thinking tokens.
const MIN_THINKING_BUDGET = 128;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kafedraning O'Z kaliti (bo'lmasa serverning umumiy kaliti — zaxira). Hech biri
 *  yo'q bo'lsa aniq `ai_key_missing` xatosi: foydalanuvchi nima qilish kerakligini
 *  biladi. Mijoz kalit bo'yicha keshlanadi (kafedralar bir-biriga aralashmaydi). */
async function getClient(departmentId?: number | null): Promise<GoogleGenAI> {
  const resolved = await resolveGeminiKey(departmentId);
  if (!resolved) throw AI_KEY_MISSING();
  return clientFor(resolved.key);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/** Google noto'g'ri kalitga ko'pincha 401/403 emas, 400 "API key not valid" qaytaradi. */
function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = String((err as { message?: string })?.message ?? "");
  return status === 401 || status === 403 || (status === 400 && /API key|API_KEY/i.test(msg));
}

function toApiError(err: unknown): ApiError {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403 || /API key|API_KEY|permission|unauthenticated/i.test(msg)) {
    return new ApiError(
      502,
      "ai_key_error",
      "Kafedraning Gemini API kaliti ishlamayapti. Kafedra mudiri kalitni yangilashi kerak.",
      "Ключ Gemini API кафедры не работает. Заведующему кафедрой нужно обновить ключ."
    );
  }
  if (status === 429 || /quota|rate limit|resource_exhausted/i.test(msg)) {
    return new ApiError(502, "ai_quota", "Gemini limiti tugadi, keyinroq urinib koʻring", "Лимит Gemini исчерпан, попробуйте позже");
  }
  if (status === 503 || status === 500 || /unavailable|overloaded|high demand/i.test(msg)) {
    return new ApiError(502, "ai_busy", "Gemini hozir band, biroздан keyin qayta urining", "Gemini сейчас загружен, повторите через минуту");
  }
  return new ApiError(502, "ai_error", "Konspekt yaratilmadi, qayta urinish", "Не удалось сгенерировать, повторите");
}

/** Strukturali JSON generatsiyasi — provider ROUTER. Default Gemini; kind
 *  open modelga yo'naltirilgan va kredit bo'lsa OpenAI-mos endpoint, ISHLAMASA
 *  jimgina Gemini'ga qaytadi (tibbiy pipeline hech qachon to'liq sinmaydi). */
export async function generateStructured<T>(opts: GenerateOpts): Promise<T> {
  // ⚠️ 2026-08-03 (buyurtmachi: "konspekt tuzishni bossam Gemini kalit tugadi
  // dedi… geminini faqat rasm va TTS uchun ishlat"): matn endi ZANJIR bo'yicha
  // yaratiladi. Bepul provayderlar ketma-ket sinaladi va faqat HAMMASI yiqilsa
  // xato qaytadi — bitta model 429 bersa ham konspekt/test yaratilaveradi.
  const chain = textChain(opts.kind);
  let lastErr: unknown;
  for (const link of chain) {
    try {
      const out = link.cfg
        ? await generateStructuredOpenAI<T>(opts, link.cfg)
        : await generateStructuredGemini<T>(opts);
      if (link !== chain[0]) {
        console.warn(`[ai] ${opts.kind}: "${link.name}" bilan yaratildi (oldingi(lar)i ishlamadi)`);
      }
      return out;
    } catch (err) {
      lastErr = err;
      console.warn(`[ai] ${opts.kind}: "${link.name}" ishlamadi →`, (err as Error)?.message?.slice(0, 200));
      // Kafedra kaliti buzuq/o'qilmaydi — boshqa provayderga (platforma hisobi) o'tmaymiz.
      if (isKeyFatal(err)) throw err;
    }
  }
  throw lastErr instanceof ApiError
    ? lastErr
    : new ApiError(
        502,
        "ai_all_failed",
        "AI xizmatlari javob bermadi (barcha provayderlar). Biroz kutib qayta urining.",
        "Сервисы ИИ не ответили (все провайдеры). Повторите через некоторое время."
      );
}

/** Calls Gemini for structured JSON, logs token usage, retries transient failures. */
async function generateStructuredGemini<T>(opts: GenerateOpts): Promise<T> {
  const ai = await getClient(opts.departmentId);
  let lastErr: unknown;

  // 3D: preferLite bo'lsa lite avval (arzon), flash fallback qoladi.
  const chain = opts.preferLite ? [...MODELS].reverse() : MODELS;
  // Try each model in the chain; within a model, retry transient errors with backoff.
  for (const model of chain) {
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
              // Minimise "thinking" for extraction tasks (fast + cheap). Where
              // quality matters most (lecture scripts) we let the model think.
              ...(opts.thinking ? {} : { thinkingConfig: { thinkingBudget: MIN_THINKING_BUDGET } }),
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
        const msg = String((err as { message?: string })?.message ?? err);
        // ⚠️ 2026-10-15: ichki model xatolari ilgari HECH QAYERGA yozilmasdi — production'da
        // konspekt 60s+ ketdi, jurnal esa bo'sh edi va sababni topib bo'lmadi.
        // (Kalit sarlavhada ketadi, xabar matnida yo'q.)
        console.warn(`[ai] ${opts.kind}: ${model} urinish ${attempt} → ${status ?? "-"} ${msg.slice(0, 180)}`);
        // Auth xatosi hech qaysi modelda o'zgarmaydi → darrov to'xtaymiz.
        if (isAuthError(err)) throw toApiError(err);
        // Model OSILIB qolgan (timeout) — xuddi shu modelni yana 90s kutish ma'nosiz,
        // darrov keyingi (lite) modelga o'tamiz.
        if (msg === "timeout") break;
        // ⚠️ 429 (2026-08-02 tuzatildi): ilgari bu ham darrov tashlanardi
        // ("kvota modelga bog'liq emas" degan taxmin bilan). Aslida limit HAR
        // MODEL uchun alohida — flash tugaganda lite hali ishlaydi. Shuning
        // uchun endi zanjirdagi keyingi modelga o'tamiz va faqat hammasi
        // 429 bergandagina xato qaytaramiz (podkast/video kabi ko'p bosqichli
        // generatsiya bitta 429 dan butunlay yiqilmasin).
        if (status === 429) break;
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

interface ImageOpts { kind: string; topicId?: number; departmentId?: number | null; userId?: number | null }

/**
 * Rasm generatsiyasi — provider ZANJIRI. Default Gemini (Nano Banana Pro —
 * belgilangan tibbiy atlas sifati), lekin u YIQILSA zanjir davom etadi.
 *
 * ⚠️ 2026-08-02 (buyurtmachi: "в некоторых презентации слайды не видны, только
 * текст"): ilgari bitta urinish edi — kvota tugasa yoki kalit ishlamasa slot
 * ERROR bo'lardi va slayd BUTUNLAY matnli qolardi. Endi birinchi provayder
 * ishlamasa keyingisi sinaladi (`pollinations` — kalitsiz, bepul). Sifat past
 * bo'lsa ham, BO'SH slayddan yaxshi; o'qituvchi xohlagan slaydni Nano Banana
 * bilan qayta chiza oladi.
 */
export async function generateImage(prompt: string, opts: ImageOpts): Promise<GeneratedImage> {
  const primary = imageProvider();
  const chain: ImageProviderName[] = [primary];
  for (const p of ["gemini", "pollinations"] as const) if (!chain.includes(p)) chain.push(p);

  let lastErr: unknown;
  for (const provider of chain) {
    try {
      if (provider === "openai") {
        const cfg = openaiImageConfig();
        if (!cfg) continue;
        return await generateImageOpenAI(prompt, opts, cfg);
      }
      if (provider === "pollinations") return await generateImagePollinations(prompt, opts);
      // Kafedra kaliti ham, umumiy kalit ham yo'q → keyingi provayderga (pollinations).
      if (!(await resolveGeminiKey(opts.departmentId))) continue;
      return await generateImageGemini(prompt, opts);
    } catch (err) {
      lastErr = err;
      console.warn(`[ai] image provider "${provider}" failed:`, (err as Error)?.message);
      // Kafedra kaliti buzuq: material mazmunini uchinchi tomon xizmatiga (pollinations)
      // yubormaymiz va o'qituvchi sababni darrov ko'radi.
      if (isKeyFatal(err)) throw err;
    }
  }
  throw lastErr instanceof ApiError
    ? lastErr
    : new ApiError(502, "ai_no_image", "Rasm yaratilmadi", "Изображение не создано");
}

/** Generates a single image via Nano Banana Pro. Logs one AiUsage row. */
async function generateImageGemini(prompt: string, opts: ImageOpts): Promise<GeneratedImage> {
  const ai = await getClient(opts.departmentId);
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
  const ai = await getClient(opts.departmentId);
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
      if (isAuthError(err)) throw toApiError(err);
      if (attempt < MAX_TTS_ATTEMPTS) await sleep(1500 * attempt);
    }
  }
  throw toApiError(lastErr);
}
