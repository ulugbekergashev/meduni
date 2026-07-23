// Fleshkartalar — takrorlash uchun (foydalanuvchi: "quiz тоже сделай карточки
// после этого, чтобы для повторения").
//
// Kartalar MAVJUD ma'lumotdan hosil qilinadi — alohida AI generatsiyasi va
// o'qituvchi tasdig'i KERAK EMAS:
//   · test savollari  → savol / to'g'ri javob + izoh
//   · konspekt atamalari → atama / ru + lot
//
// ⚠️ Test savollari to'g'ri javobni oshkor qiladi, shuning uchun kartalar
// FAQAT test yakunlangach ochiladi (403 flashcards_locked).
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import type { DigestJson } from "../../ai/types";
import { assertTopicOpen } from "./service";

export interface Flashcard {
  key: string;
  kind: "quiz" | "term";
  front: string;
  back: string;
  /** Qo'shimcha izoh (test savoli uchun — tushuntirish). */
  note: string | null;
  /** Oxirgi takrorlashda "bilaman" deb belgilanganmi (null — hali ko'rilmagan). */
  known: boolean | null;
}

function optionAt(optionsJson: unknown, i: number): string {
  const arr = (optionsJson as string[]) ?? [];
  return arr[i] ?? "";
}

/** Kartalarni yig'adi + qulf holatini qaytaradi. */
async function build(studentId: number, topicId: number) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      digest: true,
      contentItems: {
        where: { status: "PUBLISHED" },
        include: { quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } } },
      },
    },
  });
  if (!topic) throw notFound("Mavzu");

  const quiz = topic.contentItems.find((c) => c.kind === "QUIZ")?.quiz ?? null;

  // Test bor bo'lsa — yakunlangan urinish shart (javoblar oshkor bo'lmasin).
  let locked = false;
  if (quiz) {
    const finished = await prisma.quizAttempt.count({
      where: { studentId, quizId: quiz.id, finishedAt: { not: null } },
    });
    locked = finished === 0;
  }

  const cards: Flashcard[] = [];

  if (quiz && !locked) {
    for (const q of quiz.questions) {
      const explanations = (q.explanationJson as string[]) ?? [];
      cards.push({
        key: `q:${q.id}`,
        kind: "quiz",
        front: q.text,
        back: optionAt(q.optionsJson, q.correctIndex),
        note: explanations[q.correctIndex] ?? null,
        known: null,
      });
    }
  }

  const digest = topic.digest?.approvedByTeacher ? (topic.digest.digestJson as unknown as DigestJson) : null;
  (digest?.terms ?? []).forEach((term, i) => {
    if (!term.uz && !term.ru) return;
    cards.push({
      key: `t:${i}`,
      kind: "term",
      front: term.uz || term.ru,
      back: [term.ru, term.lat].filter(Boolean).join(" · "),
      note: null,
      known: null,
    });
  });

  return { cards, locked, hasQuiz: !!quiz };
}

export async function getFlashcards(studentId: number, topicId: number) {
  await assertTopicOpen(studentId, topicId);
  const { cards, locked, hasQuiz } = await build(studentId, topicId);

  if (locked) {
    return { locked: true, reason: "quiz_not_finished" as const, cards: [], total: 0, knownCount: 0 };
  }

  const reviews = await prisma.flashcardReview.findMany({ where: { studentId, topicId } });
  const byKey = new Map(reviews.map((r) => [r.cardKey, r.known]));
  const withState = cards.map((c) => ({ ...c, known: byKey.get(c.key) ?? null }));

  return {
    locked: false,
    reason: null,
    cards: withState,
    total: withState.length,
    knownCount: withState.filter((c) => c.known === true).length,
    hasQuiz,
  };
}

// Interval takrorlash (Modul 26) — SM-2  soddalashtirilgan: "bilaman" har safar
// keyingi intervalga o'tkazadi, "bilmayman" 1 kunga qaytaradi.
const REVIEW_BUCKETS = [1, 3, 7, 16, 35] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
function nextIntervalDays(prevDays: number, known: boolean): number {
  if (!known) return REVIEW_BUCKETS[0];
  for (const d of REVIEW_BUCKETS) if (d > prevDays) return d;
  return REVIEW_BUCKETS[REVIEW_BUCKETS.length - 1];
}

export async function reviewFlashcard(studentId: number, topicId: number, cardKey: string, known: boolean) {
  await assertTopicOpen(studentId, topicId);
  if (!cardKey || cardKey.length > 64) throw badRequest("Karta notoʻgʻri", "Неверная карточка");

  const { cards, locked } = await build(studentId, topicId);
  if (locked) {
    throw new ApiError(403, "flashcards_locked", "Avval testni yakunlang", "Сначала завершите тест");
  }
  if (!cards.some((c) => c.key === cardKey)) throw notFound("Karta");

  const prev = await prisma.flashcardReview.findUnique({
    where: { studentId_topicId_cardKey: { studentId, topicId, cardKey } },
    select: { intervalDays: true },
  });
  const days = nextIntervalDays(prev?.intervalDays ?? 0, known);
  const dueAt = new Date(Date.now() + days * DAY_MS);

  await prisma.flashcardReview.upsert({
    where: { studentId_topicId_cardKey: { studentId, topicId, cardKey } },
    create: { studentId, topicId, cardKey, known, intervalDays: days, dueAt },
    update: { known, intervalDays: days, dueAt },
  });

  const knownCount = await prisma.flashcardReview.count({ where: { studentId, topicId, known: true } });
  return { ok: true, knownCount, total: cards.length };
}

/** Bugun takrorlash kerak bo'lgan kartalar — barcha mavzular kesimida
 *  (Dashboard "Bugun takrorlang" bloki). dueAt <= hozir bo'lgan kartalar. */
export async function getReviewDue(studentId: number) {
  const now = new Date();
  const rows = await prisma.flashcardReview.groupBy({
    by: ["topicId"],
    where: { studentId, dueAt: { not: null, lte: now } },
    _count: { _all: true },
  });
  if (rows.length === 0) return { total: 0, topics: [] as { topicId: number; topicTitle: string; subjectName: string; dueCount: number }[] };

  const topics = await prisma.topic.findMany({
    where: { id: { in: rows.map((r) => r.topicId) } },
    select: { id: true, title: true, subject: { select: { name: true } } },
  });
  const byId = new Map(topics.map((t) => [t.id, t]));
  const list = rows
    .map((r) => ({
      topicId: r.topicId,
      topicTitle: byId.get(r.topicId)?.title ?? "—",
      subjectName: byId.get(r.topicId)?.subject.name ?? "",
      dueCount: r._count._all,
    }))
    .filter((x) => byId.has(x.topicId))
    .sort((a, b) => b.dueCount - a.dueCount);

  return { total: list.reduce((s, x) => s + x.dueCount, 0), topics: list };
}

/** Takrorlashni qaytadan boshlash — barcha belgilarni tozalaydi. */
export async function resetFlashcards(studentId: number, topicId: number) {
  await assertTopicOpen(studentId, topicId);
  await prisma.flashcardReview.deleteMany({ where: { studentId, topicId } });
  return { ok: true };
}
