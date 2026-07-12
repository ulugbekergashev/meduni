import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";
import { computeTopics, loadCourse, type CourseWithTopics, type FullFacts, type TopicOut } from "../me/service";

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}

const BEHIND_GAP = 30; // pct points below the group average
const INACTIVE_DAYS = 7;

async function ownCourse(courseId: number, teacherId: number): Promise<CourseWithTopics> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { teacherId: true } });
  if (!course) throw notFound("Kurs");
  if (course.teacherId !== teacherId) throw forbidden();
  return loadCourse(courseId); // published topics only
}

interface StudentRow {
  id: number;
  fullName: string;
  overallPct: number;
  completedCount: number;
  lastActiveAt: string | null;
  avgQuizScore: number | null;
  behind: boolean;
  cells: { topicId: number; state: TopicOut["state"]; pct: number; elements: TopicOut["elements"] }[];
}

/** Build the full progress matrix for a course in a handful of batched queries. */
async function buildMatrix(course: CourseWithTopics) {
  const topics = course.topics; // already ordered + published-only
  const topicIds = topics.map((t) => t.id);

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id, status: "ACTIVE" },
    include: { student: true },
    orderBy: { student: { fullName: "asc" } },
  });
  const students = enrollments.map((e) => e.student);
  const studentIds = students.map((s) => s.id);

  // quizId/caseId -> topicId
  const quizToTopic = new Map<number, number>();
  const caseToTopic = new Map<number, number>();
  for (const t of topics) {
    for (const c of t.contentItems) {
      if (c.quiz) quizToTopic.set(c.quiz.id, t.id);
      if (c.clinicalCase) caseToTopic.set(c.clinicalCase.id, t.id);
    }
  }

  const emptyRows: StudentRow[] = [];
  if (studentIds.length === 0 || topicIds.length === 0) {
    return { topics, students: emptyRows };
  }

  const [progressRows, quizAttempts, caseAttempts] = await Promise.all([
    prisma.progress.findMany({ where: { studentId: { in: studentIds }, topicId: { in: topicIds } } }),
    quizToTopic.size > 0
      ? prisma.quizAttempt.findMany({ where: { studentId: { in: studentIds }, quizId: { in: [...quizToTopic.keys()] }, finishedAt: { not: null } } })
      : Promise.resolve([]),
    caseToTopic.size > 0
      ? prisma.caseAttempt.findMany({ where: { studentId: { in: studentIds }, caseId: { in: [...caseToTopic.keys()] } } })
      : Promise.resolve([]),
  ]);

  const key = (s: number, t: number) => `${s}:${t}`;
  const progByKey = new Map(progressRows.map((p) => [key(p.studentId, p.topicId), p]));

  // best finished quiz score per (student, topic)
  const bestScore = new Map<string, number>();
  const studentScores = new Map<number, number[]>();
  const lastActive = new Map<number, number>(); // epoch ms
  const bump = (sid: number, d: Date | null) => {
    if (!d) return;
    lastActive.set(sid, Math.max(lastActive.get(sid) ?? 0, d.getTime()));
  };
  for (const a of quizAttempts) {
    const tid = quizToTopic.get(a.quizId)!;
    const k = key(a.studentId, tid);
    bestScore.set(k, Math.max(bestScore.get(k) ?? 0, a.scorePct));
    bump(a.studentId, a.finishedAt);
  }
  // avg quiz score per student = mean of best score across attempted quizzes
  for (const [k, v] of bestScore) {
    const sid = Number(k.split(":")[0]);
    (studentScores.get(sid) ?? studentScores.set(sid, []).get(sid)!).push(v);
  }

  const caseByKey = new Map<string, { submitted: boolean; reviewed: boolean }>();
  for (const a of caseAttempts) {
    const tid = caseToTopic.get(a.caseId)!;
    caseByKey.set(key(a.studentId, tid), { submitted: true, reviewed: a.reviewedAt !== null });
    bump(a.studentId, a.submittedAt);
  }
  for (const p of progressRows) bump(p.studentId, p.updatedAt);

  const kindsByTopic = new Map(topics.map((t) => [t.id, new Set(t.contentItems.map((c) => c.kind))]));

  const rows: StudentRow[] = students.map((s) => {
    const facts = new Map<number, FullFacts>();
    for (const t of topics) {
      const prog = progByKey.get(key(s.id, t.id));
      const kinds = kindsByTopic.get(t.id)!;
      const cs = caseByKey.get(key(s.id, t.id));
      const scoreK = key(s.id, t.id);
      facts.set(t.id, {
        hasVideo: kinds.has("VIDEO"),
        hasSlides: kinds.has("PRESENTATION"),
        hasQuiz: kinds.has("QUIZ"),
        hasCase: kinds.has("CASE"),
        videoWatchedPct: prog?.videoWatchedPct ?? 0,
        slidesViewed: prog?.slidesViewed ?? false,
        forceComplete: prog?.overriddenAt != null,
        quizScore: bestScore.has(scoreK) ? bestScore.get(scoreK)! : null,
        caseSubmitted: cs?.submitted ?? false,
        caseReviewed: cs?.reviewed ?? false,
      });
    }
    const computed = computeTopics(course, facts);
    const completedCount = computed.filter((c) => c.state === "COMPLETED").length;
    const overallPct = topics.length === 0 ? 0 : Math.round((completedCount / topics.length) * 100);
    const scores = studentScores.get(s.id) ?? [];
    const avgQuizScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const la = lastActive.get(s.id);
    return {
      id: s.id,
      fullName: s.fullName,
      overallPct,
      completedCount,
      lastActiveAt: la ? new Date(la).toISOString() : null,
      avgQuizScore,
      behind: false, // set after we know the average
      cells: computed.map((c) => ({ topicId: c.id, state: c.state, pct: c.pct, elements: c.elements })),
    };
  });

  // Behind = well below the group average, or inactive for a while (having started).
  const avgProgress = rows.length ? Math.round(rows.reduce((a, r) => a + r.overallPct, 0) / rows.length) : 0;
  const now = Date.now();
  for (const r of rows) {
    const inactiveDays = r.lastActiveAt ? (now - new Date(r.lastActiveAt).getTime()) / 86_400_000 : Infinity;
    const hasActivity = r.lastActiveAt !== null || r.overallPct > 0;
    r.behind =
      (r.overallPct + BEHIND_GAP <= avgProgress && avgProgress > 0) ||
      (hasActivity && inactiveDays >= INACTIVE_DAYS && r.overallPct < 100);
  }

  return { topics, students: rows, avgProgress };
}

export async function getCourseProgress(courseId: number, teacherId: number) {
  const course = await ownCourse(courseId, teacherId);
  const { topics, students, avgProgress } = await buildMatrix(course);

  const active = students.filter((s) => s.lastActiveAt !== null || s.overallPct > 0).length;
  const behind = students.filter((s) => s.behind).length;
  const completed = students.filter((s) => topics.length > 0 && s.completedCount === topics.length).length;

  return {
    courseId,
    stats: { total: students.length, active, behind, avgProgress: avgProgress ?? 0, completed },
    topics: topics.map((t) => ({ id: t.id, titleUz: t.titleUz, titleRu: t.titleRu, orderIndex: t.orderIndex })),
    students,
  };
}

/** Teacher force-opens a topic for one student (overrides the sequential lock). */
export async function manualUnlock(courseId: number, teacherId: number, studentId: number, topicId: number) {
  await ownCourse(courseId, teacherId);
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { courseId: true } });
  if (!topic || topic.courseId !== courseId) throw notFound("Mavzu");
  const enrolled = await prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId, courseId } } });
  if (!enrolled) throw notFound("Talaba");

  await prisma.progress.upsert({
    where: { studentId_topicId: { studentId, topicId } },
    create: { studentId, topicId, state: "COMPLETED", overriddenAt: new Date(), overriddenById: teacherId, completedAt: new Date() },
    update: { overriddenAt: new Date(), overriddenById: teacherId, state: "COMPLETED", completedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { actorId: teacherId, action: "MANUAL_UNLOCK", entity: "Topic", entityId: topicId, detailsJson: { studentId, courseId } },
  });
  return { ok: true };
}

// ---------- Teacher dashboard ----------

export async function getTeacherDashboard(teacherId: number) {
  const courses = await prisma.course.findMany({ where: { teacherId }, orderBy: { id: "asc" } });

  let studentsBehind = 0;
  const courseCards = [];
  for (const c of courses) {
    const loaded = await loadCourse(c.id);
    const { students, avgProgress } = await buildMatrix(loaded);
    studentsBehind += students.filter((s) => s.behind).length;
    courseCards.push({
      id: loaded.id,
      subjectNameUz: loaded.subject.nameUz,
      subjectNameRu: loaded.subject.nameRu,
      groupName: loaded.courseGroups[0]?.group.name ?? null,
      semester: loaded.semester,
      studentCount: students.length,
      avgProgress: avgProgress ?? 0,
    });
  }

  const [casesToReview, contentToApprove] = await Promise.all([
    prisma.caseAttempt.count({
      where: { reviewedAt: null, clinicalCase: { contentItem: { topic: { course: { teacherId } } } } },
    }),
    prisma.contentItem.count({
      where: { status: { in: ["DRAFT", "REVIEW"] }, topic: { course: { teacherId } } },
    }),
  ]);

  return {
    courses: courseCards,
    tasks: { casesToReview, contentToApprove, studentsBehind },
  };
}

// ---------- Excel export ----------

const stateLabel: Record<TopicOut["state"], string> = {
  COMPLETED: "Tugallandi",
  IN_PROGRESS: "Jarayonda",
  AVAILABLE: "Ochiq",
  LOCKED: "Yopiq",
};

export async function exportProgress(courseId: number, teacherId: number, view: "heatmap" | "list"): Promise<Buffer> {
  const course = await ownCourse(courseId, teacherId);
  const { topics, students } = await buildMatrix(course);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Progress");

  if (view === "heatmap") {
    ws.addRow(["Talaba", ...topics.map((t) => `${t.orderIndex}. ${t.titleUz}`), "Umumiy %"]);
    for (const s of students) {
      const byTopic = new Map(s.cells.map((c) => [c.topicId, c]));
      ws.addRow([s.fullName, ...topics.map((t) => stateLabel[byTopic.get(t.id)?.state ?? "LOCKED"]), s.overallPct]);
    }
  } else {
    ws.addRow(["FISH", "Progress %", "Tugatgan", "Oxirgi faollik", "Oʻrtacha test"]);
    for (const s of students) {
      ws.addRow([
        s.fullName,
        s.overallPct,
        `${s.completedCount}/${topics.length}`,
        s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString("ru-RU") : "—",
        s.avgQuizScore ?? "—",
      ]);
    }
  }
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 18));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
