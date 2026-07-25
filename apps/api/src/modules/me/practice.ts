// Qo'shimcha mashg'ulotlar (Modul 27, "Mashg'ulotlar" tabi) — XATOLAR USTIDA
// ISHLASH + virtual bemor amaliyot markazi.
//
// Tibbiy xavfsizlik va halollik:
//   · faqat PUBLISHED (tasdiqlangan) kontentdan;
//   · test savollari FAQAT yakunlangan urinishlardan (javob talabaga allaqachon
//     natija ekranida ochilgan — hech narsa sizmaydi);
//   · keys qadamlari faqat topshirilgan keysdan;
//   · AI chaqiruvi YO'Q, bahoga/progressga ta'sir YO'Q (hech narsa yozilmaydi).
import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";
import type { CaseJson } from "../../ai/types";
import { computeTopics, enrolledCourseIds, loadCourse, studentFactsMap } from "./service";
import { getFlashcards } from "./flashcards";

interface WrongQuizQ {
  kind: "quiz";
  questionId: number;
  text: string;
  options: string[];
  correctIndex: number;
  /** Har variant izohi (natija ekranida ochilgan). */
  explanations: string[];
  sourceFragment: string | null;
  /** Talabaning urinishdagi (xato) javobi. */
  yourAnswer: number | null;
}

interface WrongCaseStep {
  kind: "step";
  title: string;
  prompt: string;
  options: { text: string; correct: boolean; feedback: string }[];
  yourAnswer: number | null;
}

interface UnknownCard {
  kind: "card";
  front: string;
  back: string;
  note: string | null;
}

export type PracticeItem = WrongQuizQ | WrongCaseStep | UnknownCard;

/** Bitta mavzu bo'yicha xato-signallarni hisoblaydi. Og'ir joyi — savollar;
 *  ular faqat kerak bo'lganda (includeItems) yig'iladi. */
async function topicMistakes(studentId: number, topicId: number, includeItems: boolean) {
  // Oxirgi YAKUNLANGAN test urinishi (javoblar reveal bo'lgan).
  const attempt = await prisma.quizAttempt.findFirst({
    where: {
      studentId,
      finishedAt: { not: null },
      quiz: { contentItem: { topicId, status: "PUBLISHED" } },
    },
    orderBy: { attemptNo: "desc" },
    include: { quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } } },
  });

  const wrongQuiz: WrongQuizQ[] = [];
  let wrongQuizCount = 0;
  if (attempt) {
    const answers = (attempt.answersJson as Record<string, number>) ?? {};
    for (const q of attempt.quiz.questions) {
      const your = answers[String(q.id)];
      if (your === q.correctIndex) continue;
      wrongQuizCount++;
      if (!includeItems) continue;
      wrongQuiz.push({
        kind: "quiz",
        questionId: q.id,
        text: q.text,
        options: (q.optionsJson as string[]) ?? [],
        correctIndex: q.correctIndex,
        explanations: (q.explanationJson as string[]) ?? [],
        sourceFragment: q.sourceFragment,
        yourAnswer: Number.isInteger(your) ? (your as number) : null,
      });
    }
  }

  // Topshirilgan keysning xato qadamlari.
  const caseAttempt = await prisma.caseAttempt.findFirst({
    where: { studentId, clinicalCase: { contentItem: { topicId, status: "PUBLISHED" } } },
    include: { clinicalCase: true },
  });
  const wrongSteps: WrongCaseStep[] = [];
  let wrongStepCount = 0;
  if (caseAttempt) {
    const caseJson = caseAttempt.clinicalCase.caseJson as unknown as CaseJson;
    const picked = (caseAttempt.stepsJson as Record<string, number>) ?? {};
    (caseJson.steps ?? []).forEach((s, i) => {
      const correctIdx = s.options.findIndex((o) => o.correct);
      const your = picked[String(i)];
      if (your === correctIdx) return;
      wrongStepCount++;
      if (!includeItems) return;
      wrongSteps.push({
        kind: "step",
        title: s.title,
        prompt: s.prompt,
        options: s.options.map((o) => ({ text: o.text, correct: o.correct, feedback: o.feedback })),
        yourAnswer: Number.isInteger(your) ? your : null,
      });
    });
  }

  // "Bilmayman" deb belgilangan kartalar.
  const unknownRows = await prisma.flashcardReview.findMany({
    where: { studentId, topicId, known: false },
    select: { cardKey: true },
  });
  let unknownCards: UnknownCard[] = [];
  if (unknownRows.length && includeItems) {
    const keys = new Set(unknownRows.map((r) => r.cardKey));
    try {
      const fc = await getFlashcards(studentId, topicId);
      unknownCards = fc.cards
        .filter((c) => keys.has(c.key))
        .map((c) => ({ kind: "card" as const, front: c.front, back: c.back, note: c.note }));
    } catch {
      /* mavzu yopiq bo'lib qolgan bo'lsa — kartalarsiz davom */
    }
  }

  return {
    wrongQuizCount,
    wrongStepCount,
    unknownCardCount: unknownRows.length,
    items: includeItems
      ? ([...wrongQuiz, ...wrongSteps, ...unknownCards] as PracticeItem[])
      : [],
  };
}

/** Zaif mavzular ro'yxati — Mashg'ulotlar tabi obzori. */
export async function getPracticeOverview(studentId: number) {
  // Xato-signal bor mavzular: yakunlangan attempt / keys attempt / unknown karta.
  const [quizTopics, caseTopics, cardTopics] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { studentId, finishedAt: { not: null }, quiz: { contentItem: { status: "PUBLISHED" } } },
      select: { quiz: { select: { contentItem: { select: { topicId: true } } } } },
    }),
    prisma.caseAttempt.findMany({
      where: { studentId, clinicalCase: { contentItem: { status: "PUBLISHED" } } },
      select: { clinicalCase: { select: { contentItem: { select: { topicId: true } } } } },
    }),
    prisma.flashcardReview.findMany({
      where: { studentId, known: false },
      select: { topicId: true },
    }),
  ]);
  const ids = new Set<number>([
    ...quizTopics.map((a) => a.quiz.contentItem.topicId),
    ...caseTopics.map((a) => a.clinicalCase.contentItem.topicId),
    ...cardTopics.map((r) => r.topicId),
  ]);
  if (ids.size === 0) return { topics: [] };

  const meta = await prisma.topic.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, title: true, course: { select: { name: true } } },
  });
  const tmap = new Map(meta.map((t) => [t.id, t]));

  const out: {
    topicId: number;
    topicTitle: string;
    subjectName: string;
    wrongQuiz: number;
    wrongSteps: number;
    unknownCards: number;
    total: number;
  }[] = [];
  for (const tid of ids) {
    const t = tmap.get(tid);
    if (!t) continue;
    const m = await topicMistakes(studentId, tid, false);
    const total = m.wrongQuizCount + m.wrongStepCount + m.unknownCardCount;
    if (total === 0) continue;
    out.push({
      topicId: tid,
      topicTitle: t.title,
      subjectName: t.course.name,
      wrongQuiz: m.wrongQuizCount,
      wrongSteps: m.wrongStepCount,
      unknownCards: m.unknownCardCount,
      total,
    });
  }
  out.sort((a, b) => b.total - a.total);
  return { topics: out };
}

/** Bitta mavzuning mashq to'plami. */
export async function getPracticeSet(studentId: number, topicId: number) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, title: true, course: { select: { name: true } } },
  });
  if (!topic) throw notFound("Mavzu");

  const m = await topicMistakes(studentId, topicId, true);
  if (m.items.length === 0) {
    throw new ApiError(404, "no_mistakes", "Bu mavzuda xatolar yo'q", "В этой теме нет ошибок");
  }
  return {
    topicId,
    topicTitle: topic.title,
    subjectName: topic.course.name,
    items: m.items,
  };
}

/** Virtual bemor amaliyot markazi — barcha OCHIQ mavzular (published keys BOR yoki
 *  tasdiqlangan KONSPEKT bor). Keys shart emas: keys bo'lmaganда bemor konspektdan
 *  generatsiya qilinadi (patient.ts). "Hoxlagan payt kirib ishlash" (buyurtmachi). */
export async function getPatientPractice(studentId: number) {
  const courseIds = await enrolledCourseIds(studentId);
  const seen = new Set<number>();
  const open: { topicId: number; topicTitle: string; subjectName: string }[] = [];

  for (const cid of courseIds) {
    const course = await loadCourse(cid);
    const facts = await studentFactsMap(studentId, course);
    for (const t of computeTopics(course, facts)) {
      if (t.state === "LOCKED" || seen.has(t.id)) continue;
      seen.add(t.id);
      open.push({ topicId: t.id, topicTitle: t.title, subjectName: course.name });
    }
  }
  if (open.length === 0) return { patients: [] };

  const ids = open.map((o) => o.topicId);
  const [cases, digests, evals, scenarios] = await Promise.all([
    prisma.contentItem.findMany({
      where: { topicId: { in: ids }, kind: "CASE", status: "PUBLISHED" },
      include: { clinicalCase: true },
    }),
    prisma.topicDigest.findMany({ where: { topicId: { in: ids }, approvedByTeacher: true }, select: { topicId: true } }),
    prisma.patientMessage.findMany({ where: { studentId, role: "eval", topicId: { in: ids } }, select: { topicId: true } }),
    prisma.patientMessage.findMany({ where: { studentId, role: "scenario", topicId: { in: ids } }, select: { topicId: true, text: true } }),
  ]);
  const caseByTopic = new Map(cases.map((c) => [c.topicId, c.clinicalCase]));
  const digestSet = new Set(digests.map((d) => d.topicId));
  const evalSet = new Set(evals.map((e) => e.topicId));
  const scenarioByTopic = new Map(scenarios.map((s) => [s.topicId, s.text]));

  const patients: {
    topicId: number;
    topicTitle: string;
    subjectName: string;
    patientName: string;
    patientInfo: string;
    finished: boolean;
    /** true = bemor konspektdan generatsiya qilinadi (published keys yo'q). */
    generated: boolean;
  }[] = [];

  for (const o of open) {
    const hasCase = caseByTopic.has(o.topicId);
    const hasDigest = digestSet.has(o.topicId);
    if (!hasCase && !hasDigest) continue; // bemor manbai yo'q

    let patientName = "";
    let patientInfo = "";
    const cc = caseByTopic.get(o.topicId);
    if (cc) {
      const cj = cc.caseJson as unknown as CaseJson;
      patientName = cj.patientName ?? "";
      patientInfo = cj.patientInfo ?? "";
    } else {
      // Ssenariy allaqachon generatsiya qilingan bo'lsa — ism/ma'lumotini ko'rsatamiz.
      const sc = scenarioByTopic.get(o.topicId);
      if (sc) {
        try {
          const cj = JSON.parse(sc) as CaseJson;
          patientName = cj.patientName ?? "";
          patientInfo = cj.patientInfo ?? "";
        } catch {
          /* buzuq — bo'sh qoldiramiz */
        }
      }
    }

    patients.push({
      topicId: o.topicId,
      topicTitle: o.topicTitle,
      subjectName: o.subjectName,
      patientName,
      patientInfo,
      finished: evalSet.has(o.topicId),
      generated: !hasCase,
    });
  }
  return { patients };
}
