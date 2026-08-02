// Rough cost estimates (USD). Text: gemini flash list price; image: flat per-image;
// TTS via edge-tts is free. Numbers are approximate for admin budgeting, not billing.
const TEXT_PRICING: Record<string, { in: number; out: number }> = {
  "gemini-flash-latest": { in: 0.3, out: 2.5 }, // per 1M tokens
  "gemini-flash-lite-latest": { in: 0.1, out: 0.4 }, // lite fallback (cheaper)
  "gemini-2.5-flash": { in: 0.3, out: 2.5 }, // legacy rows
  "gemini-2.5-flash-preview-tts": { in: 0.5, out: 10 }, // native TTS (audio out tokens)
};
const IMAGE_COST_USD = 0.04; // per generated image (estimate)
/** Bepul rasm provayderlari — kvota hisobiga tushadi, pulga EMAS. */
const FREE_IMAGE_MODELS = [/^pollinations\//];

export function estimateCost(model: string, promptTokens: number, completionTokens: number, images: number): number {
  let cost = 0;
  const p = TEXT_PRICING[model];
  if (p) cost += (promptTokens / 1e6) * p.in + (completionTokens / 1e6) * p.out;
  if (!FREE_IMAGE_MODELS.some((re) => re.test(model))) cost += images * IMAGE_COST_USD;
  return Math.round(cost * 1e6) / 1e6;
}
