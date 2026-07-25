// OpenAI-mos (Chat Completions) strukturali JSON generatsiyasi — OpenRouter,
// Together, Groq, vLLM va boshqalar. JSON schema Gemini formatida bo'lgani uchun
// bu yerda `response_format: json_object` + system-promptdagi "JSON only" qoidasi
// ishlatiladi; chiqishni zod (chaqiruvchi tomonda) validatsiya qiladi.
import { ApiError } from "../../lib/errors";
import { recordAiUsage } from "../usage";
import type { OpenAiTextConfig } from "../config";
import type { GenerateOpts } from "../textTypes";

const TIMEOUT_MS = 90_000;
const ATTEMPTS = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** OpenAI-mos endpointdan strukturali JSON. Xatoda tashlaydi (router Gemini'ga qaytadi). */
export async function generateStructuredOpenAI<T>(opts: GenerateOpts, cfg: OpenAiTextConfig): Promise<T> {
  const model = opts.preferLite ? cfg.modelLite : cfg.model;
  const body = {
    model,
    messages: [
      { role: "system", content: opts.systemInstruction },
      { role: "user", content: `${opts.userContent}\n\nJavobni FAQAT yaroqli JSON obyekt sifatida ber (boshqa matn, izoh yoki markdown YO'Q).` },
    ],
    response_format: { type: "json_object" as const },
    temperature: 0.4,
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const status = res.status;
        // 401/403/429 o'z-o'zidan tuzalmaydi — darrov tashlaymiz (router Gemini'ga).
        if (status === 401 || status === 403 || status === 429) {
          throw new ApiError(502, "ai_openai_error", "Open model kaliti/limiti", "Ключ/лимит open-модели");
        }
        throw new Error(`openai http ${status}`);
      }
      const json = (await res.json()) as ChatResponse;
      const content = json.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) throw new Error("openai empty content");

      await recordAiUsage({
        kind: opts.kind,
        model,
        topicId: opts.topicId,
        departmentId: opts.departmentId,
        userId: opts.userId,
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
      });

      // Ba'zi modellar JSON'ni ```json ... ``` bilan o'raydi — tozalaymiz.
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      return JSON.parse(cleaned) as T;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err instanceof ApiError) throw err; // auth/limit — fallback qilinsin
      if (attempt < ATTEMPTS) await sleep(1000 * attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("openai text failed");
}
