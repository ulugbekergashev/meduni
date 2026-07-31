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
import type { CaseJson, CaseStep, DigestJson } from "../../ai/types";
import { assertTopicOpen } from "./service";

/** Karta turi — UI rangi/yorlig'i shunga qarab (front tomon "nima soralayapti"
 *  ni tur bildiradi, shuning uchun savol matnini yasash shart emas). */
export type FlashcardKind = "quiz" | "term" | "termRev" | "concept" | "fact" | "dose" | "check" | "case";

export interface Flashcard {
  key: string;
  kind: FlashcardKind;
  front: string;
  back: string;
  /** Qo'shimcha izoh (test savoli uchun — tushuntirish; fakt uchun — to'liq jumla). */
  note: string | null;
  /** Oxirgi takrorlashda "bilaman" deb belgilanganmi (null — hali ko'rilmagan). */
  known: boolean | null;
}

// ---------- Deterministik karta yasash yordamchilari (AI YO'Q) ----------

/** "Tushuncha — ta'rif" / "Tushuncha: ta'rif" ko'rinishini ikkiga bo'ladi.
 *  Ajratgich bo'lmasa null (bunday satrdan karta yasalmaydi — soxta savol
 *  yasashdan ko'ra kartani tashlab ketgan yaxshi). */
function splitDefinition(raw: string): { front: string; back: string } | null {
  const s = raw.trim();
  const m = s.match(/^(.{2,80}?)\s*(?:—|–|:|\s-\s)\s*(.{4,})$/u);
  if (!m) return null;
  return { front: m[1].trim(), back: m[2].trim() };
}

/** Jumladagi birinchi son (o'lchov birligi bilan) — cloze uchun. */
const NUMBER_RE =
  /[~<>≥≤]?\s?\d[\d .,]*(?:\s*[–—-]\s*\d[\d.,]*)?(?:\s*(?:x\s*10\^\d+\/?\S*|%|g\/kg|mg\/kg|mmHg|kPa|mg|g|kg|ml|l|mm|sm|cm|million|baravar|marta|yil|soat|kun))?/u;

/** Faktdan "bo'sh joyli" (cloze) karta: raqam yashiriladi, javob — o'sha raqam.
 *  Raqam bo'lmasa konspekt atamasi yashiriladi; ikkalasi ham bo'lmasa null. */
function clozeCard(raw: string, terms: { uz?: string; lat?: string }[]): { front: string; back: string } | null {
  const s = raw.trim();
  if (s.length < 12) return null;

  const num = s.match(NUMBER_RE);
  if (num && num[0].trim().length >= 1) {
    const hidden = num[0].trim();
    return { front: s.replace(hidden, " _____ ").replace(/\s{2,}/g, " ").trim(), back: hidden };
  }

  for (const term of terms) {
    const key = (term.uz ?? "").trim();
    if (key.length < 4) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(s)) return { front: s.replace(re, " _____ ").replace(/\s{2,}/g, " ").trim(), back: key };
  }
  return null;
}

/** Bir mavzudagi kartalar chegarasi — sessiya juda uzun bo'lib ketmasin. */
const MAX_CARDS = 60;

function optionAt(optionsJson: unknown, i: number): string {
  const arr = (optionsJson as string[]) ?? [];
  return arr[i] ?? "";
}

/** Kartalarni yig'adi.
 *
 *  ⚠️ 2026-07-28 QULF MODELI O'ZGARDI (buyurtmachi: "kartalar ko'proq bo'lishi
 *  kerak"). Ilgari BUTUN to'plam test yakunlanmaguncha yopiq edi — lekin qulfning
 *  sababi faqat "test javoblari oshkor bo'lmasin" edi. Konspekt atamasi/tushunchasi/
 *  fakti talabaga o'qish ustunida ALLAQACHON ochiq, ya'ni ularni yashirishning
 *  ma'nosi yo'q va aynan test OLDIDAN takrorlash eng kerak payt. Endi:
 *    · konspektdan kelgan kartalar — HAR DOIM ochiq
 *    · test savollari — faqat urinish yakunlangach
 *    · keys qadamlari — faqat javob topshirilgach
 */
async function build(studentId: number, topicId: number) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      digest: true,
      contentItems: {
        where: { status: "PUBLISHED" },
        include: { quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } }, clinicalCase: true },
      },
    },
  });
  if (!topic) throw notFound("Mavzu");

  const quiz = topic.contentItems.find((c) => c.kind === "QUIZ")?.quiz ?? null;
  const clinicalCase = topic.contentItems.find((c) => c.kind === "CASE")?.clinicalCase ?? null;

  const [finishedAttempts, caseAttempt] = await Promise.all([
    quiz
      ? prisma.quizAttempt.count({ where: { studentId, quizId: quiz.id, finishedAt: { not: null } } })
      : Promise.resolve(0),
    clinicalCase
      ? prisma.caseAttempt.findUnique({
          where: { studentId_caseId: { studentId, caseId: clinicalCase.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  /** Test javoblari hali yopiqmi (shu qadar karta keyinroq qo'shiladi). */
  const quizLocked = !!quiz && finishedAttempts === 0;
  const caseLocked = !!clinicalCase && !caseAttempt;

  const cards: Flashcard[] = [];
  const digest = topic.digest?.approvedByTeacher ? (topic.digest.digestJson as unknown as DigestJson) : null;
  const terms = digest?.terms ?? [];

  // ---- 1. Atamalar: uz → ru·lat va teskarisi (lat/ru → uz) ----
  terms.forEach((term, i) => {
    if (!term.uz && !term.ru) return;
    const back = [term.ru, term.lat].filter(Boolean).join(" · ");
    if (back) {
      cards.push({ key: `t:${i}`, kind: "term", front: term.uz || term.ru, back, note: null, known: null });
    }
    // Teskari yo'nalish — atamani TANIB olish (lotincha/ruscha manbada uchraydi).
    const cue = term.lat || term.ru;
    if (cue && term.uz && cue.toLowerCase() !== term.uz.toLowerCase()) {
      cards.push({ key: `tr:${i}`, kind: "termRev", front: cue, back: term.uz, note: null, known: null });
    }
  });

  // ---- 2. Tushunchalar: "Nom — ta'rif" ----
  (digest?.concepts ?? []).forEach((c, i) => {
    const split = splitDefinition(c);
    if (!split) return; // ajratgichsiz tushunchadan soxta savol yasalmaydi
    cards.push({ key: `c:${i}`, kind: "concept", front: split.front, back: split.back, note: null, known: null });
  });

  // ---- 3. Faktlar: cloze (raqam/atama yashiriladi) ----
  (digest?.facts ?? []).forEach((f, i) => {
    const cz = clozeCard(f, terms);
    if (!cz) return;
    cards.push({ key: `f:${i}`, kind: "fact", front: cz.front, back: cz.back, note: f, known: null });
  });

  // ---- 4. Dozalar: "Preparat — doza" (tibbiy xavfsizlik uchun eng muhimi) ----
  (digest?.dosages ?? []).forEach((d, i) => {
    const split = splitDefinition(d) ?? clozeCard(d, terms);
    if (!split) return;
    cards.push({ key: `d:${i}`, kind: "dose", front: split.front, back: split.back, note: d, known: null });
  });

  // ---- 4b. Bo'lim BLOKLARI: "Nom — ta'rif" ro'yxatlari va callout'lar ----
  // ⚠️ 2026-08-01 (buyurtmachi: "kartochka 15ta"). Ilgari kartalar faqat
  // atama/tushuncha/fakt/doza'dan yig'ilardi va bo'limli konspektda ularning
  // ko'pi bo'sh bo'lib, mavzuga 8-10 ta karta chiqardi. Bo'lim bloklarida esa
  // aynan takrorlashga mos material bor: ro'yxat elementlari ("Asos (basis
  // cordis) — yuqori qism"), MUHIM/OGOHLANTIRISH callout'lari. Soxta savol
  // yasalmaydi: `lead` yoki ajratgich bo'lmasa karta ham bo'lmaydi.
  (digest?.sections ?? []).forEach((sec, si) => {
    (sec.blocks ?? []).forEach((b, bi) => {
      if (b.type === "list") {
        b.items.forEach((it, ii) => {
          const lead = (it.lead ?? "").trim();
          const text = (it.text ?? "").trim();
          if (lead && text) {
            cards.push({ key: `sl:${si}:${bi}:${ii}`, kind: "concept", front: lead, back: text, note: sec.title, known: null });
            return;
          }
          // `lead` yo'q — matnning o'zida "Nom — ta'rif" bo'lsa ajratamiz.
          const split = text ? splitDefinition(text) : null;
          if (split) {
            cards.push({ key: `sl:${si}:${bi}:${ii}`, kind: "concept", front: split.front, back: split.back, note: sec.title, known: null });
          }
        });
      } else if (b.type === "callout") {
        const text = (b.text ?? "").trim();
        const split = splitDefinition(text) ?? clozeCard(text, terms);
        if (split) {
          cards.push({
            key: `sc:${si}:${bi}`,
            kind: b.tone === "warning" ? "dose" : "fact",
            front: split.front,
            back: split.back,
            note: sec.title,
            known: null,
          });
        }
      }
    });
  });

  // ---- 5. Bo'lim checkpoint savollari (konspektда allaqachon ochiq) ----
  (digest?.sections ?? []).forEach((s, i) => {
    const cp = s.checkpoint;
    if (!cp || !Array.isArray(cp.options) || cp.options.length < 2) return;
    const answer = cp.options[cp.correctIndex];
    if (!answer) return;
    cards.push({
      key: `cp:${i}`,
      kind: "check",
      front: cp.question,
      back: answer,
      note: cp.explanation || null,
      known: null,
    });
  });

  // ---- 6. Klinik keys qadamlari — faqat javob topshirilgach ----
  if (clinicalCase && !caseLocked) {
    const steps = ((clinicalCase.caseJson as unknown as CaseJson)?.steps ?? []) as CaseStep[];
    steps.forEach((st, i) => {
      const right = st.options.find((o) => o.correct);
      if (!st.prompt || !right?.text) return;
      cards.push({
        key: `cs:${i}`,
        kind: "case",
        front: st.prompt,
        back: right.text,
        note: right.feedback || null,
        known: null,
      });
    });
  }

  // ---- 7. Test savollari — faqat urinish yakunlangach ----
  if (quiz && !quizLocked) {
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

  const trimmed = cards.slice(0, MAX_CARDS);
  /** Keyinroq ochiladigan kartalar soni (UI "yana N ta ochiladi" deydi). */
  const pendingQuiz = quizLocked ? quiz!.questions.length : 0;
  return {
    cards: trimmed,
    /** To'plam butunlay bo'shmi (eski `locked` semantikasi o'rnida). */
    locked: trimmed.length === 0,
    quizLocked,
    caseLocked,
    pendingQuiz,
    hasQuiz: !!quiz,
  };
}

export async function getFlashcards(studentId: number, topicId: number) {
  await assertTopicOpen(studentId, topicId);
  const { cards, locked, hasQuiz, quizLocked, caseLocked, pendingQuiz } = await build(studentId, topicId);

  if (locked) {
    // Kontent hali yo'q (konspekt tasdiqlanmagan va test yakunlanmagan).
    return {
      locked: true,
      reason: quizLocked ? ("quiz_not_finished" as const) : ("no_content" as const),
      cards: [],
      total: 0,
      knownCount: 0,
      quizLocked,
      caseLocked,
      pendingQuiz,
      hasQuiz,
    };
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
    /** Test yakunlangach yana shuncha karta qo'shiladi (UI xabari). */
    quizLocked,
    caseLocked,
    pendingQuiz,
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
    throw new ApiError(403, "flashcards_locked", "Kartalar hali tayyor emas", "Карточки ещё не готовы");
  }
  // Karta ro'yxatda yo'q bo'lsa — hali ochilmagan (test/keys) yoki mavjud emas.
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

/** Kross-mavzu takrorlash sessiyasi (Modul 27 "Takrorlash" tabi) — due bo'lgan
 *  kartalarni BARCHA mavzulardan bitta to'plamga yig'adi. Har kartada mavzu
 *  konteksti bor; belgilash mavjud per-topic endpoint orqali qilinadi. */
const SESSION_LIMIT = 60;

export async function getReviewSession(studentId: number, topicId?: number) {
  const now = new Date();
  const due = await prisma.flashcardReview.findMany({
    where: { studentId, dueAt: { not: null, lte: now }, ...(topicId ? { topicId } : {}) },
    orderBy: { dueAt: "asc" },
    take: SESSION_LIMIT,
  });
  if (due.length === 0) return { cards: [], total: 0 };

  const byTopic = new Map<number, Set<string>>();
  for (const r of due) {
    if (!byTopic.has(r.topicId)) byTopic.set(r.topicId, new Set());
    byTopic.get(r.topicId)!.add(r.cardKey);
  }
  const topics = await prisma.topic.findMany({
    where: { id: { in: [...byTopic.keys()] } },
    select: { id: true, title: true, course: { select: { name: true } } },
  });
  const tmap = new Map(topics.map((t) => [t.id, t]));
  // Eng eski due birinchi chiqishi uchun asl tartibni saqlaymiz.
  const order = new Map(due.map((r, i) => [`${r.topicId}:${r.cardKey}`, i]));

  const out: (Flashcard & { topicId: number; topicTitle: string; subjectName: string })[] = [];
  for (const [tid, keys] of byTopic) {
    const t = tmap.get(tid);
    if (!t) continue;
    const { cards, locked } = await build(studentId, tid);
    if (locked) continue;
    for (const c of cards) {
      if (keys.has(c.key)) out.push({ ...c, topicId: tid, topicTitle: t.title, subjectName: t.course.name });
    }
  }
  out.sort(
    (a, b) => (order.get(`${a.topicId}:${a.key}`) ?? 0) - (order.get(`${b.topicId}:${b.key}`) ?? 0)
  );
  return { cards: out, total: out.length };
}

/** Takrorlash statistikasi (Takrorlash tabi hero'si + kelgusi jadval). */
export async function getReviewStats(studentId: number) {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const all = await prisma.flashcardReview.findMany({
    where: { studentId },
    select: { topicId: true, known: true, dueAt: true, reviewedAt: true },
  });
  const dueNow = all.filter((r) => r.dueAt && r.dueAt <= now).length;
  const reviewedToday = all.filter((r) => r.reviewedAt >= startToday).length;
  const knownPct = all.length ? Math.round((all.filter((r) => r.known).length / all.length) * 100) : null;

  // Kelgusi takrorlar — mavzu kesimida eng yaqin sana + soni.
  const nextByTopic = new Map<number, Date>();
  const cntByTopic = new Map<number, number>();
  for (const r of all) {
    if (!r.dueAt || r.dueAt <= now) continue;
    cntByTopic.set(r.topicId, (cntByTopic.get(r.topicId) ?? 0) + 1);
    const cur = nextByTopic.get(r.topicId);
    if (!cur || r.dueAt < cur) nextByTopic.set(r.topicId, r.dueAt);
  }
  const tps = nextByTopic.size
    ? await prisma.topic.findMany({
        where: { id: { in: [...nextByTopic.keys()] } },
        select: { id: true, title: true, course: { select: { name: true } } },
      })
    : [];
  const tmap = new Map(tps.map((t) => [t.id, t]));
  const upcoming = [...nextByTopic.entries()]
    .filter(([tid]) => tmap.has(tid))
    .map(([tid, d]) => ({
      topicId: tid,
      topicTitle: tmap.get(tid)!.title,
      subjectName: tmap.get(tid)!.course.name,
      nextDueAt: d,
      count: cntByTopic.get(tid) ?? 0,
    }))
    .sort((a, b) => +a.nextDueAt - +b.nextDueAt);

  return { dueNow, reviewedToday, knownPct, nextDueAt: upcoming[0]?.nextDueAt ?? null, upcoming };
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
    select: { id: true, title: true, course: { select: { name: true } } },
  });
  const byId = new Map(topics.map((t) => [t.id, t]));
  const list = rows
    .map((r) => ({
      topicId: r.topicId,
      topicTitle: byId.get(r.topicId)?.title ?? "—",
      subjectName: byId.get(r.topicId)?.course.name ?? "",
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
