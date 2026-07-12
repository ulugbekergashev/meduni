import { Prisma, prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import type { CaseJson } from "../../ai/types";
import { syncTopicProgress } from "../me/service";

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}

const attemptInclude = {
  student: true,
  clinicalCase: {
    include: { contentItem: { include: { topic: { include: { course: { include: { subject: true } } } } } } },
  },
} satisfies Prisma.CaseAttemptInclude;

type AttemptFull = Prisma.CaseAttemptGetPayload<{ include: typeof attemptInclude }>;

function ownsAttempt(a: AttemptFull, teacherId: number): boolean {
  return a.clinicalCase.contentItem.topic.course.teacherId === teacherId;
}

/** GET /teach/cases/review — every case answer across the teacher's courses. */
export async function listReviewQueue(
  teacherId: number,
  opts: { courseId?: number; topicId?: number; status?: "PENDING" | "REVIEWED" | "all"; search?: string; sort?: "oldest" | "newest" }
) {
  const status = opts.status ?? "PENDING";
  const where: Prisma.CaseAttemptWhereInput = {
    clinicalCase: {
      contentItem: {
        topic: {
          ...(opts.topicId ? { id: opts.topicId } : {}),
          course: { teacherId, ...(opts.courseId ? { id: opts.courseId } : {}) },
        },
      },
    },
    ...(status === "PENDING" ? { reviewedAt: null } : status === "REVIEWED" ? { reviewedAt: { not: null } } : {}),
    ...(opts.search?.trim() ? { student: { fullName: { contains: opts.search.trim(), mode: "insensitive" } } } : {}),
  };

  const rows = await prisma.caseAttempt.findMany({
    where,
    include: attemptInclude,
    orderBy: { submittedAt: opts.sort === "newest" ? "desc" : "asc" }, // oldest-first is fair (FIFO)
  });

  return rows.map((a) => ({
    id: a.id,
    studentName: a.student.fullName,
    courseId: a.clinicalCase.contentItem.topic.course.id,
    subjectNameUz: a.clinicalCase.contentItem.topic.course.subject.nameUz,
    subjectNameRu: a.clinicalCase.contentItem.topic.course.subject.nameRu,
    topicId: a.clinicalCase.contentItem.topicId,
    topicUz: a.clinicalCase.contentItem.topic.titleUz,
    topicRu: a.clinicalCase.contentItem.topic.titleRu,
    submittedAt: a.submittedAt,
    reviewedAt: a.reviewedAt,
    score: a.score,
    status: a.reviewedAt ? ("REVIEWED" as const) : ("PENDING" as const),
  }));
}

/** Distinct courses/topics that actually have case answers — for the filter dropdowns. */
export async function reviewFilters(teacherId: number) {
  const rows = await prisma.caseAttempt.findMany({
    where: { clinicalCase: { contentItem: { topic: { course: { teacherId } } } } },
    include: attemptInclude,
  });
  const courses = new Map<number, { id: number; nameUz: string; nameRu: string }>();
  const topics = new Map<number, { id: number; courseId: number; titleUz: string; titleRu: string }>();
  for (const a of rows) {
    const co = a.clinicalCase.contentItem.topic.course;
    const tp = a.clinicalCase.contentItem.topic;
    courses.set(co.id, { id: co.id, nameUz: co.subject.nameUz, nameRu: co.subject.nameRu });
    topics.set(tp.id, { id: tp.id, courseId: co.id, titleUz: tp.titleUz, titleRu: tp.titleRu });
  }
  return { courses: [...courses.values()], topics: [...topics.values()] };
}

export async function getCaseAttemptForReview(teacherId: number, attemptId: number) {
  const a = await prisma.caseAttempt.findUnique({ where: { id: attemptId }, include: attemptInclude });
  if (!a) throw notFound("Keys javobi");
  if (!ownsAttempt(a, teacherId)) throw forbidden();
  const caseJson = a.clinicalCase.caseJson as unknown as CaseJson;
  return {
    id: a.id,
    studentName: a.student.fullName,
    courseId: a.clinicalCase.contentItem.topic.course.id,
    subjectNameUz: a.clinicalCase.contentItem.topic.course.subject.nameUz,
    subjectNameRu: a.clinicalCase.contentItem.topic.course.subject.nameRu,
    topicUz: a.clinicalCase.contentItem.topic.titleUz,
    topicRu: a.clinicalCase.contentItem.topic.titleRu,
    blocks: { complaints: caseJson.complaints, anamnesis: caseJson.anamnesis, objectiveStatus: caseJson.objectiveStatus, labData: caseJson.labData },
    questions: caseJson.questions,
    referenceAnswer: caseJson.referenceAnswer,
    answers: a.answersJson as string[],
    submittedAt: a.submittedAt,
    score: a.score,
    feedback: a.teacherFeedback,
    reviewedAt: a.reviewedAt,
    status: a.reviewedAt ? ("REVIEWED" as const) : ("PENDING" as const),
  };
}

export async function reviewCase(teacherId: number, attemptId: number, score: number, feedback: string) {
  const a = await prisma.caseAttempt.findUnique({ where: { id: attemptId }, include: attemptInclude });
  if (!a) throw notFound("Keys javobi");
  if (!ownsAttempt(a, teacherId)) throw forbidden();
  if (!Number.isFinite(score) || score < 0 || score > 100) throw badRequest("Ball 0-100 oraligʻida boʻlsin", "Балл должен быть 0-100");

  const wasReviewed = a.reviewedAt !== null;
  await prisma.caseAttempt.update({
    where: { id: attemptId },
    data: { score: Math.round(score), teacherFeedback: feedback?.trim() || null, reviewedById: teacherId, reviewedAt: new Date() },
  });

  // Re-grading an already-reviewed answer is allowed but audited (medical accountability).
  if (wasReviewed) {
    await prisma.auditLog.create({
      data: { actorId: teacherId, action: "RE_REVIEW_CASE", entity: "CaseAttempt", entityId: attemptId, detailsJson: { studentId: a.studentId, prevScore: a.score, newScore: Math.round(score) } },
    });
  }

  // If the unlock rule needs a reviewed case, grading may complete the topic now.
  await syncTopicProgress(a.studentId, a.clinicalCase.contentItem.topicId);
  return { ok: true };
}
