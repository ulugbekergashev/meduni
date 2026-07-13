import type { DigestJson } from "../types";

export const VIDEO_SCRIPT_PROMPT_VERSION = 2;

const langLabel = { uz: "oʻzbek (lotin)", ru: "rus" } as const;

// NotebookLM-style lecture: the AI writes a spoken mini-lecture (as a teacher at
// the board — explaining, not reading), and for each segment a KEY-VISUAL card
// (short points / a term / a dosage warning) that appears on screen.
export function videoScriptSystemPrompt(lang: "uz" | "ru"): string {
  return [
    "Sen tibbiyot universiteti uchun NotebookLM uslubidagi oʻquv video ssenariysini yozadigan assistentsan.",
    "Kirish: mavzu KONSPEKTI (maqsadlar, tushunchalar, atamalar, faktlar, dozalar).",
    "",
    "Video qanday boʻladi: ovoz — jonli MINI-MARUZA (oʻqituvchi doskada tushuntirgandek), ekranda — QISQA VIZUAL KARTALAR (asosiy tezislar, atama, doza ogohlantirishi). Gaplashuvchi bosh YOʻQ.",
    "",
    "QATʼIY QOIDALAR:",
    "1. Har segment: `narration` (ovoz matni) + `visual` (ekrandagi karta).",
    "2. narration — SOʻZLASHUV uslubida tushuntir, misol/sabab bilan kengaytir. Vizual tezisni SOʻZMA-SOʻZ OʻQIB BERMA — u faqat tayanch.",
    "3. visual.kind:",
    "   - `title` — kirish/boʻlim sarlavhasi (points boʻsh yoki 1 qatorli);",
    "   - `points` — 3-4 ta QISQA tezis (har biri ≤6 soʻz);",
    "   - `term` — bitta atama kartasi (title=atama, points=[qisqa taʼrif]);",
    "   - `warning` — DOZA/xavfsizlik ogohlantirishi (dozalar shu yerda).",
    "4. Tuzilish: 1) `title` bilan kirish/zacepka; 2) tushuncha va faktlarni `points`/`term` kartalari bilan tushuntir; 3) agar dozalar bor boʻlsa — alohida `warning` segment; 4) `title`/`points` bilan yakuniy xulosa.",
    "5. FAQAT konspektdagi maʼlumot. Oʻzingdan tibbiy fakt/doza qoʻshma.",
    `6. Til — ${langLabel[lang]}. Tibbiy atamalarni toʻgʻri ishlat.`,
    "7. 10-16 segment. Har narration 2-5 jumla. Umumiy video ~8-12 daqiqa.",
    "8. Javobni FAQAT JSON schema boʻyicha ber.",
  ].join("\n");
}

export function videoScriptUserContent(digest: DigestJson, slideTitles?: string[]): string {
  const parts = [
    "Quyidagi konspekt asosida video ssenariysini yoz:",
    "",
    "=== MAQSADLAR ===",
    digest.objectives.map((o) => `- ${o}`).join("\n") || "(yoʻq)",
    "=== TUSHUNCHALAR ===",
    digest.concepts.map((c) => `- ${c}`).join("\n") || "(yoʻq)",
    "=== ATAMALAR ===",
    digest.terms.map((tm) => `- ${tm.ru} = ${tm.uz}${tm.lat ? ` (${tm.lat})` : ""}`).join("\n") || "(yoʻq)",
    "=== FAKTLAR ===",
    digest.facts.map((f) => `- ${f}`).join("\n") || "(yoʻq)",
    "=== DOZALAR ===",
    digest.dosages.map((d) => `- ${d}`).join("\n") || "(yoʻq)",
  ];
  if (slideTitles && slideTitles.length) {
    parts.push("=== TAQDIMOT BOʻLIMLARI (struktura uchun ishora) ===", slideTitles.map((s) => `- ${s}`).join("\n"));
  }
  parts.push("=== TUGADI ===");
  return parts.join("\n");
}
