import { Prisma, prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { readFileBuffer } from "../../lib/storage";
import { buildPdf } from "../content/presentation";
import type { CaseJson, Slide } from "../../ai/types";
import { assertTopicOpen, recomputeTopic, syncTopicProgress, type TopicOut } from "./service";

const persistAndReport = syncTopicProgress;

// ---------- Content shapes ----------

function questionOptions(optionsJson: unknown): string[] {
  return (optionsJson as string[]) ?? [];
}

// ---------- GET /me/topics/:id — the full lesson payload ----------

export async function getTopicLesson(studentId: number, topicId: number) {
  const state = await assertTopicOpen(studentId, topicId); // enforces enrolled + published + unlocked

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      course: true,
      contentItems: {
        where: { status: "PUBLISHED" },
        include: { quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } }, clinicalCase: true, presentation: true, video: true },
      },
    },
  });
  if (!topic) throw notFound("Mavzu");

  const rule = state; // TopicOut carries elements; thresholds come from the course rule below
  const progress = await prisma.progress.findUnique({ where: { studentId_topicId: { studentId, topicId } } });

  const videoItem = topic.contentItems.find((c) => c.kind === "VIDEO");
  const slidesItem = topic.contentItems.find((c) => c.kind === "PRESENTATION");
  const quizItem = topic.contentItems.find((c) => c.kind === "QUIZ");
  const caseItem = topic.contentItems.find((c) => c.kind === "CASE");

  // Latest quiz attempt (for the intro/result state).
  let quizMeta = null;
  if (quizItem?.quiz) {
    const q = quizItem.quiz;
    const attempts = await prisma.quizAttempt.findMany({
      where: { studentId, quizId: q.id },
      orderBy: { attemptNo: "desc" },
    });
    const inProgress = attempts.find((a) => a.finishedAt === null) ?? null;
    const finishedCount = attempts.filter((a) => a.finishedAt !== null).length;
    const latest = attempts[0] ?? null;
    quizMeta = {
      quizId: q.id,
      questionCount: q.questions.length,
      passThreshold: q.passThreshold,
      maxAttempts: q.maxAttempts,
      canStart: !inProgress && finishedCount < q.maxAttempts,
      inProgressId: inProgress?.id ?? null,
      attempt: latest
        ? {
            id: latest.id,
            status: latest.finishedAt ? ("finished" as const) : ("in_progress" as const),
            scorePct: latest.finishedAt ? latest.scorePct : null,
            passed: latest.finishedAt ? latest.passed : null,
            attemptNo: latest.attemptNo,
          }
        : null,
    };
  }

  // Case attempt (reference answer only revealed once submitted).
  let caseTab = null;
  if (caseItem?.clinicalCase) {
    const cc = caseItem.clinicalCase;
    const caseJson = cc.caseJson as unknown as CaseJson;
    const attempt = await prisma.caseAttempt.findUnique({
      where: { studentId_caseId: { studentId, caseId: cc.id } },
    });
    caseTab = {
      present: true,
      caseId: cc.id,
      blocks: {
        complaints: caseJson.complaints,
        anamnesis: caseJson.anamnesis,
        objectiveStatus: caseJson.objectiveStatus,
        labData: caseJson.labData,
      },
      questions: caseJson.questions,
      attempt: attempt
        ? {
            id: attempt.id,
            answers: attempt.answersJson as string[],
            referenceAnswer: caseJson.referenceAnswer, // revealed after submission
            submittedAt: attempt.submittedAt,
            score: attempt.score,
            teacherFeedback: attempt.teacherFeedback,
            reviewed: attempt.reviewedAt !== null,
          }
        : null,
    };
  }

  const courseRule = (topic.unlockRuleJson ?? topic.course.defaultUnlockRuleJson) as Record<string, unknown> | null;
  const videoThreshold = (courseRule?.videoWatchedPct as number) ?? 80;

  return {
    topicId: topic.id,
    orderIndex: topic.orderIndex,
    titleUz: topic.titleUz,
    titleRu: topic.titleRu,
    courseId: topic.courseId,
    state: state.state,
    completed: state.state === "COMPLETED",
    thresholds: { video: videoThreshold, quizPass: quizItem?.quiz?.passThreshold ?? 70 },
    elements: rule.elements,
    tabs: {
      video: videoItem?.video
        ? {
            present: true,
            videoId: videoItem.video.id,
            hasMp4: !!videoItem.video.mp4Url,
            hasSrt: !!videoItem.video.srtUrl,
            durationSec: videoItem.video.durationSec,
            watchedPct: progress?.videoWatchedPct ?? 0,
            positionSec: progress?.videoPositionSec ?? 0,
            done: (progress?.videoWatchedPct ?? 0) >= videoThreshold,
            language: videoItem.language,
          }
        : null,
      slides: slidesItem?.presentation
        ? {
            present: true,
            presentationId: slidesItem.presentation.id,
            slides: (slidesItem.presentation.slidesJson as unknown as Slide[]).map((s, si) => ({
              id: s.id,
              layout: s.layout,
              title: s.title,
              bullets: s.bullets,
              imageUrl: s.imageSlots?.[0]?.status === "DONE" ? `/api/v1/me/presentations/${slidesItem.presentation!.id}/image/${si}/0` : null,
            })),
            viewed: progress?.slidesViewed ?? false,
            done: progress?.slidesViewed ?? false,
          }
        : null,
      quiz: quizMeta ? { present: true, ...quizMeta } : null,
      case: caseTab,
    },
  };
}

// ---------- Video / slides progress ----------

export async function setVideoProgress(studentId: number, topicId: number, watchedPct: number, positionSec: number) {
  await assertTopicOpen(studentId, topicId);
  const pct = Math.max(0, Math.min(100, Math.round(watchedPct)));
  const existing = await prisma.progress.findUnique({ where: { studentId_topicId: { studentId, topicId } } });
  await prisma.progress.upsert({
    where: { studentId_topicId: { studentId, topicId } },
    create: { studentId, topicId, videoWatchedPct: pct, videoPositionSec: Math.max(0, Math.round(positionSec)) },
    // Watched% is monotonic (scrubbing back doesn't lower the gate); position tracks the last spot.
    update: { videoWatchedPct: Math.max(existing?.videoWatchedPct ?? 0, pct), videoPositionSec: Math.max(0, Math.round(positionSec)) },
  });
  return persistAndReport(studentId, topicId);
}

export async function setSlidesViewed(studentId: number, topicId: number) {
  await assertTopicOpen(studentId, topicId);
  await prisma.progress.upsert({
    where: { studentId_topicId: { studentId, topicId } },
    create: { studentId, topicId, slidesViewed: true },
    update: { slidesViewed: true },
  });
  return persistAndReport(studentId, topicId);
}

// ---------- Quiz lifecycle ----------

async function quizWithTopic(quizId: number) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { contentItem: true, questions: { orderBy: { orderIndex: "asc" } } },
  });
  if (!quiz) throw notFound("Test");
  if (quiz.contentItem.status !== "PUBLISHED") throw notFound("Test");
  return quiz;
}

/** Serialize an attempt: public (no answers/explanations) while running; full analysis once finished. */
function serializeAttempt(
  attempt: { id: number; quizId: number; answersJson: unknown; scorePct: number; passed: boolean; attemptNo: number; finishedAt: Date | null },
  quiz: { passThreshold: number; questions: { id: number; text: string; optionsJson: unknown; correctIndex: number; explanationJson: unknown; difficulty: string; sourceFragment: string | null }[] }
) {
  const answers = (attempt.answersJson as Record<string, number>) ?? {};
  const finished = attempt.finishedAt !== null;
  const total = quiz.questions.length;
  const correctCount = quiz.questions.filter((q) => answers[String(q.id)] === q.correctIndex).length;

  return {
    id: attempt.id,
    quizId: attempt.quizId,
    status: finished ? ("finished" as const) : ("in_progress" as const),
    attemptNo: attempt.attemptNo,
    passThreshold: quiz.passThreshold,
    total,
    answers,
    scorePct: finished ? attempt.scorePct : null,
    passed: finished ? attempt.passed : null,
    correctCount: finished ? correctCount : null,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: questionOptions(q.optionsJson),
      difficulty: q.difficulty,
      // Correct answer + explanations are hidden until the attempt is finished.
      ...(finished
        ? {
            correctIndex: q.correctIndex,
            explanations: (q.explanationJson as string[]) ?? [],
            studentAnswer: answers[String(q.id)] ?? null,
            sourceFragment: q.sourceFragment,
          }
        : {}),
    })),
  };
}

export async function startQuizAttempt(studentId: number, quizId: number) {
  const quiz = await quizWithTopic(quizId);
  await assertTopicOpen(studentId, quiz.contentItem.topicId);

  const attempts = await prisma.quizAttempt.findMany({ where: { studentId, quizId }, orderBy: { attemptNo: "desc" } });
  const inProgress = attempts.find((a) => a.finishedAt === null);
  if (inProgress) return serializeAttempt(inProgress, quiz); // resume, not a new attempt

  const finishedCount = attempts.filter((a) => a.finishedAt !== null).length;
  if (finishedCount >= quiz.maxAttempts) {
    throw new ApiError(403, "quiz_max_attempts", "Test allaqachon ishlangan", "Тест уже пройден");
  }

  const created = await prisma.quizAttempt.create({
    data: { quizId, studentId, answersJson: {}, attemptNo: finishedCount + 1 },
  });
  return serializeAttempt(created, quiz);
}

async function ownAttempt(studentId: number, attemptId: number) {
  const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw notFound("Urinish");
  if (attempt.studentId !== studentId) throw new ApiError(403, "forbidden", "Ruxsat yoʻq", "Нет доступа");
  const quiz = await quizWithTopic(attempt.quizId);
  await assertTopicOpen(studentId, quiz.contentItem.topicId);
  return { attempt, quiz };
}

export async function saveQuizAnswers(studentId: number, attemptId: number, answers: Record<string, number>) {
  const { attempt, quiz } = await ownAttempt(studentId, attemptId);
  if (attempt.finishedAt) throw new ApiError(403, "attempt_finished", "Urinish yakunlangan", "Попытка завершена");

  // Keep only valid question ids / option indexes.
  const valid: Record<string, number> = { ...((attempt.answersJson as Record<string, number>) ?? {}) };
  const byId = new Map(quiz.questions.map((q) => [String(q.id), questionOptions(q.optionsJson).length]));
  for (const [qid, idx] of Object.entries(answers ?? {})) {
    const optCount = byId.get(qid);
    if (optCount !== undefined && Number.isInteger(idx) && idx >= 0 && idx < optCount) valid[qid] = idx;
  }
  const updated = await prisma.quizAttempt.update({ where: { id: attemptId }, data: { answersJson: valid } });
  return serializeAttempt(updated, quiz);
}

export async function finishQuizAttempt(studentId: number, attemptId: number) {
  const { attempt, quiz } = await ownAttempt(studentId, attemptId);
  if (attempt.finishedAt) return { attempt: serializeAttempt(attempt, quiz), topic: await recomputeTopic(studentId, quiz.contentItem.topicId) };

  const answers = (attempt.answersJson as Record<string, number>) ?? {};
  const total = quiz.questions.length;
  const correct = quiz.questions.filter((q) => answers[String(q.id)] === q.correctIndex).length;
  const scorePct = total === 0 ? 0 : Math.round((correct / total) * 100);
  const passed = scorePct >= quiz.passThreshold;

  const finished = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: { scorePct, passed, finishedAt: new Date() },
  });
  const topic = await persistAndReport(studentId, quiz.contentItem.topicId);
  return { attempt: serializeAttempt(finished, quiz), topic };
}

export async function getQuizAttempt(studentId: number, attemptId: number) {
  const { attempt, quiz } = await ownAttempt(studentId, attemptId);
  return serializeAttempt(attempt, quiz);
}

// ---------- Case lifecycle ----------

async function caseWithTopic(caseId: number) {
  const cc = await prisma.clinicalCase.findUnique({ where: { id: caseId }, include: { contentItem: true } });
  if (!cc) throw notFound("Keys");
  if (cc.contentItem.status !== "PUBLISHED") throw notFound("Keys");
  return cc;
}

function serializeCaseAttempt(
  attempt: { id: number; answersJson: unknown; submittedAt: Date; score: number | null; teacherFeedback: string | null; reviewedAt: Date | null },
  caseJson: CaseJson
) {
  return {
    id: attempt.id,
    answers: attempt.answersJson as string[],
    referenceAnswer: caseJson.referenceAnswer,
    questions: caseJson.questions,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    teacherFeedback: attempt.teacherFeedback,
    reviewed: attempt.reviewedAt !== null,
  };
}

export async function submitCase(studentId: number, caseId: number, answers: string[]) {
  const cc = await caseWithTopic(caseId);
  await assertTopicOpen(studentId, cc.contentItem.topicId);
  const caseJson = cc.caseJson as unknown as CaseJson;

  const existing = await prisma.caseAttempt.findUnique({ where: { studentId_caseId: { studentId, caseId } } });
  if (existing) throw new ApiError(409, "case_already_submitted", "Keys allaqachon topshirilgan", "Кейс уже сдан");

  if (!Array.isArray(answers) || answers.length !== caseJson.questions.length || answers.some((a) => !a || !a.trim())) {
    throw badRequest("Barcha savolga javob bering", "Ответьте на все вопросы");
  }

  const created = await prisma.caseAttempt.create({
    data: { caseId, studentId, answersJson: answers.map((a) => a.trim()) },
  });
  await persistAndReport(studentId, cc.contentItem.topicId);
  return serializeCaseAttempt(created, caseJson);
}

export async function getCaseAttempt(studentId: number, attemptId: number) {
  const attempt = await prisma.caseAttempt.findUnique({
    where: { id: attemptId },
    include: { clinicalCase: true },
  });
  if (!attempt) throw notFound("Keys javobi");
  if (attempt.studentId !== studentId) throw new ApiError(403, "forbidden", "Ruxsat yoʻq", "Нет доступа");
  return serializeCaseAttempt(attempt, attempt.clinicalCase.caseJson as unknown as CaseJson);
}

// ---------- Student media (published + enrolled + unlocked) ----------

async function videoAccess(studentId: number, videoId: number) {
  const v = await prisma.video.findUnique({ where: { id: videoId }, include: { contentItem: true } });
  if (!v) throw notFound("Video");
  if (v.contentItem.status !== "PUBLISHED") throw notFound("Video");
  await assertTopicOpen(studentId, v.contentItem.topicId);
  return v;
}

export async function studentVideoMedia(studentId: number, videoId: number, kind: "mp4" | "srt"): Promise<Buffer> {
  const v = await videoAccess(studentId, videoId);
  const rel = kind === "mp4" ? v.mp4Url : v.srtUrl;
  if (!rel) throw notFound("Fayl");
  return readFileBuffer(rel);
}

async function presentationAccess(studentId: number, presentationId: number) {
  const p = await prisma.presentation.findUnique({ where: { id: presentationId }, include: { contentItem: true } });
  if (!p) throw notFound("Prezentatsiya");
  if (p.contentItem.status !== "PUBLISHED") throw notFound("Prezentatsiya");
  await assertTopicOpen(studentId, p.contentItem.topicId);
  return p;
}

export async function studentSlotImage(studentId: number, presentationId: number, slideIndex: number, slotIndex: number): Promise<Buffer> {
  const p = await presentationAccess(studentId, presentationId);
  const slot = (p.slidesJson as unknown as Slide[])[slideIndex]?.imageSlots?.[slotIndex];
  if (!slot?.url) throw notFound("Rasm");
  return readFileBuffer(slot.url);
}

export async function studentPresentationPdf(studentId: number, presentationId: number): Promise<Buffer> {
  const p = await presentationAccess(studentId, presentationId);
  return buildPdf(p.slidesJson as unknown as Slide[]);
}
