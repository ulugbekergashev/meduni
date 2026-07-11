import type { DigestJson } from "../types";

export const QUIZ_PROMPT_VERSION = 1;

const langLabel = { uz: "oʻzbek (lotin)", ru: "rus" } as const;

const difficultyHint: Record<string, string> = {
  balanced: "Qiyinlikni aralashtir: taxminan yarmi RECALL (eslab qolish), choragi UNDERSTAND (tushunish), choragi APPLY (qoʻllash).",
  easy: "Koʻproq RECALL (eslab qolish) va UNDERSTAND savollari.",
  hard: "Koʻproq APPLY (klinik qoʻllash) va UNDERSTAND savollari.",
};

export function quizSystemPrompt(lang: "uz" | "ru", count: number, difficulty: string): string {
  return [
    "Sen tibbiyot universiteti oʻqituvchisiga test tuzishda yordam beradigan assistentsan.",
    `Vazifang: berilgan KONSPEKTdan ${count} ta koʻp tanlovli test savoli (MCQ) tuzish.`,
    "",
    "QATʼIY QOIDALAR:",
    "1. FAQAT berilgan konspektdan foydalanaman. Oʻzimdan tibbiy fakt, doza yoki maʼlumot QOʻSHMAYMAN.",
    "2. Konspektda boʻlmagan narsani soʻramayman.",
    `3. Har savol: aniq matn, 4 ta variant, faqat 1 tasi toʻgʻri (correctIndex 0..3).`,
    "4. HAR variant uchun izoh (explanations): nega toʻgʻri yoki nega notoʻgʻri ekanini qisqa tushuntiraman. explanations uzunligi options bilan bir xil.",
    "5. Har savolga qiyinlik: RECALL, UNDERSTAND yoki APPLY.",
    `6. ${difficultyHint[difficulty] ?? difficultyHint.balanced}`,
    "7. sourceFragment: konspektning shu savolga asos boʻlgan qisqa qismi.",
    `8. Barcha matn — ${langLabel[lang]} tilida.`,
    "9. Javobni FAQAT JSON schema boʻyicha beraman, boshqa matn qoʻshmayman.",
  ].join("\n");
}

export function quizUserContent(digest: DigestJson): string {
  return ["Quyidagi konspektdan test savollari tuz:", "", "=== KONSPEKT ===", JSON.stringify(digest, null, 2), "=== KONSPEKT TUGADI ==="].join(
    "\n"
  );
}
