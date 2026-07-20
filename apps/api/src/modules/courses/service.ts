import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { buildMatrix } from "./progress";
import { loadCourse } from "../me/service";

const courseInclude = {
  subject: { include: { department: true } },
  teacher: true,
  courseGroups: { include: { group: true } },
  _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
} satisfies Prisma.CourseInclude;

type CourseWithRelations = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;

function toCourseOut(c: CourseWithRelations) {
  return {
    id: c.id,
    subjectId: c.subjectId,
    subjectName: c.subject.name,
    departmentName: c.subject.department.name,
    teacherId: c.teacherId,
    teacherName: c.teacher.fullName,
    semester: c.semester,
    academicYear: c.academicYear,
    groups: c.courseGroups.map((cg) => ({ id: cg.group.id, name: cg.group.name })),
    studentCount: c._count.enrollments,
  };
}

export async function listCourses(where?: Prisma.CourseWhereInput) {
  const rows = await prisma.course.findMany({ where, orderBy: { id: "asc" }, include: courseInclude });
  return rows.map(toCourseOut);
}

async function getCourseOut(id: number) {
  const c = await prisma.course.findUnique({ where: { id }, include: courseInclude });
  if (!c) throw notFound("Kurs");
  return toCourseOut(c);
}

// Enroll every STUDENT of the given groups into the course (idempotent);
// re-activates previously DROPPED students who are back in an attached group.
async function syncEnrollments(courseId: number, groupIds: number[]) {
  if (groupIds.length === 0) return;
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId: { in: groupIds } },
    select: { id: true },
  });
  for (const s of students) {
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: s.id, courseId } },
      create: { studentId: s.id, courseId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
  }
}

export async function createCourse(input: {
  subjectId: number;
  teacherId: number;
  semester: number;
  academicYear: string;
  groupIds: number[];
}) {
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject) throw notFound("Fan");

  const teacher = await prisma.user.findUnique({ where: { id: input.teacherId } });
  if (!teacher) throw notFound("Oʻqituvchi");
  if (teacher.role !== "TEACHER") {
    throw badRequest("Faqat oʻqituvchi tanlanishi mumkin", "Можно выбрать только преподавателя");
  }

  const groupIds = [...new Set(input.groupIds)];
  const groups = await prisma.studentGroup.findMany({ where: { id: { in: groupIds } }, select: { id: true } });
  if (groups.length !== groupIds.length) throw notFound("Guruh");

  const course = await prisma.course.create({
    data: {
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      semester: input.semester,
      academicYear: input.academicYear.trim(),
      courseGroups: { create: groupIds.map((groupId) => ({ groupId })) },
    },
  });

  await syncEnrollments(course.id, groupIds);
  const out = await getCourseOut(course.id);
  return { ...out, enrolledCount: out.studentCount };
}

export async function updateCourse(
  id: number,
  input: {
    subjectId?: number;
    teacherId?: number;
    semester?: number;
    academicYear?: string;
    groupIds?: number[];
  }
) {
  const existing = await prisma.course.findUnique({
    where: { id },
    include: { courseGroups: true },
  });
  if (!existing) throw notFound("Kurs");

  if (input.teacherId) {
    const teacher = await prisma.user.findUnique({ where: { id: input.teacherId } });
    if (!teacher) throw notFound("Oʻqituvchi");
    if (teacher.role !== "TEACHER")
      throw badRequest("Faqat oʻqituvchi tanlanishi mumkin", "Можно выбрать только преподавателя");
  }
  if (input.subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw notFound("Fan");
  }

  await prisma.course.update({
    where: { id },
    data: {
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      semester: input.semester,
      academicYear: input.academicYear?.trim(),
    },
  });

  // Reconcile groups if provided.
  if (input.groupIds) {
    const nextIds = [...new Set(input.groupIds)];
    const groups = await prisma.studentGroup.findMany({ where: { id: { in: nextIds } }, select: { id: true } });
    if (groups.length !== nextIds.length) throw notFound("Guruh");

    const currentIds = existing.courseGroups.map((cg) => cg.groupId);
    const toAdd = nextIds.filter((g) => !currentIds.includes(g));
    const toRemove = currentIds.filter((g) => !nextIds.includes(g));

    if (toAdd.length) {
      await prisma.courseGroup.createMany({ data: toAdd.map((groupId) => ({ courseId: id, groupId })) });
      await syncEnrollments(id, toAdd);
    }
    if (toRemove.length) {
      await prisma.courseGroup.deleteMany({ where: { courseId: id, groupId: { in: toRemove } } });
      // Drop (not delete) students who were in the removed groups.
      const removedStudents = await prisma.user.findMany({
        where: { role: "STUDENT", groupId: { in: toRemove } },
        select: { id: true },
      });
      if (removedStudents.length) {
        await prisma.enrollment.updateMany({
          where: { courseId: id, studentId: { in: removedStudents.map((s) => s.id) } },
          data: { status: "DROPPED" },
        });
      }
    }
  }

  return getCourseOut(id);
}

export async function deleteCourse(id: number) {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) throw notFound("Kurs");

  // Topics belong to a later module; guard defensively if the table exists.
  // For now: block only if there is student activity beyond plain enrollment
  // is not tracked yet, so allow delete and clean up join/enrollment rows.
  await prisma.enrollment.deleteMany({ where: { courseId: id } });
  await prisma.courseGroup.deleteMany({ where: { courseId: id } });
  await prisma.course.delete({ where: { id } });
}

export async function listCourseStudents(id: number) {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw notFound("Kurs");
  const rows = await prisma.enrollment.findMany({
    where: { courseId: id },
    include: { student: { include: { group: true } } },
    orderBy: { id: "asc" },
  });
  return rows.map((e) => ({
    enrollmentId: e.id,
    studentId: e.studentId,
    fullName: e.student.fullName,
    email: e.student.email,
    groupName: e.student.group?.name ?? null,
    status: e.status,
  }));
}

export async function getCourseDetail(id: number) {
  const out = await getCourseOut(id);
  const students = await listCourseStudents(id);
  const topicCount = await prisma.topic.count({ where: { subject: { courses: { some: { id } } } } });
  return { ...out, students, topicCount };
}

// ---------- Teacher-facing (own courses only) ----------

export async function listTeacherCourses(teacherId: number) {
  const rows = await prisma.course.findMany({
    where: { teacherId },
    orderBy: { id: "asc" },
    include: courseInclude,
  });
  return rows.map(toCourseOut);
}

/** One group's profile for a teacher: info + students + this teacher's courses with it.
 *  Ownership: the teacher must have at least one course attached to the group. */
export async function getTeacherGroup(groupId: number, teacherId: number) {
  const cgs = await prisma.courseGroup.findMany({
    where: { groupId, course: { teacherId } },
    include: { course: { include: { subject: true } } },
  });
  if (cgs.length === 0) {
    throw new ApiError(403, "forbidden", "Bu sizning guruhingiz emas", "Это не ваша группа");
  }
  const group = await prisma.studentGroup.findUnique({ where: { id: groupId }, include: { faculty: true } });
  if (!group) throw notFound("Guruh");

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true, groupId },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });
  const studentIds = students.map((s) => s.id);
  const courseIds = cgs.map((cg) => cg.course.id);

  // Per-student metrics across this teacher's courses for the group (reuses the
  // same matrix the progress heatmap builds), keyed to this group's students only.
  const metric = new Map<number, { pcts: number[]; quiz: number[]; last: number; behind: boolean }>();
  for (const s of students) metric.set(s.id, { pcts: [], quiz: [], last: 0, behind: false });
  for (const cid of courseIds) {
    const loaded = await loadCourse(cid).catch(() => null);
    if (!loaded) continue;
    const { students: rows } = await buildMatrix(loaded);
    for (const r of rows) {
      const m = metric.get(r.id);
      if (!m) continue; // student from another group on the same course — skip
      m.pcts.push(r.overallPct);
      if (r.avgQuizScore !== null) m.quiz.push(r.avgQuizScore);
      if (r.lastActiveAt) m.last = Math.max(m.last, new Date(r.lastActiveAt).getTime());
      if (r.behind) m.behind = true;
    }
  }

  // Attendance % per student across the group's (teacher-course) sessions.
  const attRows = studentIds.length
    ? await prisma.attendance.groupBy({
        by: ["studentId", "status"],
        where: { studentId: { in: studentIds }, session: { courseId: { in: courseIds } } },
        _count: true,
      })
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

  const avgProgress = studentsOut.length ? Math.round(studentsOut.reduce((a, s) => a + s.overallPct, 0) / studentsOut.length) : 0;
  const attVals = studentsOut.map((s) => s.attendancePct).filter((x): x is number => x !== null);
  const avgAttendance = attVals.length ? Math.round(attVals.reduce((a, b) => a + b, 0) / attVals.length) : null;
  const behindCount = studentsOut.filter((s) => s.behind).length;

  return {
    id: group.id,
    name: group.name,
    yearOfStudy: group.yearOfStudy,
    facultyName: group.faculty.name,
    courses: cgs.map((cg) => ({ id: cg.course.id, name: cg.course.subject.name })),
    students: studentsOut,
    studentCount: students.length,
    avgProgress,
    avgAttendance,
    behindCount,
  };
}

/** Groups the teacher teaches (via their courses) — with students and subjects. */
export async function listTeacherGroups(teacherId: number) {
  const cgs = await prisma.courseGroup.findMany({
    where: { course: { teacherId } },
    include: { group: { include: { faculty: true } }, course: { include: { subject: true } } },
  });

  const map = new Map<number, { group: (typeof cgs)[number]["group"]; courses: Map<number, { id: number; name: string }> }>();
  for (const cg of cgs) {
    if (!map.has(cg.groupId)) map.set(cg.groupId, { group: cg.group, courses: new Map() });
    map.get(cg.groupId)!.courses.set(cg.course.id, { id: cg.course.id, name: cg.course.subject.name });
  }

  const groupIds = [...map.keys()];
  const students = groupIds.length
    ? await prisma.user.findMany({
        where: { role: "STUDENT", isActive: true, groupId: { in: groupIds } },
        select: { id: true, fullName: true, email: true, groupId: true },
        orderBy: { fullName: "asc" },
      })
    : [];
  const byGroup = new Map<number, typeof students>();
  for (const s of students) {
    if (!byGroup.has(s.groupId!)) byGroup.set(s.groupId!, []);
    byGroup.get(s.groupId!)!.push(s);
  }

  return [...map.values()]
    .map(({ group, courses }) => ({
      id: group.id,
      name: group.name,
      yearOfStudy: group.yearOfStudy,
      facultyName: group.faculty.name,
      courses: [...courses.values()],
      students: (byGroup.get(group.id) ?? []).map((s) => ({ id: s.id, fullName: s.fullName, email: s.email })),
      studentCount: (byGroup.get(group.id) ?? []).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Lightweight course metadata for the teacher course shell (no students list). */
export async function getTeacherCourseMeta(courseId: number, teacherId: number) {
  const c = await prisma.course.findUnique({ where: { id: courseId }, include: courseInclude });
  if (!c) throw notFound("Kurs");
  if (c.teacherId !== teacherId) {
    throw new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
  }
  return { ...toCourseOut(c), defaultUnlockRuleJson: c.defaultUnlockRuleJson ?? null };
}

// ---------- Syllabus (o'quv rejasi) ----------

interface SyllabusMeta {
  description: string;
  objectives: string[];
  literature: string[];
}

function emptyMeta(): SyllabusMeta {
  return { description: "", objectives: [], literature: [] };
}

export async function getSyllabus(courseId: number, teacherId: number) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { subject: { include: { topics: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!course) throw notFound("Kurs");
  if (course.teacherId !== teacherId) throw new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");

  const meta = { ...emptyMeta(), ...((course.syllabusJson as Partial<SyllabusMeta> | null) ?? {}) };
  const topics = course.subject.topics.map((t) => ({
    id: t.id,
    title: t.title,
    orderIndex: t.orderIndex,
    hours: t.hours,
    note: t.syllabusNote ?? "",
  }));
  return {
    courseId,
    subjectName: course.subject.name,
    description: meta.description,
    objectives: meta.objectives,
    literature: meta.literature,
    topics,
    totalHours: topics.reduce((s, t) => s + (t.hours || 0), 0),
  };
}

export async function saveSyllabus(
  courseId: number,
  teacherId: number,
  body: { description?: string; objectives?: string[]; literature?: string[]; topics?: { id: number; hours?: number; note?: string }[] }
) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { subject: { include: { topics: { select: { id: true } } } } },
  });
  if (!course) throw notFound("Kurs");
  if (course.teacherId !== teacherId) throw new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");

  const meta: SyllabusMeta = {
    description: (body.description ?? "").trim(),
    objectives: (body.objectives ?? []).map((s) => s.trim()).filter(Boolean),
    literature: (body.literature ?? []).map((s) => s.trim()).filter(Boolean),
  };

  const ownTopicIds = new Set(course.subject.topics.map((t) => t.id));
  await prisma.$transaction([
    prisma.course.update({ where: { id: courseId }, data: { syllabusJson: meta as object } }),
    ...(body.topics ?? [])
      .filter((t) => ownTopicIds.has(t.id))
      .map((t) =>
        prisma.topic.update({
          where: { id: t.id },
          data: { hours: Math.max(0, Math.round(t.hours ?? 0)), syllabusNote: (t.note ?? "").trim() || null },
        })
      ),
  ]);
  return { ok: true };
}

export async function updateCourseSettings(courseId: number, teacherId: number, defaultUnlockRuleJson: unknown) {
  const c = await prisma.course.findUnique({ where: { id: courseId } });
  if (!c) throw notFound("Kurs");
  if (c.teacherId !== teacherId) {
    throw new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
  }
  await prisma.course.update({
    where: { id: courseId },
    data: { defaultUnlockRuleJson: (defaultUnlockRuleJson ?? null) as object },
  });
  return { ok: true };
}
