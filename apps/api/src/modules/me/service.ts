import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";
import { DEFAULT_RULE, evaluateRule, lockedReason, type Facts, type Reason, type UnlockRule } from "./rules";

// A topic is visible to students only once it has at least one PUBLISHED content
// item. Un-published topics don't appear on the path at all.
const topicInclude = {
  contentItems: { where: { status: "PUBLISHED" }, include: { quiz: true } },
} satisfies Prisma.TopicInclude;

const courseInclude = {
  subject: true,
  teacher: true,
  courseGroups: { include: { group: true } },
  topics: { orderBy: { orderIndex: "asc" }, include: topicInclude },
} satisfies Prisma.CourseInclude;

type CourseWithTopics = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;
type TopicWithContent = CourseWithTopics["topics"][number];

function resolveRule(topic: TopicWithContent, course: CourseWithTopics): UnlockRule {
  const raw = (topic.unlockRuleJson ?? course.defaultUnlockRuleJson) as Partial<UnlockRule> | null;
  return { ...DEFAULT_RULE, ...(raw ?? {}) };
}

interface ProgressRow {
  videoWatchedPct: number;
}

function buildFacts(topic: TopicWithContent, progress: ProgressRow | undefined): Facts {
  const kinds = new Set(topic.contentItems.map((c) => c.kind));
  return {
    hasVideo: kinds.has("VIDEO"),
    hasSlides: kinds.has("PRESENTATION"),
    hasQuiz: kinds.has("QUIZ"),
    hasCase: kinds.has("CASE"),
    videoWatchedPct: progress?.videoWatchedPct ?? 0,
    // Quiz score and case submission come from student attempts (Module 12);
    // until then there are no attempts, so these stay at their "not done" values.
    quizScore: null,
    caseSubmitted: false,
    caseReviewed: false,
  };
}

function buildElements(topic: TopicWithContent, facts: Facts) {
  return {
    video: { exists: facts.hasVideo, watchedPct: facts.videoWatchedPct },
    slides: { exists: facts.hasSlides, viewed: false },
    quiz: { exists: facts.hasQuiz, score: facts.quizScore },
    case: { exists: facts.hasCase, submitted: facts.caseSubmitted, reviewed: facts.caseReviewed },
  };
}

export interface TopicOut {
  id: number;
  titleUz: string;
  titleRu: string;
  orderIndex: number;
  state: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";
  pct: number;
  reason: Reason | null;
  elements: ReturnType<typeof buildElements>;
}

/** The heart of the module: walk the topics in order, unlocking each only after
 *  the previous one is COMPLETED. Every LOCKED topic carries a concrete reason. */
function computeTopics(course: CourseWithTopics, progressByTopic: Map<number, ProgressRow>): TopicOut[] {
  const out: TopicOut[] = [];
  let prevCompleted = true; // the first topic is always open
  let prevUnmet: Reason[] = [];

  for (const topic of course.topics) {
    const rule = resolveRule(topic, course);
    const facts = buildFacts(topic, progressByTopic.get(topic.id));
    const { completed, pct, dateOk, unmet } = evaluateRule(facts, rule);

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
      titleUz: topic.titleUz,
      titleRu: topic.titleRu,
      orderIndex: topic.orderIndex,
      state,
      pct,
      reason,
      elements: buildElements(topic, facts),
    });

    prevCompleted = completed;
    prevUnmet = unmet;
  }

  return out;
}

async function progressMap(studentId: number, topicIds: number[]): Promise<Map<number, ProgressRow>> {
  if (topicIds.length === 0) return new Map();
  const rows = await prisma.progress.findMany({
    where: { studentId, topicId: { in: topicIds } },
    select: { topicId: true, videoWatchedPct: true },
  });
  return new Map(rows.map((r) => [r.topicId, { videoWatchedPct: r.videoWatchedPct }]));
}

function courseSummary(course: CourseWithTopics, topics: TopicOut[]) {
  const total = topics.length;
  const completed = topics.filter((t) => t.state === "COMPLETED").length;
  const next = topics.find((t) => t.state === "AVAILABLE" || t.state === "IN_PROGRESS") ?? null;
  return {
    id: course.id,
    subjectNameUz: course.subject.nameUz,
    subjectNameRu: course.subject.nameRu,
    teacherName: course.teacher.fullName,
    groupName: course.courseGroups[0]?.group.name ?? null,
    topicsTotal: total,
    topicsCompleted: completed,
    progressPct: total === 0 ? 0 : Math.round((completed / total) * 100),
    nextTopicUz: next?.titleUz ?? null,
    nextTopicRu: next?.titleRu ?? null,
    nextTopicId: next?.id ?? null,
  };
}

async function enrolledCourseIds(studentId: number): Promise<number[]> {
  const rows = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    select: { courseId: true },
    orderBy: { courseId: "asc" },
  });
  return rows.map((r) => r.courseId);
}

async function loadCourse(courseId: number): Promise<CourseWithTopics> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: courseInclude });
  if (!course) throw notFound("Kurs");
  // Only topics with at least one PUBLISHED content item are visible to students;
  // topics still being built (no published content) don't appear on the path at all.
  course.topics = course.topics.filter((t) => t.contentItems.length > 0);
  return course;
}

/** GET /me/courses — enrolled courses with a progress summary each. */
export async function listMyCourses(studentId: number) {
  const ids = await enrolledCourseIds(studentId);
  const summaries = [];
  for (const id of ids) {
    const course = await loadCourse(id);
    const pm = await progressMap(studentId, course.topics.map((t) => t.id));
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
  const pm = await progressMap(studentId, course.topics.map((t) => t.id));
  const topics = computeTopics(course, pm);
  return {
    id: course.id,
    subjectNameUz: course.subject.nameUz,
    subjectNameRu: course.subject.nameRu,
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
    subjectNameUz: string;
    subjectNameRu: string;
    topicId: number;
    topicUz: string;
    topicRu: string;
    pct: number;
  } | null = null;

  for (const id of ids) {
    const course = await loadCourse(id);
    const pm = await progressMap(studentId, course.topics.map((t) => t.id));
    const topics = computeTopics(course, pm);
    courses.push(courseSummary(course, topics));

    if (!resume) {
      // Prefer an in-progress topic; otherwise the first available one.
      const current = topics.find((t) => t.state === "IN_PROGRESS") ?? topics.find((t) => t.state === "AVAILABLE");
      if (current) {
        resume = {
          courseId: course.id,
          subjectNameUz: course.subject.nameUz,
          subjectNameRu: course.subject.nameRu,
          topicId: current.id,
          topicUz: current.titleUz,
          topicRu: current.titleRu,
          pct: current.pct,
        };
      }
    }
  }

  return { fullName: me?.fullName ?? "", resume, courses, notifications: [] as unknown[] };
}
