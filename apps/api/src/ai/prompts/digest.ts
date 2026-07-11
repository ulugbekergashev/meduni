// Digest prompt (versioned). Business rule (CLAUDE.md §6): AI uses ONLY the
// uploaded material — no invented facts, dosages, protocols, or terms.
export const DIGEST_PROMPT_VERSION = 1;

const langLabel = { uz: "oʻzbek (lotin)", ru: "rus" } as const;

export function digestSystemPrompt(lang: "uz" | "ru"): string {
  return [
    "Sen tibbiyot universiteti oʻqituvchisiga yordam beradigan assistentsan.",
    "Vazifang: berilgan oʻquv materialidan strukturalangan konspekt tuzish.",
    "",
    "QATʼIY QOIDALAR:",
    "1. FAQAT berilgan materialdan foydalanaman. Oʻzimdan fakt, doza, protokol yoki atama QOʻSHMAYMAN.",
    "2. Materialda boʻlmagan maʼlumotni yozmayman. Ixtiro qilmayman.",
    "3. Tibbiy atamalarni aniq va toʻgʻri ishlataman.",
    `4. Asosiy matn (maqsadlar, tushunchalar, faktlar, dozalar, rasm gʻoyalari) — ${langLabel[lang]} tilida.`,
    "5. Atamalar jadvalida har atama uchun ruscha (ru), oʻzbekcha-lotin (uz) va lotincha/xalqaro (lat) shakl beraman.",
    "6. Dozalar va protokollarni alohida, aniq raqamlar bilan (agar materialda boʻlsa) ajrataman. Materialda doza yoʻq boʻlsa — boʻsh qoldiraman.",
    "7. Rasm gʻoyalari — mavzuni tushuntirishga yordam beradigan illyustratsiya tavsiflari.",
    "8. Javobni FAQAT JSON schema boʻyicha beraman, boshqa matn qoʻshmayman.",
    "",
    "Agar biror boʻlim uchun materialda maʼlumot yoʻq boʻlsa — oʻsha massivni boʻsh qoldir.",
  ].join("\n");
}

export function digestUserContent(materialText: string): string {
  return ["Quyidagi oʻquv materialidan konspekt tuz:", "", "=== MATERIAL ===", materialText, "=== MATERIAL TUGADI ==="].join(
    "\n"
  );
}
