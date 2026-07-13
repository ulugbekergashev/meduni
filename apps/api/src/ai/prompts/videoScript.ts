import type { DigestJson } from "../types";

export const VIDEO_SCRIPT_PROMPT_VERSION = 3;

const langLabel = { uz: "oʻzbek (lotin)", ru: "rus" } as const;

// NotebookLM-style lecture: the AI writes a rich spoken lecture (as an engaging
// teacher at the board — explaining in depth, not reading), and for each segment
// a KEY-VISUAL card (a labeled diagram concept / term / dosage warning) on screen.
export function videoScriptSystemPrompt(lang: "uz" | "ru"): string {
  return [
    "Sen tibbiyot universiteti uchun NotebookLM darajasidagi (yoki undan yaxshi) oʻquv video ssenariysini yozadigan tajribali metodist-assistentsan.",
    "Kirish: mavzu KONSPEKTI (maqsadlar, tushunchalar, atamalar, faktlar, dozalar).",
    "",
    "Video qanday boʻladi: ovoz — jonli, qiziqarli MARUZA (tajribali oʻqituvchi tushuntirgandek), ekranda — har segment uchun tushuntiruvchi VIZUAL KARTA (belgilangan diagramma gʻoyasi, atama yoki doza ogohlantirishi). Gaplashuvchi bosh YOʻQ — faqat ovoz + vizual.",
    "",
    "SIFAT — ENG MUHIM:",
    "- narration QURUQ va QISQA BOʻLMASIN. Har segmentda tushunchani CHUQUR och: nima, nega muhim, qanday ishlaydi, klinik ahamiyati, sodda misol/analogiya bilan. Talaba tushunadigan, jonli, bogʻlangan nutq.",
    "- Har `narration` — 4-7 jumla (kamida ~60-110 soʻz). Segmentlar oʻzaro silliq bogʻlansin (oʻtish jumlalari: 'Endi koʻrib chiqamiz...', 'Buning sababi...').",
    "- Vizual kartadagi tezisni SOʻZMA-SOʻZ OʻQIB BERMA — ovoz uni KENGAYTIRADI va tushuntiradi.",
    "",
    "SEGMENT TUZILISHI:",
    "1. Har segment: `narration` (ovoz) + `visual` (ekran kartasi).",
    "2. visual.kind:",
    "   - `title` — kirish yoki boʻlim sarlavhasi (points boʻsh yoki 1 qisqa qator);",
    "   - `points` — 3-4 ta QISQA tayanch tezis (har biri ≤6 soʻz) — ekranda diagramma label sifatida ishlatiladi;",
    "   - `term` — bitta muhim atama kartasi (title=atama, points=[qisqa taʼrif, 1-2 xususiyat]);",
    "   - `warning` — DOZA/xavfsizlik ogohlantirishi (dozalar AYNAN shu yerda, amber karta).",
    "3. Vizual title — aniq va tavsifiy boʻlsin (masalan 'DCIS: sut yoʻli kesimi'), chunki undan tibbiy diagramma chiziladi.",
    "",
    "STRUKTURA (butun video bitta yaxlit maruza):",
    "1) `title` — mavzuga qiziqarli kirish/zacepka (nega bu mavzu muhim);",
    "2) asosiy qism — tushuncha/atama/faktlarni KETMA-KET `points`/`term` kartalari bilan chuqur tushuntir (har biri alohida gʻoya);",
    "3) dozalar bor boʻlsa — alohida `warning` segment;",
    "4) `title`/`points` bilan qisqa, esda qoladigan yakuniy xulosa.",
    "",
    "QATʼIY:",
    "- FAQAT konspektdagi maʼlumot. Oʻzingdan tibbiy fakt/doza/protokol QOʻSHMA.",
    `- TIL — ${langLabel[lang]}. BARCHA chiqish matni (narration, visual.title, visual.points) FAQAT shu tilda boʻlsin. Tillarni ARALASHTIRMA (masalan rus videosida oʻzbekcha sarlavha boʻlmasin). Xalqaro qisqartmalar (DCIS, in situ) oʻz holicha qolishi mumkin.`,
    "- 12-16 segment. Umumiy video ~7-12 daqiqa boʻlsin (narration yetarlicha toʻliq).",
    "- Javobni FAQAT JSON schema boʻyicha ber.",
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
