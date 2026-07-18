import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import type { AdminScope } from "../../middleware/adminScope";

const PAGE_SIZE = 20;

/** Students live under faculties (via their group); dept admins have no student scope. */
function studentWhere(scope: AdminScope): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { role: "STUDENT" };
  if (scope.level === "FACULTY") base.group = { facultyId: scope.facultyId! };
  return base;
}

/** Contingent list with study metrics (progress %, attendance %) batched per page. */
export async function listStudents(
  scope: AdminScope,
  params: { facultyId?: number; groupId?: number; active?: boolean; search?: string; page?: number }
) {
  const page = Math.max(1, params.page ?? 1);
  const and: Prisma.UserWhereInput[] = [studentWhere(scope)];
  if (params.groupId) and.push({ groupId: params.groupId });
  else if (params.facultyId) and.push({ group: { facultyId: params.facultyId } });
  if (params.active !== undefined) and.push({ isActive: params.active });
  if (params.search) {
    and.push({
      OR: [
        { fullName: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ],
    });
  }
  const where: Prisma.UserWhereInput = { AND: and };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { group: { include: { faculty: true } } },
      orderBy: { fullName: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  // ---- Study metrics for this page, in a few batched queries ----
  const ids = rows.map((r) => r.id);

  const [enrollments, completed, attendance] = ids.length
    ? await Promise.all([
        prisma.enrollment.findMany({
          where: { studentId: { in: ids }, status: "ACTIVE" },
          select: { studentId: true, courseId: true },
        }),
        prisma.progress.groupBy({
          by: ["studentId"],
          where: { studentId: { in: ids }, state: "COMPLETED" },
          _count: true,
        }),
        prisma.attendance.groupBy({
          by: ["studentId", "status"],
          where: { studentId: { in: ids } },
          _count: true,
        }),
      ])
    : [[], [], []];

  // Published-topic totals per course → per student.
  const courseIds = [...new Set(enrollments.map((e) => e.courseId))];
  const topicTotals = courseIds.length
    ? await prisma.topic.groupBy({
        by: ["courseId"],
        where: { courseId: { in: courseIds }, contentItems: { some: { status: "PUBLISHED" } } },
        _count: true,
      })
    : [];
  const topicsByCourse = new Map(topicTotals.map((t) => [t.courseId, t._count]));

  const coursesByStudent = new Map<number, number[]>();
  for (const e of enrollments) {
    if (!coursesByStudent.has(e.studentId)) coursesByStudent.set(e.studentId, []);
    coursesByStudent.get(e.studentId)!.push(e.courseId);
  }
  const completedByStudent = new Map(completed.map((c) => [c.studentId, c._count]));

  const attByStudent = new Map<number, { present: number; late: number; marked: number }>();
  for (const a of attendance) {
    if (!attByStudent.has(a.studentId)) attByStudent.set(a.studentId, { present: 0, late: 0, marked: 0 });
    const s = attByStudent.get(a.studentId)!;
    s.marked += a._count;
    if (a.status === "PRESENT") s.present += a._count;
    if (a.status === "LATE") s.late += a._count;
  }

  return {
    items: rows.map((u) => {
      const courses = coursesByStudent.get(u.id) ?? [];
      const totalTopics = courses.reduce((s, cid) => s + (topicsByCourse.get(cid) ?? 0), 0);
      const done = completedByStudent.get(u.id) ?? 0;
      const att = attByStudent.get(u.id);
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        locale: u.locale,
        isActive: u.isActive,
        groupId: u.groupId,
        groupName: u.group?.name ?? null,
        facultyId: u.group?.facultyId ?? null,
        facultyName: u.group?.faculty.name ?? null,
        coursesCount: courses.length,
        progressPct: totalTopics > 0 ? Math.round((done / totalTopics) * 100) : null,
        attendancePct: att && att.marked > 0 ? Math.round(((att.present + att.late) / att.marked) * 100) : null,
      };
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

/** Header stats + per-faculty split (for the composition card). */
export async function studentStats(scope: AdminScope) {
  const base = studentWhere(scope);
  const [total, inactive, groups] = await Promise.all([
    prisma.user.count({ where: base }),
    prisma.user.count({ where: { AND: [base, { isActive: false }] } }),
    prisma.studentGroup.findMany({
      where: scope.level === "FACULTY" ? { facultyId: scope.facultyId! } : {},
      include: { faculty: { select: { name: true } }, _count: { select: { students: true } } },
    }),
  ]);

  const byFaculty = new Map<string, number>();
  for (const g of groups) {
    byFaculty.set(g.faculty.name, (byFaculty.get(g.faculty.name) ?? 0) + g._count.students);
  }

  return {
    total,
    active: total - inactive,
    inactive,
    groupsCount: groups.length,
    byFaculty: [...byFaculty.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}
