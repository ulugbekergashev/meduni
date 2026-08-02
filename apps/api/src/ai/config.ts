// Ko'p-provayderli AI qatlami sozlamalari (env'dan). MUHIM: default = HAMMASI
// GEMINI — hech qanday env qo'yilmasa xatti-harakat AYNAN eskisidek (nol o'zgarish).
// Open/arzon modellar faqat env berilganda YOQILADI, va matn yo'nalishida Gemini
// fallback saqlanadi (open model ishlamasa jimgina Gemini'ga qaytadi).
//
// TAVSIYA (xavfsizlik): faqat past-riskli vazifalarni open modelga yo'naltiring —
// TUTOR (chat), PATIENT / PATIENT_EVAL (virtual bemor). Tibbiy generatsiyani
// (DIGEST/QUIZ/CASE/FACTCHECK/SLIDES) va rasmni ishonchli modelda qoldiring.
//
// Env:
//   AI_TEXT_PROVIDER      = gemini | openai            (global default, def gemini)
//   AI_TEXT_ROUTES        = "PATIENT:openai,TUTOR:openai"  (kind bo'yicha override)
//   AI_IMAGE_PROVIDER     = gemini | openai | pollinations   (def gemini)
//   AI_TTS_PROVIDER       = gemini | edge              (def gemini; edge = bepul)
//   OPENAI_BASE_URL       = https://openrouter.ai/api/v1   (OpenAI-mos endpoint)
//   OPENAI_API_KEY        = ...
//   OPENAI_MODEL          = moonshotai/kimi-k2 | meta-llama/llama-3.3-70b | ...
//   OPENAI_MODEL_LITE     = ... (preferLite uchun; berilmasa OPENAI_MODEL)
//   OPENAI_IMAGE_MODEL    = ... (rasm uchun; AI_IMAGE_PROVIDER=openai bo'lsa)

export type Provider = "gemini" | "openai";
/** Rasm provayderi: `pollinations` — kalitsiz BEPUL (flux). Sifat Nano Banana'dan
 *  past (ko'p yorliqli tibbiy diagrammada matn buziladi), lekin BO'SH slayddan
 *  yaxshiroq — shuning uchun u FALLBACK sifatida ham ishlatiladi. */
export type ImageProviderName = Provider | "pollinations";
/** Ovoz provayderi: `edge` — Microsoft edge-tts (bepul, python moduli orqali). */
export type TtsProvider = "gemini" | "edge";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/** Kind → matn provayderi (route override, keyin global default). */
export function textProviderFor(kind: string): Provider {
  const routes = env("AI_TEXT_ROUTES");
  if (routes) {
    for (const pair of routes.split(",")) {
      const [k, p] = pair.split(":").map((s) => s.trim());
      if (k && k.toUpperCase() === kind.toUpperCase() && (p === "openai" || p === "gemini")) return p;
    }
  }
  return env("AI_TEXT_PROVIDER") === "openai" ? "openai" : "gemini";
}

export interface OpenAiTextConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  modelLite: string;
}

/** OpenAI-mos matn krediti — kredit yo'q bo'lsa null (→ Gemini fallback). */
export function openaiTextConfig(): OpenAiTextConfig | null {
  const baseUrl = env("OPENAI_BASE_URL");
  const apiKey = env("OPENAI_API_KEY");
  const model = env("OPENAI_MODEL");
  if (!baseUrl || !apiKey || !model) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model, modelLite: env("OPENAI_MODEL_LITE") ?? model };
}

export function imageProvider(): ImageProviderName {
  const v = env("AI_IMAGE_PROVIDER");
  if (v === "openai" || v === "pollinations") return v;
  return "gemini";
}

/** Ovoz: `AI_TTS_PROVIDER=edge` bo'lsa BEPUL edge-tts birinchi bo'ladi
 *  (Gemini TTS baribir fallback sifatida qoladi — `synthSegment`). */
export function ttsProvider(): TtsProvider {
  return env("AI_TTS_PROVIDER") === "edge" ? "edge" : "gemini";
}

export interface OpenAiImageConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function openaiImageConfig(): OpenAiImageConfig | null {
  const baseUrl = env("OPENAI_BASE_URL");
  const apiKey = env("OPENAI_API_KEY");
  const model = env("OPENAI_IMAGE_MODEL");
  if (!baseUrl || !apiKey || !model) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model };
}
