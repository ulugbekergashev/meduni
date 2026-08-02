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

/**
 * MATN ZANJIRI (2026-08-03, buyurtmachi: "geminini faqat rasm va TTS uchun
 * ishlat, matnni bepul modellar qilsin").
 *
 * Bitta provayder yetarli emas: bepul tariflarда tez-tez 429 (rate limit) va
 * vaqtinchalik uzilish bo'ladi. Shuning uchun bir nechta krediт ketma-ket
 * sinaladi va faqat HAMMASI yiqilsa xato qaytadi.
 *
 * Env (nomlar erkin, har biri OpenAI-mos endpoint):
 *   AI_TEXT_CHAIN = "free1,free2,gemini"   ← tartib
 *   FREE1_BASE_URL / FREE1_API_KEY / FREE1_MODEL [/ FREE1_MODEL_LITE]
 *   FREE2_BASE_URL / FREE2_API_KEY / FREE2_MODEL [/ FREE2_MODEL_LITE]
 * Eski `OPENAI_*` slot ham qo'llanadi (nomi `openai`).
 *
 * Berilmasa — zanjir `gemini` (eski xatti-harakat, nol o'zgarish).
 */
export interface TextLink {
  /** Diagnostika uchun nom (log/AiUsage). */
  name: string;
  /** null → Gemini (SDK orqali), aks holda OpenAI-mos endpoint. */
  cfg: OpenAiTextConfig | null;
}

function slotConfig(prefix: string): OpenAiTextConfig | null {
  const baseUrl = env(`${prefix}_BASE_URL`);
  const apiKey = env(`${prefix}_API_KEY`);
  const model = env(`${prefix}_MODEL`);
  if (!baseUrl || !apiKey || !model) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model,
    modelLite: env(`${prefix}_MODEL_LITE`) ?? model,
  };
}

export function textChain(kind: string): TextLink[] {
  const raw = env("AI_TEXT_CHAIN");
  if (!raw) {
    // Zanjir berilmagan — eski yo'l: route/global default bo'yicha bitta provayder
    // (+ openai bo'lsa Gemini zaxira).
    return textProviderFor(kind) === "openai" && openaiTextConfig()
      ? [{ name: "openai", cfg: openaiTextConfig() }, { name: "gemini", cfg: null }]
      : [{ name: "gemini", cfg: null }];
  }
  const links: TextLink[] = [];
  for (const rawName of raw.split(",")) {
    const name = rawName.trim();
    if (!name) continue;
    if (name.toLowerCase() === "gemini") {
      links.push({ name: "gemini", cfg: null });
      continue;
    }
    const cfg = name.toLowerCase() === "openai" ? openaiTextConfig() : slotConfig(name.toUpperCase());
    // Krediti yo'q slot jimgina o'tkazib yuboriladi (env yarim to'ldirilgan bo'lsa).
    if (cfg) links.push({ name, cfg });
  }
  // Zanjir bo'sh qolmasin — oxirgi chora sifatida Gemini.
  if (!links.length) links.push({ name: "gemini", cfg: null });
  return links;
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
