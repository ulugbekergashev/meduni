import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";
import { DEFAULT_RULE, evaluateRule, lockedReason, type Facts, type Reason, type UnlockRule } from "./rules";

// A topic is visible to students only once it has at least one PUBLISHED content
// item. Un-published topics don't appear on the path at all.
const topicInclude = {
  contentItems: { where: { status: "PUBLISHED" }, include: { quiz: true, clinicalCase: true } },
} satisfies Prisma.TopicInclude;

// Faza 3: mavzular FANGA tegishli — kurs o'z fanining mavzularini ko'rsatadi.
const courseInclude = {
  subject: { include: { topics: { orderBy: { orderIndex: "asc" }, include: topicInclude } } },
  teacher: true,
  courseGroups: { include: { group: true } },
} satisfies Prisma.CourseInclude;

type CourseRow = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;
type TopicWithContent = CourseRow["subject"]["topics"][number];
// Downstream kod (progress matritsa, tasks, lesson) `course.topics` bilan ishlaydi —
// loadCourse fan mavzularini shu maydonga normalizatsiya qiladi.
export type CourseWithTopics = CourseRow & { topics: TopicWithContent[] };

// Facts + extras: slides-viewed (shown on the card, doesn't gate) and a teacher
// manual-override flag that force-completes the topic (unlocks the next one).
export interface FullFacts extends Facts {
  slidesViewed: boolean;
  forceComplete: boolean;
}

function resolveRule(topic: TopicWithContent, course: CourseWithTopics): UnlockRule {
  const raw = (topic.unlockRuleJson ?? course.defaultUnlockRuleJson) as Partial<UnlockRule> | null;
  return { ...DEFAULT_RULE, ...(raw ?? {}) };
}

function buildElements(facts: FullFacts) {
  return {
    video: { exists: facts.hasVideo, watchedPct: facts.videoWatchedPct },
    slides: { exists: facts.hasSlides, viewed: facts.slidesViewed },
    quiz: { exists: facts.hasQuiz, score: facts.quizScore },
    case: { exists: facts.hasCase, submitted: facts.caseSubmitted, reviewed: facts.caseReviewed },
  };
}

export interface TopicOut {
  id: number;
  title: string;
  orderIndex: number;
  state: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";
  pct: number;
  reason: Reason | null;
  elements: ReturnType<typeof buildElements>;
}

/** The heart of the module: walk the topics in order, unlocking each only after
 *  the previous one is COMPLETED. Every LOCKED topic carries a concrete reason. */
export function computeTopics(course: CourseWithTopics, factsByTopic: Map<number, FullFacts>): TopicOut[] {
  const out: TopicOut[] = [];
  let prevCompleted = true; // the first topic is always open
  let prevUnmet: Reason[] = [];

  for (const topic of course.topics) {
    const rule = resolveRule(topic, course);
    const facts = factsByTopic.get(topic.id)!;
    const evaluated = evaluateRule(facts, rule);
    // A teacher override force-completes the topic regardless of the student's facts.
    const completed = evaluated.completed || facts.forceComplete;
    const pct = facts.forceComplete ? 100 : evaluated.pct;
    const dateOk = evaluated.dateOk || facts.forceComplete;
    const unmet = completed ? [] : evaluated.unmet;

    let state: TopicOut["state"];
    let reason: Reason | null = null;

    if (completed) {
      state = "COMPLETED";
    } else if (prevCompleted && dateOk) {
      state = pct > 0 ? "IN_PROGRESS" : "AVAILABLE";
    } else {
      state = "LOCKED";
      reason = lockedReason(rule, prevUnmet);
    }

    out.push({
      id: topic.id,
      title: topic.title,
      orderIndex: topic.orderIndex,
      state,
      pct,
      reason,
      elements: buildElements(facts),
    });

    prevCompleted = completed;
    prevUnmet = unmet;
  }

  return out;
}

/** Gather every fact the unlock engine needs for a student across a course's topics,
 *  in a few batched queries: progress rows, best quiz scores, case submissions. */
export async function studentFactsMap(studentId: number, course: CourseWithTopics): Promise<Map<number, FullFacts>> {
  const topicIds = course.topics.map((t) => t.id);
  const map = new Map<number, FullFacts>();
  if (topicIds.length === 0) return map;

  const progressRows = await prisma.progress.findMany({
    where: { studentId, topicId: { in: topicIds } },
    select: { topicId: true, videoWatchedPct: true, slidesViewed: true, overriddenAt: true },
  });
  const progressByTopic = new Map(progressRows.map((r) => [r.topicId, r]));

  // quizId -> topicId, caseId -> topicId
  const quizToTopic = new Map<number, number>();
  const caseToTopic = new Map<number, number>();
  for (const topic of course.topics) {
    for (const c of topic.contentItems) {
      if (c.quiz) quizToTopic.set(c.quiz.id, topic.id);
      if (c.clinicalCase) caseToTopic.set(c.clinicalCase.id, topic.id);
    }
  }

  // Best finished quiz score per topic.
  const bestScore = new Map<number, number>();
  if (quizToTopic.size > 0) {
    const attempts = await prisma.quizAttempt.findMany({
      where: { studentId, quizId: { in: [...quizToTopic.keys()] }, finishedAt: { not: null } },
      select: { quizId: true, scorePct: true },
    });
    for (const a of attempts) {
      const tid = quizToTopic.get(a.quizId)!;
      bestScore.set(tid, Math.max(bestScore.get(tid) ?? 0, a.scorePct));
    }
  }

  // Case submission / review per topic.
  const caseState = new Map<number, { submitted: boolean; reviewed: boolean }>();
  if (caseToTopic.size > 0) {
    const caseAttempts = await prisma.caseAttempt.findMany({
      where: { studentId, caseId: { in: [...caseToTopic.keys()] } },
      select: { caseId: true, reviewedAt: true },
    });
    for (const a of caseAttempts) {
      const tid = caseToTopic.get(a.caseId)!;
      caseState.set(tid, { submitted: true, reviewed: a.reviewedAt !== null });
    }
  }

  for (const topic of course.topics) {
    const kinds = new Set(topic.contentItems.map((c) => c.kind));
    const prog = progressByTopic.get(topic.id);
    const cs = caseState.get(topic.id);
    map.set(topic.id, {
      hasVideo: kinds.has("VIDEO"),
      hasSlides: kinds.has("PRESENTATION"),
      hasQuiz: kinds.has("QUIZ"),
      hasCase: kinds.has("CASE"),
      videoWatchedPct: prog?.videoWatchedPct ?? 0,
      slidesViewed: prog?.slidesViewed ?? false,
      forceComplete: prog?.overriddenAt != null,
      quizScore: bestScore.has(topic.id) ? bestScore.get(topic.id)! : null,
      caseSubmitted: cs?.submitted ?? false,
      caseReviewed: cs?.reviewed ?? false,
    });
  }

  return map;
}

function courseSummary(course: CourseWithTopics, topics: TopicOut[]) {
  const total = topics.length;
  const completed = topics.filter((t) => t.state === "COMPLETED").length;
  const next = topics.find((t) => t.state === "AVAILABLE" || t.state === "IN_PROGRESS") ?? null;
  return {
    id: course.id,
    subjectName: course.subject.name,
    teacherName: course.teacher.fullName,
    groupName: course.courseGroups[0]?.group.name ?? null,
    topicsTotal: total,
    topicsCompleted: completed,
    progressPct: total === 0 ? 0 : Math.round((completed / total) * 100),
    nextTopic: next?.title ?? null,
    nextTopicId: next?.id ?? null,
  };
}

export async function enrolledCourseIds(studentId: number): Promise<number[]> {
  const rows = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    select: { courseId: true },
    orderBy: { courseId: "asc" },
  });
  return rows.map((r) => r.courseId);
}

export async function loadCourse(courseId: number): Promise<CourseWithTopics> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: courseInclude });
  if (!course) throw notFound("Kurs");
  // Only topics with at least one PUBLISHED content item are visible to students;
  // topics still being built (no published content) don't appear on the path at all.
  return { ...course, topics: course.subject.topics.filter((t) => t.contentItems.length > 0) };
}

/** GET /me/courses — enrolled courses with a progress summary each. */
export async function listMyCourses(studentId: number) {
  const ids = await enrolledCourseIds(studentId);
  const summaries = [];
  for (const id of ids) {
    const course = await loadCourse(id);
    const pm = await studentFactsMap(studentId, course);
    summaries.push(courseSummary(course, computeTopics(course, pm)));
  }
  return summaries;
}

/** GET /me/courses/:id — a course's full topic path for the student. */
export async function getMyCourse(studentId: number, courseId: number) {
  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });
  if (!enrolled || enrolled.status !== "ACTIVE") {
    throw new ApiError(403, "forbidden", "Siz bu kursga yozilmagansiz", "Вы не записаны на этот курс");
  }
  const course = await loadCourse(courseId);
  const pm = await studentFactsMap(studentId, course);
  const topics = computeTopics(course, pm);
  return {
    id: course.id,
    subjectName: course.subject.name,
    teacherName: course.teacher.fullName,
    groupName: course.courseGroups[0]?.group.name ?? null,
    topicsTotal: topics.length,
    topicsCompleted: topics.filter((t) => t.state === "COMPLETED").length,
    progressPct: topics.length === 0 ? 0 : Math.round((topics.filter((t) => t.state === "COMPLETED").length / topics.length) * 100),
    topics,
  };
}

/** GET /me/dashboard — the "continue" block + course cards. */
export async function getDashboard(studentId: number) {
  const me = await prisma.user.findUnique({ where: { id: studentId }, select: { fullName: true } });
  const ids = await enrolledCourseIds(studentId);

  const courses = [];
  let resume: {
    courseId: number;
    subjectName: string;
    topicId: number;
    topic: string;
    pct: number;
  } | null = null;

  for (const id of ids) {
    const course = await loadCourse(id);
    const pm = await studentFactsMap(studentId, course);
    const topics = computeTopics(course, pm);
    courses.push(courseSummary(course, topics));

    if (!resume) {
      // Prefer an in-progress topic; otherwise the first available one.
      const current = topics.find((t) => t.state === "IN_PROGRESS") ?? topics.find((t) => t.state === "AVAILABLE");
      if (current) {
        resume = {
          courseId: course.id,
          subjectName: course.subject.name,
          topicId: current.id,
          topic: current.title,
          pct: current.pct,
        };
      }
    }
  }

  // Notifications: recently graded clinical cases ("your case was reviewed").
  const reviewed = await prisma.caseAttempt.findMany({
    where: { studentId, reviewedAt: { not: null } },
    orderBy: { reviewedAt: "desc" },
    take: 5,
    include: { clinicalCase: { include: { contentItem: { include: { topic: true } } } } },
  });
  const notifications = reviewed.map((a) => ({
    type: "case_reviewed" as const,
    caseAttemptId: a.id,
    topicId: a.clinicalCase.contentItem.topicId,
    topic: a.clinicalCase.contentItem.topic.title,
    score: a.score,
    reviewedAt: a.reviewedAt,
  }));

  return { fullName: me?.fullName ?? "", resume, courses, notifications };
}

// ---------- Shared access helpers (used by the lesson module) ----------

export function forbiddenNotEnrolled(): ApiError {
  return new ApiError(403, "forbidden", "Siz bu kursga yozilmagansiz", "Вы не записаны на этот курс");
}

export function forbiddenLocked(reason?: Reason): ApiError {
  return new ApiError(
    403,
    "topic_locked",
    reason?.uz ?? "Bu mavzu hali ochilmagan",
    reason?.ru ?? "Эта тема ещё не открыта"
  );
}

/** Faza 3: mavzu fanga tegishli — talabaning shu fandan ACTIVE yozilgan kursini topamiz. */
export async function enrolledCourseIdForTopic(studentId: number, topicId: number): Promise<number | null> {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { subjectId: true } });
  if (!topic) throw notFound("Mavzu");
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, status: "ACTIVE", course: { subjectId: topic.subjectId } },
    orderBy: { courseId: "asc" },
    select: { courseId: true },
  });
  return enrollment?.courseId ?? null;
}

/** Recomputes a single topic's state for the student, enforcing enrollment,
 *  published-visibility and the sequential lock. Throws 403/404 as appropriate. */
export async function assertTopicOpen(studentId: number, topicId: number): Promise<TopicOut> {
  const courseId = await enrolledCourseIdForTopic(studentId, topicId);
  if (courseId === null) throw forbiddenNotEnrolled();

  const course = await loadCourse(courseId);
  const facts = await studentFactsMap(studentId, course);
  const computed = computeTopics(course, facts);
  const state = computed.find((t) => t.id === topicId);
  if (!state) throw notFound("Mavzu"); // not published -> invisible to students
  if (state.state === "LOCKED") throw forbiddenLocked(state.reason ?? undefined);
  return state;
}

/** Recompute + return a single topic's fresh state (no lock enforcement) — used
 *  after a student action to report whether the topic just completed. */
export async function recomputeTopic(studentId: number, topicId: number): Promise<TopicOut | null> {
  const courseId = await enrolledCourseIdForTopic(studentId, topicId);
  if (courseId === null) return null;
  const course = await loadCourse(courseId);
  const facts = await studentFactsMap(studentId, course);
  return computeTopics(course, facts).find((t) => t.id === topicId) ?? null;
}

/** Recompute a topic's state and persist it to Progress (for the heatmap / completion
 *  stamp). Shared by student actions (lesson) and teacher grading (case review). */
export async function syncTopicProgress(studentId: number, topicId: number): Promise<TopicOut | null> {
  const t = await recomputeTopic(studentId, topicId);
  if (!t) return null;
  const row = await prisma.progress.upsert({
    where: { studentId_topicId: { studentId, topicId } },
    create: { studentId, topicId, state: t.state, completedAt: t.state === "COMPLETED" ? new Date() : null },
    update: { state: t.state },
  });
  if (t.state === "COMPLETED" && row.completedAt === null) {
    await prisma.progress.update({ where: { id: row.id }, data: { completedAt: new Date() } });
  }
  return t;
}
