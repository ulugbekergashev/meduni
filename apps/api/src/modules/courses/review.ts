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
    include: { contentItem: { include: { topic: { include: { subject: true } } } } },
  },
} satisfies Prisma.CaseAttemptInclude;

type AttemptFull = Prisma.CaseAttemptGetPayload<{ include: typeof attemptInclude }>;

/** Faza 3: mavzu fanga tegishli — javobning "kursi" talabaning o'qituvchi
 *  kursidagi ACTIVE yozilishidan aniqlanadi (attemptId -> courseId).
 *  Xaritada yo'q attempt = bu o'qituvchining talabasi emas. */
async function resolveAttemptCourses(rows: AttemptFull[], teacherId: number): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (rows.length === 0) return out;
  const courses = await prisma.course.findMany({ where: { teacherId }, select: { id: true, subjectId: true }, orderBy: { id: "asc" } });
  if (courses.length === 0) return out;
  const enr = await prisma.enrollment.findMany({
    where: {
      studentId: { in: [...new Set(rows.map((r) => r.studentId))] },
      courseId: { in: courses.map((c) => c.id) },
      status: "ACTIVE",
    },
    select: { studentId: true, courseId: true, course: { select: { subjectId: true } } },
    orderBy: { courseId: "asc" },
  });
  const byStudentSubject = new Map<string, number>();
  for (const e of enr) {
    const k = `${e.studentId}:${e.course.subjectId}`;
    if (!byStudentSubject.has(k)) byStudentSubject.set(k, e.courseId);
  }
  for (const r of rows) {
    const cid = byStudentSubject.get(`${r.studentId}:${r.clinicalCase.contentItem.topic.subjectId}`);
    if (cid !== undefined) out.set(r.id, cid);
  }
  return out;
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
          subject: { courses: { some: { teacherId } } },
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
  const courseOf = await resolveAttemptCourses(rows, teacherId);

  return rows
    .filter((a) => {
      const cid = courseOf.get(a.id); // faqat O'Z talabalarim (mening kursimga yozilganlar)
      return cid !== undefined && (!opts.courseId || cid === opts.courseId);
    })
    .map((a) => ({
      id: a.id,
      studentName: a.student.fullName,
      courseId: courseOf.get(a.id)!,
      subjectName: a.clinicalCase.contentItem.topic.subject.name,
      topicId: a.clinicalCase.contentItem.topicId,
      topic: a.clinicalCase.contentItem.topic.title,
      submittedAt: a.submittedAt,
      reviewedAt: a.reviewedAt,
      score: a.score,
      status: a.reviewedAt ? ("REVIEWED" as const) : ("PENDING" as const),
    }));
}

/** Distinct courses/topics that actually have case answers — for the filter dropdowns. */
export async function reviewFilters(teacherId: number) {
  const rows = await prisma.caseAttempt.findMany({
    where: { clinicalCase: { contentItem: { topic: { subject: { courses: { some: { teacherId } } } } } } },
    include: attemptInclude,
  });
  const courseOf = await resolveAttemptCourses(rows, teacherId);
  const courses = new Map<number, { id: number; name: string }>();
  const topics = new Map<number, { id: number; courseId: number; title: string }>();
  for (const a of rows) {
    const cid = courseOf.get(a.id);
    if (cid === undefined) continue;
    const tp = a.clinicalCase.contentItem.topic;
    courses.set(cid, { id: cid, name: tp.subject.name });
    topics.set(tp.id, { id: tp.id, courseId: cid, title: tp.title });
  }
  return { courses: [...courses.values()], topics: [...topics.values()] };
}

export async function getCaseAttemptForReview(teacherId: number, attemptId: number) {
  const a = await prisma.caseAttempt.findUnique({ where: { id: attemptId }, include: attemptInclude });
  if (!a) throw notFound("Keys javobi");
  const courseOf = await resolveAttemptCourses([a], teacherId);
  if (!courseOf.has(a.id)) throw forbidden();
  const caseJson = a.clinicalCase.caseJson as unknown as CaseJson;
  return {
    id: a.id,
    studentName: a.student.fullName,
    courseId: courseOf.get(a.id)!,
    subjectName: a.clinicalCase.contentItem.topic.subject.name,
    topic: a.clinicalCase.contentItem.topic.title,
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
  const courseOf = await resolveAttemptCourses([a], teacherId);
  if (!courseOf.has(a.id)) throw forbidden();
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
