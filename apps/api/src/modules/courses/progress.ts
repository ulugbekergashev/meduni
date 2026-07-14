import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";
import { computeTopics, loadCourse, studentFactsMap, type CourseWithTopics, type FullFacts, type TopicOut } from "../me/service";

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
export async function buildMatrix(course: CourseWithTopics) {
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

// ---------- Groups a course is taught in (course profile "Guruhlar" tab) ----------

export async function getCourseGroupsStats(courseId: number, teacherId: number) {
  const course = await ownCourse(courseId, teacherId);
  const { students } = await buildMatrix(course);

  const [cgs, users] = await Promise.all([
    prisma.courseGroup.findMany({ where: { courseId }, include: { group: { include: { faculty: true } } } }),
    students.length
      ? prisma.user.findMany({ where: { id: { in: students.map((s) => s.id) } }, select: { id: true, groupId: true } })
      : Promise.resolve([]),
  ]);
  const groupOf = new Map(users.map((u) => [u.id, u.groupId]));

  return cgs.map((cg) => {
    const rows = students.filter((s) => groupOf.get(s.id) === cg.groupId);
    const avgProgress = rows.length ? Math.round(rows.reduce((a, r) => a + r.overallPct, 0) / rows.length) : 0;
    return {
      groupId: cg.groupId,
      name: cg.group.name,
      yearOfStudy: cg.group.yearOfStudy,
      facultyNameUz: cg.group.faculty.nameUz,
      facultyNameRu: cg.group.faculty.nameRu,
      studentCount: rows.length,
      avgProgress,
    };
  });
}

// ---------- Single student detail (from the group) ----------

/** Everything a teacher needs about one student across their own courses:
 *  attendance, per-topic progress, quiz scores, case answers + grades. */
export async function getStudentDetail(teacherId: number, studentId: number) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE", course: { teacherId } },
    include: { course: { include: { subject: true } } },
    orderBy: { courseId: "asc" },
  });
  if (enrollments.length === 0) throw forbidden(); // not this teacher's student

  const student = await prisma.user.findUnique({ where: { id: studentId }, include: { group: true } });
  if (!student) throw notFound("Talaba");

  const courses = [];
  for (const enr of enrollments) {
    const course = await loadCourse(enr.courseId);
    const facts = await studentFactsMap(studentId, course);
    const topicOuts = computeTopics(course, facts);
    const topicIds = topicOuts.map((t) => t.id);

    const [attendance, caseAttempts] = await Promise.all([
      prisma.attendance.findMany({ where: { studentId, session: { courseId: enr.courseId } } }),
      topicIds.length
        ? prisma.caseAttempt.findMany({
            where: { studentId, clinicalCase: { contentItem: { topicId: { in: topicIds } } } },
            include: { clinicalCase: { include: { contentItem: true } } },
          })
        : Promise.resolve([]),
    ]);

    let present = 0, absent = 0, late = 0, excused = 0;
    const grades: number[] = [];
    for (const a of attendance) {
      if (a.status === "PRESENT") present++;
      else if (a.status === "ABSENT") absent++;
      else if (a.status === "LATE") late++;
      else if (a.status === "EXCUSED") excused++;
      if (a.grade !== null) grades.push(a.grade);
    }
    const marked = present + absent + late + excused;
    const caseByTopic = new Map(caseAttempts.map((ca) => [ca.clinicalCase.contentItem.topicId, ca]));

    const completedCount = topicOuts.filter((t) => t.state === "COMPLETED").length;
    courses.push({
      courseId: course.id,
      subjectNameUz: course.subject.nameUz,
      subjectNameRu: course.subject.nameRu,
      topicsTotal: topicOuts.length,
      completedCount,
      overallPct: topicOuts.length === 0 ? 0 : Math.round((completedCount / topicOuts.length) * 100),
      attendance: {
        present,
        absent,
        late,
        excused,
        pct: marked === 0 ? null : Math.round(((present + late) / marked) * 100),
        avgGrade: grades.length === 0 ? null : Math.round(grades.reduce((a, b) => a + b, 0) / grades.length),
      },
      topics: topicOuts.map((t) => {
        const ca = caseByTopic.get(t.id);
        return {
          id: t.id,
          titleUz: t.titleUz,
          titleRu: t.titleRu,
          state: t.state,
          pct: t.pct,
          hasQuiz: t.elements.quiz.exists,
          quizScore: t.elements.quiz.score,
          hasCase: t.elements.case.exists,
          caseSubmitted: t.elements.case.submitted,
          caseReviewed: t.elements.case.reviewed,
          caseScore: ca?.score ?? null,
          caseFeedback: ca?.teacherFeedback ?? null,
          caseAttemptId: ca?.id ?? null,
        };
      }),
    });
  }

  return {
    student: { id: student.id, fullName: student.fullName, email: student.email, groupId: student.groupId, groupName: student.group?.name ?? null },
    courses,
  };
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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const courseIds = courses.map((c) => c.id);
  const inCourses = { in: courseIds };

  const [casesToReview, contentToApprove, upcoming, distinctStudents, courseGroups, publishedTopics, totalTopics, publishedContent, casesReviewed, attMarks] = await Promise.all([
    prisma.caseAttempt.count({ where: { reviewedAt: null, clinicalCase: { contentItem: { topic: { course: { teacherId } } } } } }),
    prisma.contentItem.count({ where: { status: { in: ["DRAFT", "REVIEW"] }, topic: { course: { teacherId } } } }),
    prisma.lessonSession.findMany({ where: { course: { teacherId }, date: { gte: startOfToday } }, orderBy: { date: "asc" }, take: 5, include: { course: { include: { subject: true, courseGroups: true } }, topic: true } }),
    prisma.enrollment.findMany({ where: { courseId: inCourses, status: "ACTIVE" }, distinct: ["studentId"], select: { studentId: true } }),
    prisma.courseGroup.findMany({ where: { courseId: inCourses }, include: { group: true } }),
    prisma.topic.count({ where: { courseId: inCourses, contentItems: { some: { status: "PUBLISHED" } } } }),
    prisma.topic.count({ where: { courseId: inCourses } }),
    prisma.contentItem.count({ where: { status: "PUBLISHED", topic: { courseId: inCourses } } }),
    prisma.caseAttempt.count({ where: { reviewedById: teacherId } }),
    prisma.attendance.groupBy({ by: ["status"], where: { session: { courseId: inCourses } }, _count: true }),
  ]);

  // Distinct groups the teacher teaches.
  const groupMap = new Map<number, string>();
  for (const cg of courseGroups) groupMap.set(cg.groupId, cg.group.name);

  // Overall attendance %: (present + late) / marked across all their sessions.
  let present = 0, late = 0, marked = 0;
  for (const m of attMarks) {
    marked += m._count;
    if (m.status === "PRESENT") present += m._count;
    else if (m.status === "LATE") late += m._count;
  }
  const avgAttendance = marked === 0 ? null : Math.round(((present + late) / marked) * 100);
  const avgProgress = courseCards.length ? Math.round(courseCards.reduce((a, c) => a + c.avgProgress, 0) / courseCards.length) : 0;

  return {
    courses: courseCards,
    tasks: { casesToReview, contentToApprove, studentsBehind },
    stats: {
      students: distinctStudents.length,
      courses: courses.length,
      groups: [...groupMap.values()],
      publishedTopics,
      totalTopics,
      publishedContent,
      casesReviewed,
      avgProgress,
      avgAttendance,
    },
    upcomingSessions: upcoming.map((s) => ({
      id: s.id,
      courseId: s.courseId,
      groupId: s.course.courseGroups[0]?.groupId ?? null, // sessions live in the group profile
      date: s.date,
      subjectNameUz: s.course.subject.nameUz,
      subjectNameRu: s.course.subject.nameRu,
      title: s.title ?? s.topic?.titleUz ?? null,
      room: s.room,
    })),
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
