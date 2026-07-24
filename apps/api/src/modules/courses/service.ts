import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, forbidden, notFound } from "../../lib/errors";
import { buildMatrix } from "./progress";
import { loadCourse } from "../me/service";

const courseInclude = {
  department: true,
  teacher: true,
  courseGroups: { include: { group: true } },
  _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
} satisfies Prisma.CourseInclude;

type CourseWithRelations = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;

function toCourseOut(c: CourseWithRelations) {
  return {
    id: c.id,
    name: c.name,
    // Compat: fan/kurs birlashgach kurs nomi `name`; eski frontend (o'qituvchi
    // sahifalari, admin jadvali) hali `subjectName` o'qiydi — ikkalasi ham beriladi.
    subjectName: c.name,
    description: c.description,
    departmentId: c.departmentId,
    departmentName: c.department.name,
    teacherId: c.teacherId,
    teacherName: c.teacher.fullName,
    semester: c.semester,
    academicYear: c.academicYear,
    groups: c.courseGroups.map((cg) => ({ id: cg.group.id, name: cg.group.name })),
    studentCount: c._count.enrollments,
  };
}

const courseOrder: Prisma.CourseOrderByWithRelationInput[] = [
  { academicYear: "desc" },
  { semester: "desc" },
  { id: "asc" },
];

export async function listCourses(where?: Prisma.CourseWhereInput) {
  const rows = await prisma.course.findMany({ where, orderBy: courseOrder, include: courseInclude });
  return rows.map(toCourseOut);
}

export async function listCoursePeriods(where?: Prisma.CourseWhereInput) {
  const rows = await prisma.course.findMany({
    where,
    select: { academicYear: true, semester: true },
    distinct: ["academicYear", "semester"],
    orderBy: courseOrder,
  });
  const years = [...new Set(rows.map((r) => r.academicYear))];
  const semesters = [...new Set(rows.map((r) => r.semester))].sort((a, b) => a - b);
  return { years, semesters };
}

async function getCourseOut(id: number) {
  const c = await prisma.course.findUnique({ where: { id }, include: courseInclude });
  if (!c) throw notFound("Kurs");
  return toCourseOut(c);
}

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
  name: string;
  description?: string;
  departmentId: number;
  teacherId: number;
  semester: number;
  academicYear: string;
  groupIds: number[];
}) {
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw notFound("Kafedra");

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
      name: input.name.trim(),
      description: input.description?.trim(),
      departmentId: input.departmentId,
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
    name?: string;
    description?: string;
    departmentId?: number;
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
  if (input.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!department) throw notFound("Kafedra");
  }

  await prisma.course.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      description: input.description?.trim(),
      departmentId: input.departmentId,
      teacherId: input.teacherId,
      semester: input.semester,
      academicYear: input.academicYear?.trim(),
    },
  });

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

const WD_LEN = 7;
function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getCourseDetail(id: number) {
  const out = await getCourseOut(id);
  const students = await listCourseStudents(id);
  const topicCount = await prisma.topic.count({ where: { courseId: id } });

  // Haftalik jadval (read-only) — guruh bo'yicha slotlar (kun+vaqt+xona) + sikl davri.
  const [slots, cgs] = await Promise.all([
    prisma.scheduleSlot.findMany({ where: { courseId: id }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }),
    prisma.courseGroup.findMany({ where: { courseId: id }, include: { group: { select: { name: true } } } }),
  ]);
  const schedule = cgs.map((cg) => ({
    groupId: cg.groupId,
    groupName: cg.group.name,
    cycleStart: cg.cycleStart ? dayKeyLocal(cg.cycleStart) : null,
    cycleEnd: cg.cycleEnd ? dayKeyLocal(cg.cycleEnd) : null,
    slots: slots
      .filter((s) => s.groupId == null || s.groupId === cg.groupId)
      .map((s) => ({ weekday: ((s.weekday % WD_LEN) + WD_LEN) % WD_LEN, startTime: s.startTime, room: s.room })),
  }));

  // Davomat xulosasi — kurs bo'yicha (barcha guruhlar).
  const attRows = await prisma.attendance.groupBy({ by: ["status"], where: { session: { courseId: id } }, _count: true });
  let present = 0, absent = 0, late = 0, excused = 0;
  for (const a of attRows) {
    if (a.status === "PRESENT") present += a._count;
    else if (a.status === "ABSENT") absent += a._count;
    else if (a.status === "LATE") late += a._count;
    else if (a.status === "EXCUSED") excused += a._count;
  }
  const marked = present + absent + late + excused;
  const attendanceSummary = { present, absent, late, excused, marked, pct: marked ? Math.round(((present + late) / marked) * 100) : null };

  return { ...out, students, topicCount, schedule, attendanceSummary };
}

export async function listTeacherCourses(teacherId: number) {
  const rows = await prisma.course.findMany({
    where: { teacherId },
    orderBy: courseOrder,
    include: courseInclude,
  });
  return rows.map(toCourseOut);
}

// ---- Guruh biriktirish (o'qituvchi o'z kursiga) ----
// O'qituvchi o'z kursiga guruh ulaydi/uzadi; talabalar avtomatik yoziladi/DROPPED.

async function ownCourseWithFaculty(courseId: number, teacherId: number) {
  const c = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, teacherId: true, department: { select: { facultyId: true } } },
  });
  if (!c) throw notFound("Kurs");
  if (c.teacherId !== teacherId) throw forbidden("Bu sizning kursingiz emas", "Это не ваш курс");
  return c;
}

/** Kursga hali ulanmagan, o'sha fakultetdagi guruhlar (biriktirish uchun). */
export async function listAssignableGroups(courseId: number, teacherId: number) {
  const c = await ownCourseWithFaculty(courseId, teacherId);
  const attached = await prisma.courseGroup.findMany({ where: { courseId }, select: { groupId: true } });
  const attachedIds = attached.map((a) => a.groupId);
  const groups = await prisma.studentGroup.findMany({
    where: { facultyId: c.department.facultyId, ...(attachedIds.length ? { id: { notIn: attachedIds } } : {}) },
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true } } },
  });
  return groups.map((g) => ({ id: g.id, name: g.name, yearOfStudy: g.yearOfStudy, studentCount: g._count.students }));
}

export async function teacherAttachGroup(courseId: number, teacherId: number, groupId: number) {
  const c = await ownCourseWithFaculty(courseId, teacherId);
  const group = await prisma.studentGroup.findUnique({ where: { id: groupId } });
  if (!group) throw notFound("Guruh");
  if (group.facultyId !== c.department.facultyId) {
    throw badRequest("Guruh boshqa fakultetdan", "Группа из другого факультета");
  }
  const exists = await prisma.courseGroup.findFirst({ where: { courseId, groupId } });
  if (!exists) await prisma.courseGroup.create({ data: { courseId, groupId } });
  await syncEnrollments(courseId, [groupId]);
  const enrolled = await prisma.enrollment.count({ where: { courseId, status: "ACTIVE", student: { groupId } } });
  return { ok: true, enrolled };
}

export async function teacherDetachGroup(courseId: number, teacherId: number, groupId: number) {
  await ownCourseWithFaculty(courseId, teacherId);
  await prisma.courseGroup.deleteMany({ where: { courseId, groupId } });
  const students = await prisma.user.findMany({ where: { role: "STUDENT", groupId }, select: { id: true } });
  if (students.length) {
    await prisma.enrollment.updateMany({
      where: { courseId, studentId: { in: students.map((s) => s.id) } },
      data: { status: "DROPPED" },
    });
  }
  return { ok: true };
}

// ---- O'qituvchi o'zi kurs yaratadi (o'z kafedrasida) ----

/** Yangi kurs formasi uchun: o'qituvchi kafedrasi + shu fakultetdagi guruhlar. */
export async function teacherCourseFormOptions(teacherId: number) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: teacherId },
    include: { department: { include: { faculty: true } } },
  });
  if (!profile) throw badRequest("Sizga kafedra biriktirilmagan", "Вам не назначена кафедра");
  const groups = await prisma.studentGroup.findMany({
    where: { facultyId: profile.department.facultyId },
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true } } },
  });
  return {
    departmentId: profile.departmentId,
    departmentName: profile.department.name,
    facultyName: profile.department.faculty.name,
    groups: groups.map((g) => ({ id: g.id, name: g.name, yearOfStudy: g.yearOfStudy, studentCount: g._count.students })),
  };
}

/** Joriy o'quv yili (masalan "2026/2027"). Sentyabrdan boshlab yangi yil. */
function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

export async function teacherCreateCourse(
  teacherId: number,
  // Semestr endi FORMADA yo'q (buyurtmachi: keraksiz) — modelda qoladi, default 1.
  input: { name: string; description?: string; groupIds: number[]; semester?: number; academicYear?: string }
) {
  const profile = await prisma.teacherProfile.findUnique({ where: { userId: teacherId } });
  if (!profile) throw badRequest("Sizga kafedra biriktirilmagan", "Вам не назначена кафедра");
  if (!input.name.trim()) throw badRequest("Kurs nomi kerak", "Требуется название курса");
  if (input.groupIds.length === 0) throw badRequest("Kamida bitta guruh tanlang", "Выберите хотя бы одну группу");
  // Guruhlar o'qituvchi fakultetidan bo'lishi shart (begona fakultetga yozib bo'lmaydi).
  const groups = await prisma.studentGroup.findMany({ where: { id: { in: input.groupIds } }, select: { id: true, facultyId: true } });
  const facultyId = (await prisma.department.findUniqueOrThrow({ where: { id: profile.departmentId }, select: { facultyId: true } })).facultyId;
  if (groups.length !== input.groupIds.length || groups.some((g) => g.facultyId !== facultyId)) {
    throw badRequest("Guruh sizning fakultetingizdan emas", "Группа не из вашего факультета");
  }
  const semester = input.semester && input.semester >= 1 && input.semester <= 8 ? input.semester : 1;
  const academicYear = input.academicYear?.trim() || currentAcademicYear();
  return createCourse({
    name: input.name,
    description: input.description,
    departmentId: profile.departmentId,
    teacherId,
    semester,
    academicYear,
    groupIds: input.groupIds,
  });
}

/** O'qituvchi o'z fakultetida yangi guruh yaratadi (buyurtmachi: barcha huquq
 *  o'qituvchida bo'lsin). Guruh fakultet darajasida. */
export async function teacherCreateGroup(teacherId: number, input: { name: string; yearOfStudy: number }) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: teacherId },
    include: { department: true },
  });
  if (!profile) throw badRequest("Sizga kafedra biriktirilmagan", "Вам не назначена кафедра");
  const name = input.name.trim();
  if (!name) throw badRequest("Guruh nomi kerak", "Требуется название группы");
  const yearOfStudy = input.yearOfStudy >= 1 && input.yearOfStudy <= 6 ? input.yearOfStudy : 1;
  const facultyId = profile.department.facultyId;
  const dup = await prisma.studentGroup.findFirst({ where: { facultyId, name } });
  if (dup) throw badRequest("Bu nomli guruh allaqachon bor", "Группа с таким названием уже есть");
  const g = await prisma.studentGroup.create({ data: { facultyId, name, yearOfStudy, createdById: teacherId } });
  return { id: g.id, name: g.name, yearOfStudy: g.yearOfStudy, studentCount: 0 };
}

export async function getTeacherGroup(groupId: number, teacherId: number) {
  const cgs = await prisma.courseGroup.findMany({
    where: { groupId, course: { teacherId } },
    include: { course: true },
  });
  const group = await prisma.studentGroup.findUnique({ where: { id: groupId }, include: { faculty: true } });
  if (!group) throw notFound("Guruh");
  // O'qituvchi guruhni O'QITADI yoki O'ZI YARATGAN bo'lsa ko'ra oladi (yangi,
  // hali kursga biriktirilmagan guruh ham "meniki").
  if (cgs.length === 0 && group.createdById !== teacherId) {
    throw new ApiError(403, "forbidden", "Bu sizning guruhingiz emas", "Это не ваша группа");
  }

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true, groupId },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });
  const studentIds = students.map((s) => s.id);
  const courseIds = cgs.map((cg) => cg.course.id);

  const studentIdSet = new Set(studentIds);
  const metric = new Map<number, { pcts: number[]; quiz: number[]; last: number; behind: boolean }>();
  for (const s of students) metric.set(s.id, { pcts: [], quiz: [], last: 0, behind: false });
  // Har kurs bo'yicha shu guruh talabalarining o'zlashtirish hisoboti (profil pastida).
  const courseReport: {
    id: number;
    name: string;
    studentCount: number;
    topicsTotal: number;
    avgProgress: number;
    avgQuizScore: number | null;
    behindCount: number;
  }[] = [];
  for (const cg of cgs) {
    const cid = cg.course.id;
    const loaded = await loadCourse(cid).catch(() => null);
    if (!loaded) {
      courseReport.push({ id: cid, name: cg.course.name, studentCount: 0, topicsTotal: 0, avgProgress: 0, avgQuizScore: null, behindCount: 0 });
      continue;
    }
    const { students: rows, topics } = await buildMatrix(loaded);
    // Faqat SHU guruh talabalari (kurs bir necha guruhga o'tilishi mumkin).
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
      studentCount: groupRows.length,
      topicsTotal: topics.length,
      avgProgress: cPcts.length ? Math.round(cPcts.reduce((a, b) => a + b, 0) / cPcts.length) : 0,
      avgQuizScore: cQuiz.length ? Math.round(cQuiz.reduce((a, b) => a + b, 0) / cQuiz.length) : null,
      behindCount: groupRows.filter((r) => r.behind).length,
    });
  }

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

  const rankOrder = [...studentsOut].sort(
    (a, b) => b.overallPct - a.overallPct || (b.avgQuizScore ?? -1) - (a.avgQuizScore ?? -1)
  );
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
    courses: cgs.map((cg) => ({ id: cg.course.id, name: cg.course.name })),
    courseReport,
    students: studentsRanked,
    studentCount: students.length,
    avgProgress,
    avgAttendance,
    behindCount,
  };
}

export async function listTeacherGroups(teacherId: number) {
  const cgs = await prisma.courseGroup.findMany({
    where: { course: { teacherId } },
    include: { group: { include: { faculty: true } }, course: true },
  });

  const map = new Map<number, { group: (typeof cgs)[number]["group"]; courses: Map<number, { id: number; name: string }> }>();
  for (const cg of cgs) {
    if (!map.has(cg.groupId)) map.set(cg.groupId, { group: cg.group, courses: new Map() });
    map.get(cg.groupId)!.courses.set(cg.course.id, { id: cg.course.id, name: cg.course.name });
  }

  // O'qituvchi O'ZI YARATGAN, lekin hali kursga biriktirilmagan guruhlar ham
  // "Mening guruhlarim"da ko'rinadi.
  const created = await prisma.studentGroup.findMany({ where: { createdById: teacherId }, include: { faculty: true } });
  for (const g of created) if (!map.has(g.id)) map.set(g.id, { group: g, courses: new Map() });

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

export async function getTeacherCourseMeta(courseId: number, teacherId: number) {
  const c = await prisma.course.findUnique({ where: { id: courseId }, include: courseInclude });
  if (!c) throw notFound("Kurs");
  if (c.teacherId !== teacherId) {
    throw new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
  }
  return { ...toCourseOut(c), defaultUnlockRuleJson: c.defaultUnlockRuleJson ?? null, scheduleUnlock: c.scheduleUnlock, sequentialUnlock: c.sequentialUnlock };
}

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
    include: { topics: { orderBy: { orderIndex: "asc" } } },
  });
  if (!course) throw notFound("Kurs");
  if (course.teacherId !== teacherId) throw new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");

  const meta = { ...emptyMeta(), ...((course.syllabusJson as Partial<SyllabusMeta> | null) ?? {}) };
  const topics = course.topics.map((t) => ({
    id: t.id,
    title: t.title,
    orderIndex: t.orderIndex,
    hours: t.hours,
    note: t.syllabusNote ?? "",
  }));
  return {
    courseId,
    courseName: course.name,
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
    include: { topics: { select: { id: true } } },
  });
  if (!course) throw notFound("Kurs");
  if (course.teacherId !== teacherId) throw new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");

  const meta: SyllabusMeta = {
    description: (body.description ?? "").trim(),
    objectives: (body.objectives ?? []).map((s) => s.trim()).filter(Boolean),
    literature: (body.literature ?? []).map((s) => s.trim()).filter(Boolean),
  };

  const ownTopicIds = new Set(course.topics.map((t) => t.id));
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

export async function updateCourseSettings(
  courseId: number,
  teacherId: number,
  body: { defaultUnlockRuleJson?: unknown; scheduleUnlock?: boolean; sequentialUnlock?: boolean }
) {
  const c = await prisma.course.findUnique({ where: { id: courseId } });
  if (!c) throw notFound("Kurs");
  if (c.teacherId !== teacherId) {
    throw new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
  }
  const data: Prisma.CourseUpdateInput = {};
  if (body.defaultUnlockRuleJson !== undefined) {
    data.defaultUnlockRuleJson = (body.defaultUnlockRuleJson ?? null) as object;
  }
  if (typeof body.scheduleUnlock === "boolean") data.scheduleUnlock = body.scheduleUnlock;
  if (typeof body.sequentialUnlock === "boolean") data.sequentialUnlock = body.sequentialUnlock;
  await prisma.course.update({ where: { id: courseId }, data });
  return { ok: true };
}
