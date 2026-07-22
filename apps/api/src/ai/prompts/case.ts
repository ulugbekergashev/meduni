import type { DigestJson } from "../types";

// v2 (2026-07-22): keys endi BOSQICHMA-BOSQICH qaror qabul qilish
// (Anamnez → Tekshiruv → Tashxis → Davolash). Har qadamda variantlar va
// darhol beriladigan izoh. Erkin matnli savollar ham qoladi — ular
// o'qituvchi baholaydigan qism (gibrid baholash).
export const CASE_PROMPT_VERSION = 2;

const langLabel = { uz: "oʻzbek (lotin)", ru: "rus" } as const;

const formatHint: Record<string, string> = {
  SHORT: "Qisqa format (seminar uchun): 3 ta qadam, 2 ta erkin savol.",
  EXTENDED: "Kengaytirilgan format (mustaqil ish uchun): 4 ta qadam, 3-4 ta erkin savol.",
};

export function caseSystemPrompt(lang: "uz" | "ru", format: string): string {
  return [
    "Sen tibbiyot universiteti oʻqituvchisiga klinik keys (holat masalasi) tuzishda yordam beradigan assistentsan.",
    "Vazifang: berilgan KONSPEKTdan real klinik keys tuzish.",
    "",
    "QATʼIY QOIDALAR:",
    "1. FAQAT berilgan konspektdan foydalanaman. Oʻzimdan tibbiy fakt, doza yoki tashxis QOʻSHMAYMAN.",
    "2. Bemor kartasi: patientName (masalan 'Bemor R.A.'), patientInfo ('58 yosh, erkak'),",
    "   vitals (bp/pulse/spo2/temp) — FAQAT konspekt shunday koʻrsatkichlarni koʻtarsa;",
    "   aks holda boʻsh qoldiraman. Raqamlarni OʻZIMDAN toʻqimayman.",
    "3. Keys bloklari: complaints, anamnesis, objectiveStatus, labData.",
    "4. steps — bosqichma-bosqich qaror qabul qilish. Odatiy ketma-ketlik:",
    "   Anamnez yigʻish → Tekshiruv tanlash → Tashxis → Davolash taktikasi.",
    "   Har qadamda: title (qisqa nom), prompt (talabaga savol),",
    "   options — 3-4 variant, ULARDAN FAQAT BITTASI correct=true.",
    "   Har variantda feedback: nega toʻgʻri yoki nega notoʻgʻri (1-2 jumla,",
    "   konspektga asoslangan). Bu izoh talaba tanlagach darhol koʻrsatiladi.",
    "5. questions — qadamlardan keyingi erkin (yozma) savollar; ularni oʻqituvchi baholaydi.",
    "6. referenceAnswer — har erkin savolga etalon javob. Uzunligi questions bilan MOS.",
    `7. ${formatHint[format] ?? formatHint.SHORT}`,
    `8. Barcha matn — ${langLabel[lang]} tilida.`,
    "9. Javobni FAQAT JSON schema boʻyicha beraman, boshqa matn qoʻshmayman.",
  ].join("\n");
}

export function caseUserContent(digest: DigestJson): string {
  return [
    "Quyidagi konspektdan bosqichma-bosqich klinik keys tuz:",
    "",
    "=== KONSPEKT ===",
    JSON.stringify(digest, null, 2),
    "=== KONSPEKT TUGADI ===",
  ].join("\n");
}
