// TEST BAHOLASHNING YAGONA MANBAI (2026-10-31 auditi).
//
// Nima uchun alohida fayl: 2026-10-31 xatosi ("to'g'ri javobni belgilasa ham
// noto'g'ri deyapti") bitta qatordan emas, tarqoq javoblardan kelib chiqdi.
// Audit "bu urinishga qaysi savollar tegishli?" degan savolga kodda UCH XIL
// javob topdi:
//   · baholash va natija ekrani — testning HOZIRGI savollari;
//   · mashg'ulotlar (xatolar ustida ishlash) — eskirganlari BILAN birga hammasi;
//   · o'qituvchi xatolar xaritasi — hammasi;
//   · tuzatish skripti — urinishning O'Z snimkasi (yagona to'g'risi).
// O'qituvchi testni qayta yaratsa, birinchi uchtasi turli raqamlar chiqarardi:
// davom etayotgan urinish bo'sh ekranga aylanardi, mashg'ulot esa talaba
// hech ko'rmagan YANGI savollarning to'g'ri javobini ochib berardi.
//
// QOIDA: urinish bilan ishlaydigan HAR QANDAY kod savollarni shu fayldagi
// `attemptQuestions` dan oladi va `gradeAnswers` bilan baholaydi. O'zing
// `quiz.questions` ni olib `answers[q.id] === q.correctIndex` yozma.
import { prisma } from "../../lib/prisma";
import { readAnswers, readOrder, type OriginalIndex, type StoredAnswers } from "./integrity";

export interface GradableQuestion {
  id: number;
  correctIndex: number;
}

/** Urinish qatori — snimkani tiklash uchun yetarli minimum. */
export interface AttemptSnapshotRow {
  quizId: number;
  orderJson?: unknown;
  answersJson?: unknown;
}

/**
 * Urinish snimkasidagi savol id'lari, ekran tartibida.
 * Snimkasiz (2026-08-11 dan oldingi) urinish → u JAVOB BERGAN savollar.
 * "Testning hozirgi savollari" deb olish xavfli: test keyin qayta yaratilgan
 * bo'lsa, bu talaba hech ko'rmagan YANGI savollar bo'lib chiqadi (sinovda
 * ushlandi — kartochka ularning javobini ochib bergan). Javoblari ham yo'q
 * bo'lsa (bo'sh urinish) — hozirgi savollar.
 */
export function snapshotQuestionIds(attempt: AttemptSnapshotRow, currentIds: number[]): number[] {
  const order = readOrder(attempt.orderJson);
  if (order) return order.q;
  const answered = Object.keys(readAnswers(attempt.answersJson)).map(Number);
  return answered.length ? answered : currentIds;
}

/**
 * Urinish ko'rgan savollar — ESKIRGANLARI (retiredAt) HAM. O'qituvchi testni
 * keyin tahrirlasa ham talaba aynan o'zi yechgan variant bo'yicha baholanadi.
 * `current` — chaqiruvchida allaqachon bor savollar (qayta so'ramaslik uchun).
 */
export async function attemptQuestions<Q extends { id: number }>(
  attempt: AttemptSnapshotRow,
  current: Q[],
  load: (ids: number[]) => Promise<Q[]>
): Promise<Q[]> {
  const ids = snapshotQuestionIds(
    attempt,
    current.map((q) => q.id)
  );
  const byId = new Map(current.map((q) => [q.id, q]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) for (const q of await load(missing)) byId.set(q.id, q);
  return ids.map((id) => byId.get(id)).filter((q): q is Q => q !== undefined);
}

/** `attemptQuestions` uchun standart yuklovchi: faqat SHU testning savollari. */
export function questionLoader(quizId: number) {
  return (ids: number[]) =>
    prisma.question.findMany({ where: { id: { in: ids }, quizId }, orderBy: { orderIndex: "asc" } });
}

export interface GradeResult {
  correct: number;
  total: number;
  scorePct: number;
  /** Xato yoki javobsiz qolgan savollar (snimka ichida). */
  wrongIds: number[];
}

/** Bitta formula: savollar urinish snimkasidan, javoblar ASL indeksda. */
export function gradeAnswers(questions: GradableQuestion[], answers: StoredAnswers): GradeResult {
  const wrongIds = questions.filter((q) => !isCorrect(q, answers)).map((q) => q.id);
  const total = questions.length;
  const correct = total - wrongIds.length;
  return { correct, total, scorePct: total === 0 ? 0 : Math.round((correct / total) * 100), wrongIds };
}

export function isCorrect(q: GradableQuestion, answers: StoredAnswers): boolean {
  const a: OriginalIndex | undefined = answers[String(q.id)];
  return a !== undefined && a === q.correctIndex;
}

export { readAnswers };

// ---------- Klinik keys qadamlari ----------

/**
 * Keys qadamida tanlangan variant to'g'rimi — YAGONA tekshiruv.
 * Ilgari baholash (submitCase) "tanlangan variant correct:true mi" deb
 * tekshirardi, mashg'ulot/o'qituvchi xaritasi/AI tavsiyasi esa "BIRINCHI
 * to'g'ri variant indeksiga tengmi" deb. Qadamda ikkita to'g'ri variant bo'lsa,
 * talaba bahoda "to'g'ri", qolgan uch joyda "xato" ko'rinardi.
 */
export function isStepCorrect(step: { options: { correct: boolean }[] }, picked: number | undefined): boolean {
  return picked !== undefined && Number.isInteger(picked) && step.options[picked]?.correct === true;
}

// ---------- Klinik keys: javob bilan birga keys SNIMKASI ----------
//
// Keys javobi (`stepsJson` — qadam indeksi → variant indeksi, `answersJson` —
// savollar tartibida) POZITSION. O'qituvchi keysni keyin tahrirlasa yoki qayta
// yaratsa, eski javoblar yangi qadam/savollarga tushib qolardi: talaba boshqa
// savolga javob bergandek ko'rinar, o'qituvchi uni noto'g'ri savol bo'yicha
// baholardi. Endi topshirishda keysning o'sha paytdagi nusxasi `stepsJson`
// ichida (`__case` kaliti) saqlanadi — yangi ustun/migratsiyasiz. Javobni
// ko'rsatadigan va baholaydigan HAR joy keysni `attemptCase` dan oladi.

const CASE_SNAPSHOT_KEY = "__case";

/** stepsJson'dagi qadam tanlovlari (faqat raqamli kalitlar). */
export function readStepPicks(stepsJson: unknown): Record<string, number> {
  if (!stepsJson || typeof stepsJson !== "object" || Array.isArray(stepsJson)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(stepsJson as Record<string, unknown>)) {
    if (/^\d+$/.test(k) && Number.isInteger(v)) out[k] = v as number;
  }
  return out;
}

/** Talaba yechgan keys versiyasi; snimkasiz eski javob → keysning hozirgi holati. */
export function attemptCase<T>(stepsJson: unknown, current: T): T {
  if (!stepsJson || typeof stepsJson !== "object" || Array.isArray(stepsJson)) return current;
  const snap = (stepsJson as Record<string, unknown>)[CASE_SNAPSHOT_KEY];
  return snap && typeof snap === "object" ? (snap as T) : current;
}

/** Topshirishda yoziladigan stepsJson: tanlovlar + keys nusxasi. */
export function stepsWithSnapshot(picks: Record<string, number>, caseJson: unknown): Record<string, unknown> {
  return { ...picks, [CASE_SNAPSHOT_KEY]: caseJson };
}
