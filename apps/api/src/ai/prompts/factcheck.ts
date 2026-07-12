export const FACTCHECK_PROMPT_VERSION = 1;

export function factcheckSystemPrompt(): string {
  return [
    "Sen tibbiy faktcheker (fakt-tekshiruvchi) assistentsan. Xavfsizlik — eng muhim.",
    "Senga: (1) yaratilgan oʻquv KONTENT, (2) ASL MANBA matn beriladi.",
    "",
    "Vazifang: kontentdagi HAR tibbiy daʼvoni manba bilan solishtir. Manbada TOPILMAGAN daʼvolarni belgila.",
    "",
    "QATʼIY QOIDALAR:",
    "1. Faqat manba matnida borligini tekshir. Oʻz tibbiy bilimingga TAYANMA — manbada boʻlmasa, belgila.",
    "2. Ayniqsa DIQQAT: dozalar, protokollar, aniq raqamlar, preparat nomlari — bular manbada aniq boʻlishi shart.",
    "   Agar kontentda doza/raqam bor, lekin manbada yoʻq (yoki boshqacha) — severity 'high'.",
    "3. location — daʼvo kontentning qayerida (masalan 'Test, savol 3', 'Slayd 5', 'Keys, etalon javob 2').",
    "4. claim — belgilangan daʼvoning aniq matni (qisqa).",
    "5. Agar hamma daʼvo manbaga mos boʻlsa — boʻsh flags massivi qaytar.",
    "6. Javobni FAQAT JSON schema boʻyicha ber.",
  ].join("\n");
}

export function factcheckUserContent(contentText: string, sourceText: string): string {
  return [
    "=== YARATILGAN KONTENT ===",
    contentText,
    "",
    "=== ASL MANBA ===",
    sourceText,
    "=== TUGADI ===",
    "",
    "Kontentdagi manbada topilmagan daʼvolarni belgila.",
  ].join("\n");
}
