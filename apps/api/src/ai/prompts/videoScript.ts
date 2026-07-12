import type { Slide } from "../types";

export const VIDEO_SCRIPT_PROMPT_VERSION = 1;

const langLabel = { uz: "oʻzbek (lotin)", ru: "rus" } as const;

export function videoScriptSystemPrompt(lang: "uz" | "ru"): string {
  return [
    "Sen tibbiyot universiteti oʻqituvchisiga oʻquv video uchun ovoz skripti (narration) yozadigan assistentsan.",
    "Kirish: taqdimot slaydlari (sarlavha + tezislar).",
    "",
    "QATʼIY QOIDALAR:",
    "1. Slaydni SOʻZMA-SOʻZ OʻQIB BERMA. Tezisni tushuntir, kengaytir, misol bilan izohla — jonli, soʻzlashuv uslubida (xuddi oʻqituvchi tushuntirgandek).",
    "2. Har slayd uchun alohida narration (segments massivida slideIndex boʻyicha).",
    "3. FAQAT slaydlardagi maʼlumotdan foydalan. Oʻzingdan tibbiy fakt/doza qoʻshma.",
    `4. Til — ${langLabel[lang]}. Tibbiy atamalarni toʻgʻri ishlat.`,
    "5. Har narration 2-5 jumla (slayd mazmuniga qarab). Umumiy video 8-12 daqiqa boʻlsin.",
    "6. TITLE slaydi uchun — qisqa kirish/tanishtiruv.",
    "7. Javobni FAQAT JSON schema boʻyicha ber.",
  ].join("\n");
}

export function videoScriptUserContent(slides: Slide[]): string {
  const compact = slides.map((s, i) => ({ slideIndex: i, layout: s.layout, title: s.title, bullets: s.bullets }));
  return ["Quyidagi slaydlar uchun ovoz skriptini yoz:", "", "=== SLAYDLAR ===", JSON.stringify(compact, null, 2), "=== TUGADI ==="].join(
    "\n"
  );
}
