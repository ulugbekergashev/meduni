import argon2 from "argon2";
import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const f: Prisma.DateTimeFilter = {};
  if (from) f.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    f.lte = end;
  }
  return from || to ? f : undefined;
}

/** Attendance % = came (present + late) out of sessions actually marked for the
 *  student. Same formula the teacher's report uses, so the numbers match. */
function attendancePct(present: number, absent: number, late: number, excused: number): number | null {
  const marked = present + absent + late + excused;
  return marked === 0 ? null : Math.round(((present + late) / marked) * 100);
}

export async function getMyAttendance(studentId: number, opts: { courseId?: number; from?: string; to?: string }) {
  const range = dateRange(opts.from, opts.to);
  const rows = await prisma.attendance.findMany({
    where: {
      studentId, // only my own records — no cross-student leak possible
      session: { ...(opts.courseId ? { courseId: opts.courseId } : {}), ...(range ? { date: range } : {}) },
    },
    include: { session: { include: { course: { include: { subject: true } }, topic: true } } },
    orderBy: { session: { date: "desc" } },
  });

  let present = 0, absent = 0, late = 0, excused = 0;
  for (const r of rows) {
    if (r.status === "PRESENT") present++;
    else if (r.status === "ABSENT") absent++;
    else if (r.status === "LATE") late++;
    else if (r.status === "EXCUSED") excused++;
  }

  // Kurslar kesimi va oylik trend — o'sha qatorlardan JS'da yig'iladi.
  type Bucket = { present: number; absent: number; late: number; excused: number };
  const empty = (): Bucket => ({ present: 0, absent: 0, late: 0, excused: 0 });
  const add = (b: Bucket, s: Status) => {
    if (s === "PRESENT") b.present++;
    else if (s === "ABSENT") b.absent++;
    else if (s === "LATE") b.late++;
    else b.excused++;
  };
  const marked = (b: Bucket) => b.present + b.absent + b.late + b.excused;

  const courseMap = new Map<number, { name: string; b: Bucket }>();
  const monthMap = new Map<string, Bucket>();
  for (const r of rows) {
    const cid = r.session.courseId;
    if (!courseMap.has(cid)) courseMap.set(cid, { name: r.session.course.subject.name, b: empty() });
    add(courseMap.get(cid)!.b, r.status as Status);

    const d = r.session.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) monthMap.set(key, empty());
    add(monthMap.get(key)!, r.status as Status);
  }

  return {
    stats: { present, absent, late, excused, pct: attendancePct(present, absent, late, excused) },
    byCourse: [...courseMap.entries()]
      .map(([courseId, { name, b }]) => ({
        courseId,
        courseName: name,
        ...b,
        marked: marked(b),
        pct: attendancePct(b.present, b.absent, b.late, b.excused),
      }))
      .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101)), // eng past birinchi — diqqat kerak
    byMonth: [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, b]) => ({
        month,
        marked: marked(b),
        pct: attendancePct(b.present, b.absent, b.late, b.excused) ?? 0,
      })),
    sessions: rows.map((r) => ({
      id: r.session.id,
      date: r.session.date,
      courseName: r.session.course.subject.name,
      title: r.session.title ?? r.session.topic?.title ?? null,
      status: r.status as Status,
    })),
  };
}

/** GET /me/grades — barcha baholar: test natijalari + keys baholari, kurslar kesimida. */
export async function getMyGrades(studentId: number) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    select: { course: { select: { id: true, subjectId: true, semester: true, academicYear: true, subject: { select: { name: true } } } } },
    orderBy: [{ course: { academicYear: "desc" } }, { course: { semester: "desc" } }],
  });
  if (enrollments.length === 0) return { courses: [], summary: { avgQuiz: null, quizzesPassed: 0, casesGraded: 0 } };

  const subjectIds = [...new Set(enrollments.map((e) => e.course.subjectId))];

  // Barcha urinishlar bitta so'rovda (mavzu → fan bog'lanishi bilan).
  const [quizAttempts, caseAttempts] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { studentId, finishedAt: { not: null }, quiz: { contentItem: { topic: { subjectId: { in: subjectIds } } } } },
      orderBy: { finishedAt: "asc" },
      select: {
        scorePct: true, passed: true, attemptNo: true, finishedAt: true,
        quiz: { select: { passThreshold: true, contentItem: { select: { topicId: true, topic: { select: { title: true, subjectId: true, orderIndex: true } } } } } },
      },
    }),
    prisma.caseAttempt.findMany({
      where: { studentId, clinicalCase: { contentItem: { topic: { subjectId: { in: subjectIds } } } } },
      orderBy: { submittedAt: "asc" },
      select: {
        score: true, teacherFeedback: true, submittedAt: true, reviewedAt: true,
        reviewedBy: { select: { fullName: true } },
        clinicalCase: { select: { contentItem: { select: { topicId: true, topic: { select: { title: true, subjectId: true, orderIndex: true } } } } } },
      },
    }),
  ]);

  const courses = enrollments.map((e) => {
    const sid = e.course.subjectId;

    // Test: mavzu bo'yicha eng yaxshi natija + urinishlar soni.
    const quizByTopic = new Map<number, { topicId: number; topicTitle: string; orderIndex: number; bestScore: number; attempts: number; passed: boolean; lastAt: Date | null }>();
    for (const a of quizAttempts) {
      const ci = a.quiz.contentItem;
      if (ci.topic.subjectId !== sid) continue;
      const cur = quizByTopic.get(ci.topicId);
      if (!cur) {
        quizByTopic.set(ci.topicId, {
          topicId: ci.topicId, topicTitle: ci.topic.title, orderIndex: ci.topic.orderIndex,
          bestScore: a.scorePct, attempts: 1, passed: a.passed, lastAt: a.finishedAt,
        });
      } else {
        cur.attempts++;
        cur.bestScore = Math.max(cur.bestScore, a.scorePct);
        cur.passed = cur.passed || a.passed;
        cur.lastAt = a.finishedAt;
      }
    }

    const cases = caseAttempts
      .filter((a) => a.clinicalCase.contentItem.topic.subjectId === sid)
      .map((a) => {
        const ci = a.clinicalCase.contentItem;
        return {
          topicId: ci.topicId,
          topicTitle: ci.topic.title,
          orderIndex: ci.topic.orderIndex,
          score: a.score,
          feedback: a.teacherFeedback,
          reviewedByName: a.reviewedBy?.fullName ?? null,
          reviewedAt: a.reviewedAt,
          submittedAt: a.submittedAt,
          reviewed: a.reviewedAt !== null,
        };
      })
      .sort((x, y) => x.orderIndex - y.orderIndex);

    const quizzes = [...quizByTopic.values()].sort((x, y) => x.orderIndex - y.orderIndex);
    const scores = quizzes.map((q) => q.bestScore);

    return {
      courseId: e.course.id,
      subjectName: e.course.subject.name,
      semester: e.course.semester,
      academicYear: e.course.academicYear,
      avgQuiz: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      quizzes,
      cases,
    };
  });

  // Umumiy xulosa (barcha kurslar bo'yicha).
  const allQuiz = courses.flatMap((c) => c.quizzes);
  const allCases = courses.flatMap((c) => c.cases);
  return {
    courses,
    summary: {
      avgQuiz: allQuiz.length ? Math.round(allQuiz.reduce((a, q) => a + q.bestScore, 0) / allQuiz.length) : null,
      quizzesPassed: allQuiz.filter((q) => q.passed).length,
      quizzesTotal: allQuiz.length,
      casesGraded: allCases.filter((c) => c.reviewed).length,
      casesTotal: allCases.length,
    },
  };
}

export async function getMyProfile(studentId: number) {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    include: { group: { include: { faculty: { select: { name: true } } } } },
  });
  if (!user) throw notFound("Foydalanuvchi");

  const [coursesCount, completedTopics, attendance, currentEnrollment] = await Promise.all([
    prisma.enrollment.count({ where: { studentId, status: "ACTIVE" } }),
    prisma.progress.count({ where: { studentId, state: "COMPLETED" } }),
    prisma.attendance.groupBy({ by: ["status"], where: { studentId }, _count: true }),
    // Joriy o'quv davri — eng yangi ACTIVE yozilishdan (ma'lumotnoma uchun).
    prisma.enrollment.findFirst({
      where: { studentId, status: "ACTIVE" },
      orderBy: [{ course: { academicYear: "desc" } }, { course: { semester: "desc" } }],
      select: { course: { select: { academicYear: true, semester: true } } },
    }),
  ]);

  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<Status, number>;
  for (const a of attendance) counts[a.status as Status] = a._count;

  return {
    // Ma'lumotnoma (shaxsiy + o'quv tegishliligi)
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    locale: user.locale,
    groupName: user.group?.name ?? null,
    facultyName: user.group?.faculty.name ?? null,
    yearOfStudy: user.group?.yearOfStudy ?? null,
    academicYear: currentEnrollment?.course.academicYear ?? null,
    semester: currentEnrollment?.course.semester ?? null,
    // Ko'rsatkichlar — asosiy modullar (bosh sahifa/davomat) uchun
    coursesCount,
    completedTopics,
    attendancePct: attendancePct(counts.PRESENT, counts.ABSENT, counts.LATE, counts.EXCUSED),
  };
}

/** Dars jadvali — talabaning ACTIVE kurslari sessiyalari.
 *  Diapazon berilmasa: bugundan +7 kun (dashboard "Bugun" bloki).
 *  Jadval moduli hafta oralig'ini beradi — o'tgan darslar O'Z yo'qlama
 *  holati bilan qaytadi (keldi/kelmadi/... yoki hali belgilanmagan). */
export async function getMySchedule(studentId: number, opts: { from?: string; to?: string } = {}) {
  const from = opts.from ? new Date(opts.from) : new Date();
  from.setHours(0, 0, 0, 0);
  const to = opts.to ? new Date(opts.to) : new Date(from.getTime() + 7 * 86_400_000);
  to.setHours(23, 59, 59, 999);

  const sessions = await prisma.lessonSession.findMany({
    where: {
      date: { gte: from, lte: to },
      course: { enrollments: { some: { studentId, status: "ACTIVE" } } },
    },
    include: { course: { include: { subject: true } }, topic: { select: { title: true } } },
    orderBy: { date: "asc" },
    take: 60,
  });

  // O'z yo'qlama belgilarim (faqat shu sessiyalar bo'yicha).
  const myMarks = sessions.length
    ? await prisma.attendance.findMany({
        where: { studentId, sessionId: { in: sessions.map((s) => s.id) } },
        select: { sessionId: true, status: true },
      })
    : [];
  const markBySession = new Map(myMarks.map((m) => [m.sessionId, m.status as Status]));

  const now = new Date();
  return sessions.map((s) => ({
    id: s.id,
    date: s.date,
    room: s.room,
    courseId: s.courseId,
    courseName: s.course.subject.name,
    title: s.title ?? s.topic?.title ?? null,
    isPast: s.date < now,
    /** O'tgan dars uchun mening holatim; belgilanmagan bo'lsa null. */
    myStatus: markBySession.get(s.id) ?? null,
  }));
}

export type ActivityEvent = {
  type: "topic_completed" | "topic_activity" | "quiz_passed" | "quiz_failed" | "case_submitted" | "case_graded";
  at: Date;
  topicId: number;
  topic: string;
  /** Ball (test %, keys bahosi) — bo'lsa. */
  score: number | null;
};

/** Profil "Umumiy" tabi lentasi: progress/test/keys hodisalari birlashtiriladi. */
export async function getMyActivity(studentId: number): Promise<ActivityEvent[]> {
  const [progressRows, quizRows, caseRows] = await Promise.all([
    prisma.progress.findMany({
      where: { studentId },
      orderBy: { updatedAt: "desc" },
      take: 15,
      include: { topic: { select: { title: true } } },
    }),
    prisma.quizAttempt.findMany({
      where: { studentId, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: 15,
      include: { quiz: { select: { contentItem: { select: { topicId: true, topic: { select: { title: true } } } } } } },
    }),
    prisma.caseAttempt.findMany({
      where: { studentId },
      orderBy: { submittedAt: "desc" },
      take: 15,
      include: { clinicalCase: { select: { contentItem: { select: { topicId: true, topic: { select: { title: true } } } } } } },
    }),
  ]);

  const events: ActivityEvent[] = [];
  for (const p of progressRows) {
    if (p.state === "COMPLETED" && p.completedAt) {
      events.push({ type: "topic_completed", at: p.completedAt, topicId: p.topicId, topic: p.topic.title, score: null });
    } else if (p.videoWatchedPct > 0 || p.slidesViewed || p.state === "IN_PROGRESS") {
      // Haqiqiy harakat bo'lsa lentaga tushadi (holati hali AVAILABLE bo'lsa ham).
      events.push({ type: "topic_activity", at: p.updatedAt, topicId: p.topicId, topic: p.topic.title, score: null });
    }
  }
  for (const q of quizRows) {
    events.push({
      type: q.passed ? "quiz_passed" : "quiz_failed",
      at: q.finishedAt!,
      topicId: q.quiz.contentItem.topicId,
      topic: q.quiz.contentItem.topic.title,
      score: q.scorePct,
    });
  }
  for (const c of caseRows) {
    events.push({
      type: "case_submitted",
      at: c.submittedAt,
      topicId: c.clinicalCase.contentItem.topicId,
      topic: c.clinicalCase.contentItem.topic.title,
      score: null,
    });
    if (c.reviewedAt) {
      events.push({
        type: "case_graded",
        at: c.reviewedAt,
        topicId: c.clinicalCase.contentItem.topicId,
        topic: c.clinicalCase.contentItem.topic.title,
        score: c.score,
      });
    }
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events.slice(0, 15);
}

/** O'z o'rni guruhda (tugallangan mavzular soni bo'yicha). Boshqa talabalar
 *  ismi/ro'yxati QAYTMAYDI — ochiq leaderboard atayin yo'q. */
export async function getMyRank(studentId: number) {
  const me = await prisma.user.findUnique({ where: { id: studentId }, select: { groupId: true } });
  if (!me?.groupId) return { rank: null, total: 0 };

  const peers = await prisma.user.findMany({
    where: { groupId: me.groupId, role: "STUDENT", isActive: true },
    select: { id: true },
  });
  const completed = await prisma.progress.groupBy({
    by: ["studentId"],
    where: { studentId: { in: peers.map((p) => p.id) }, state: "COMPLETED" },
    _count: true,
  });
  const doneBy = new Map(completed.map((c) => [c.studentId, c._count]));
  const ranked = peers
    .map((p) => ({ id: p.id, done: doneBy.get(p.id) ?? 0 }))
    .sort((a, b) => b.done - a.done);
  const idx = ranked.findIndex((r) => r.id === studentId);
  return { rank: idx === -1 ? null : idx + 1, total: ranked.length };
}

export async function setLocale(studentId: number, locale: unknown) {
  if (locale !== "uz" && locale !== "ru") throw badRequest("Til notoʻgʻri", "Неверный язык");
  await prisma.user.update({ where: { id: studentId }, data: { locale } });
  return { ok: true, locale };
}

export async function changePassword(studentId: number, oldPassword: unknown, newPassword: unknown) {
  if (typeof oldPassword !== "string" || typeof newPassword !== "string") throw badRequest("Maʼlumot notoʻgʻri", "Неверные данные");
  if (newPassword.length < 6) {
    throw new ApiError(400, "password_too_short", "Kamida 6 belgi", "Минимум 6 символов");
  }
  const user = await prisma.user.findUnique({ where: { id: studentId } });
  if (!user) throw notFound("Foydalanuvchi");
  const valid = await argon2.verify(user.passwordHash, oldPassword);
  if (!valid) {
    throw new ApiError(400, "wrong_old_password", "Eski parol xato", "Старый пароль неверный");
  }
  await prisma.user.update({ where: { id: studentId }, data: { passwordHash: await argon2.hash(newPassword) } });
  return { ok: true };
}
