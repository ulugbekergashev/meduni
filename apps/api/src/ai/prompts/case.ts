import type { DigestJson } from "../types";

export const CASE_PROMPT_VERSION = 1;

const langLabel = { uz: "oʻzbek (lotin)", ru: "rus" } as const;

const formatHint: Record<string, string> = {
  SHORT: "Qisqa format (seminar uchun): 2-3 ta savol, ixcham bloklar.",
  EXTENDED: "Kengaytirilgan format (mustaqil ish uchun): 4-6 ta savol, batafsil bloklar.",
};

export function caseSystemPrompt(lang: "uz" | "ru", format: string): string {
  return [
    "Sen tibbiyot universiteti oʻqituvchisiga klinik keys (holat masalasi) tuzishda yordam beradigan assistentsan.",
    "Vazifang: berilgan KONSPEKTdan real klinik keys tuzish.",
    "",
    "QATʼIY QOIDALAR:",
    "1. FAQAT berilgan konspektdan foydalanaman. Oʻzimdan tibbiy fakt, doza yoki tashxis QOʻSHMAYMAN.",
    "2. Keys tuzilishi: complaints (shikoyatlar), anamnesis (anamnez), objectiveStatus (obyektiv holat), labData (laboratoriya/instrumental).",
    "3. questions — talabaga beriladigan savollar (ehtimoliy tashxis, differensial diagnoz, qoʻshimcha tekshiruvlar, davolash taktikasi).",
    "4. referenceAnswer — har savolga etalon (toʻgʻri) javob, konspektga asoslangan. Uzunligi questions bilan mos.",
    `5. ${formatHint[format] ?? formatHint.SHORT}`,
    `6. Barcha matn — ${langLabel[lang]} tilida.`,
    "7. Javobni FAQAT JSON schema boʻyicha beraman, boshqa matn qoʻshmayman.",
  ].join("\n");
}

export function caseUserContent(digest: DigestJson): string {
  return ["Quyidagi konspektdan klinik keys tuz:", "", "=== KONSPEKT ===", JSON.stringify(digest, null, 2), "=== KONSPEKT TUGADI ==="].join(
    "\n"
  );
}
