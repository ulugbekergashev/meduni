import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { assertFacultyScope, type AdminScope } from "../../middleware/adminScope";
import { forbidden } from "../../lib/errors";
import { buildMatrix } from "../courses/progress";
import { loadCourse } from "../me/service";

/** Admin Guruh profili — o'qituvchining `getTeacherGroup` naqshi, lekin:
 *  guruhning BARCHA kurslari (o'qituvchi filtri yo'q), fakultet-scope, va har kurs
 *  uchun o'qituvchi nomi + davomat foizi (admin nazorati). Guruhlar fakultet
 *  darajasida — DEPT admin (talaba/guruh scope'i yo'q) ko'ra olmaydi. */
export async function getAdminGroup(groupId: number, scope: AdminScope) {
  const group = await prisma.studentGroup.findUnique({ where: { id: groupId }, include: { faculty: true } });
  if (!group) throw notFound("Guruh");
  if (scope.level === "DEPT") throw forbidden("Kafedra admini guruhni koʻra olmaydi", "Админ кафедры не видит группу");
  assertFacultyScope(scope, group.facultyId);

  const cgs = await prisma.courseGroup.findMany({
    where: { groupId },
    include: { course: { include: { teacher: { select: { fullName: true } } } } },
  });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true, groupId },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });
  const studentIds = students.map((s) => s.id);
  const studentIdSet = new Set(studentIds);
  const courseIds = cgs.map((cg) => cg.course.id);

  const metric = new Map<number, { pcts: number[]; quiz: number[]; last: number; behind: boolean }>();
  for (const s of students) metric.set(s.id, { pcts: [], quiz: [], last: 0, behind: false });

  // Per-course attendance (shu guruh talabalari, shu kurs sessiyalari) — har kurs
  // uchun alohida hisob (guruhda kurslar kam, arzon).
  const attByCourse = new Map<number, { hit: number; marked: number }>();
  for (const cid of courseIds) {
    const rows = await prisma.attendance.groupBy({
      by: ["status"],
      where: { studentId: { in: studentIds }, session: { courseId: cid } },
      _count: true,
    });
    let hit = 0, marked = 0;
    for (const r of rows) { marked += r._count; if (r.status === "PRESENT" || r.status === "LATE") hit += r._count; }
    attByCourse.set(cid, { hit, marked });
  }

  const courseReport = [];
  for (const cg of cgs) {
    const cid = cg.course.id;
    const teacherName = cg.course.teacher.fullName;
    const ca = attByCourse.get(cid);
    const attendancePct = ca && ca.marked > 0 ? Math.round((ca.hit / ca.marked) * 100) : null;
    const loaded = await loadCourse(cid).catch(() => null);
    if (!loaded) {
      courseReport.push({ id: cid, name: cg.course.name, teacherName, studentCount: 0, topicsTotal: 0, avgProgress: 0, avgQuizScore: null, attendancePct, behindCount: 0 });
      continue;
    }
    const { students: rows, topics } = await buildMatrix(loaded);
    const groupRows = rows.filter((r) => studentIdSet.has(r.id));
    for (const r of groupRows) {
      const m = metric.get(r.id);
      if (!m) continue;
      m.pcts.push(r.overallPct);
      if (r.avgQuizScore !== null) m.quiz.push(r.avgQuizScore);
      if (r.lastActiveAt) m.last = Math.max(m.last, new Date(r.lastActiveAt).getTime());
      if (r.behind) m.behind = true;
    }
    const cPcts = groupRows.map((r) => r.overallPct);
    const cQuiz = groupRows.map((r) => r.avgQuizScore).filter((x): x is number => x !== null);
    courseReport.push({
      id: cid,
      name: cg.course.name,
      teacherName,
      studentCount: groupRows.length,
      topicsTotal: topics.length,
      avgProgress: cPcts.length ? Math.round(cPcts.reduce((a, b) => a + b, 0) / cPcts.length) : 0,
      avgQuizScore: cQuiz.length ? Math.round(cQuiz.reduce((a, b) => a + b, 0) / cQuiz.length) : null,
      attendancePct,
      behindCount: groupRows.filter((r) => r.behind).length,
    });
  }

  // Per-student attendance (barcha kurslar bo'ylab).
  const attRows = studentIds.length
    ? await prisma.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: studentIds }, session: { courseId: { in: courseIds } } }, _count: true })
    : [];
  const att = new Map<number, { hit: number; marked: number }>();
  for (const s of students) att.set(s.id, { hit: 0, marked: 0 });
  for (const a of attRows) {
    const x = att.get(a.studentId);
    if (!x) continue;
    x.marked += a._count;
    if (a.status === "PRESENT" || a.status === "LATE") x.hit += a._count;
  }

  const studentsOut = students.map((s) => {
    const m = metric.get(s.id)!;
    const a = att.get(s.id)!;
    return {
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      overallPct: m.pcts.length ? Math.round(m.pcts.reduce((x, y) => x + y, 0) / m.pcts.length) : 0,
      avgQuizScore: m.quiz.length ? Math.round(m.quiz.reduce((x, y) => x + y, 0) / m.quiz.length) : null,
      attendancePct: a.marked ? Math.round((a.hit / a.marked) * 100) : null,
      lastActiveAt: m.last ? new Date(m.last).toISOString() : null,
      behind: m.behind,
    };
  });

  const rankOrder = [...studentsOut].sort((a, b) => b.overallPct - a.overallPct || (b.avgQuizScore ?? -1) - (a.avgQuizScore ?? -1));
  const rankOf = new Map(rankOrder.map((s, i) => [s.id, i + 1]));
  const studentsRanked = studentsOut.map((s) => ({ ...s, rank: rankOf.get(s.id)! }));

  const avgProgress = studentsOut.length ? Math.round(studentsOut.reduce((a, s) => a + s.overallPct, 0) / studentsOut.length) : 0;
  const attVals = studentsOut.map((s) => s.attendancePct).filter((x): x is number => x !== null);
  const avgAttendance = attVals.length ? Math.round(attVals.reduce((a, b) => a + b, 0) / attVals.length) : null;
  const behindCount = studentsOut.filter((s) => s.behind).length;

  return {
    id: group.id,
    name: group.name,
    yearOfStudy: group.yearOfStudy,
    facultyName: group.faculty.name,
    courses: cgs.map((cg) => ({ id: cg.course.id, name: cg.course.name, teacherName: cg.course.teacher.fullName })),
    courseReport,
    students: studentsRanked,
    studentCount: students.length,
    avgProgress,
    avgAttendance,
    behindCount,
  };
}

/** Admin uchun guruh scope tekshiruvi — jadval endpointida ishlatiladi. */
export async function assertGroupInScope(groupId: number, scope: AdminScope) {
  const group = await prisma.studentGroup.findUnique({ where: { id: groupId }, select: { facultyId: true } });
  if (!group) throw notFound("Guruh");
  if (scope.level === "DEPT") throw forbidden("Kafedra admini guruhni koʻra olmaydi", "Админ кафедры не видит группу");
  assertFacultyScope(scope, group.facultyId);
}
