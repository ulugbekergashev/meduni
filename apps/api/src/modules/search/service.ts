import { prisma } from "../../lib/prisma";

// Global top-bar search. Each role gets its own scope; every category is capped
// so the dropdown stays scannable. Matching is case-insensitive "contains".
const LIMIT = 5;

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** TEACHER: own students / groups / courses only. */
export async function teacherSearch(teacherId: number, q: string) {
  if (!q.trim()) return { students: [], groups: [], courses: [] };
  const needle = q.trim();

  const [students, groups, courses] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "STUDENT",
        isActive: true,
        fullName: contains(needle),
        enrollments: { some: { status: "ACTIVE", course: { teacherId } } },
      },
      select: { id: true, fullName: true, group: { select: { name: true } } },
      orderBy: { fullName: "asc" },
      take: LIMIT,
    }),
    prisma.studentGroup.findMany({
      where: { name: contains(needle), courseGroups: { some: { course: { teacherId } } } },
      select: { id: true, name: true, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
      take: LIMIT,
    }),
    prisma.course.findMany({
      where: {
        teacherId,
        OR: [{ subject: { nameUz: contains(needle) } }, { subject: { nameRu: contains(needle) } }],
      },
      select: { id: true, semester: true, subject: { select: { nameUz: true, nameRu: true } } },
      orderBy: { id: "asc" },
      take: LIMIT,
    }),
  ]);

  return {
    students: students.map((s) => ({ id: s.id, fullName: s.fullName, groupName: s.group?.name ?? null })),
    groups: groups.map((g) => ({ id: g.id, name: g.name, studentCount: g._count.students })),
    courses: courses.map((c) => ({ id: c.id, nameUz: c.subject.nameUz, nameRu: c.subject.nameRu, semester: c.semester })),
  };
}

/** ADMIN: the whole university — students, teachers, groups, courses. */
export async function adminSearch(q: string, scope?: { facultyId?: number | null; departmentId?: number | null }) {
  if (!q.trim()) return { students: [], teachers: [], groups: [], courses: [] };
  const needle = q.trim();
  const f = scope?.facultyId ?? undefined;
  const d = scope?.departmentId ?? undefined;

  const studentScope = d
    ? { enrollments: { some: { status: "ACTIVE" as const, course: { subject: { departmentId: d } } } } }
    : f
      ? { group: { facultyId: f } }
      : {};
  const teacherScope = d
    ? { teacherProfile: { departmentId: d } }
    : f
      ? { teacherProfile: { department: { facultyId: f } } }
      : {};
  const courseScope = d ? { subject: { departmentId: d } } : f ? { subject: { department: { facultyId: f } } } : {};

  const [students, teachers, groups, courses] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", ...studentScope, OR: [{ fullName: contains(needle) }, { email: contains(needle) }] },
      select: { id: true, fullName: true, group: { select: { name: true } } },
      orderBy: { fullName: "asc" },
      take: LIMIT,
    }),
    prisma.user.findMany({
      where: { role: "TEACHER", ...teacherScope, OR: [{ fullName: contains(needle) }, { email: contains(needle) }] },
      select: { id: true, fullName: true, teacherProfile: { select: { department: { select: { nameUz: true, nameRu: true } } } } },
      orderBy: { fullName: "asc" },
      take: LIMIT,
    }),
    prisma.studentGroup.findMany({
      where: { name: contains(needle), ...(f ? { facultyId: f } : {}) },
      select: { id: true, name: true, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
      take: LIMIT,
    }),
    prisma.course.findMany({
      where: { ...courseScope, OR: [{ subject: { nameUz: contains(needle) } }, { subject: { nameRu: contains(needle) } }] },
      select: { id: true, semester: true, subject: { select: { nameUz: true, nameRu: true } } },
      orderBy: { id: "asc" },
      take: LIMIT,
    }),
  ]);

  return {
    students: students.map((s) => ({ id: s.id, fullName: s.fullName, groupName: s.group?.name ?? null })),
    teachers: teachers.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      departmentUz: t.teacherProfile?.department.nameUz ?? null,
      departmentRu: t.teacherProfile?.department.nameRu ?? null,
    })),
    groups: groups.map((g) => ({ id: g.id, name: g.name, studentCount: g._count.students })),
    courses: courses.map((c) => ({ id: c.id, nameUz: c.subject.nameUz, nameRu: c.subject.nameRu, semester: c.semester })),
  };
}

/** STUDENT: own enrolled courses + their published topics. */
export async function studentSearch(studentId: number, q: string) {
  if (!q.trim()) return { courses: [], topics: [] };
  const needle = q.trim();
  const enrolled = { some: { status: "ACTIVE" as const, studentId } };

  const [courses, topics] = await Promise.all([
    prisma.course.findMany({
      where: {
        enrollments: enrolled,
        OR: [{ subject: { nameUz: contains(needle) } }, { subject: { nameRu: contains(needle) } }],
      },
      select: { id: true, semester: true, subject: { select: { nameUz: true, nameRu: true } } },
      orderBy: { id: "asc" },
      take: LIMIT,
    }),
    prisma.topic.findMany({
      where: {
        course: { enrollments: enrolled },
        contentItems: { some: { status: "PUBLISHED" } }, // students only see published topics
        OR: [{ titleUz: contains(needle) }, { titleRu: contains(needle) }],
      },
      select: { id: true, titleUz: true, titleRu: true, course: { select: { subject: { select: { nameUz: true, nameRu: true } } } } },
      orderBy: { id: "asc" },
      take: LIMIT,
    }),
  ]);

  return {
    courses: courses.map((c) => ({ id: c.id, nameUz: c.subject.nameUz, nameRu: c.subject.nameRu, semester: c.semester })),
    topics: topics.map((t) => ({
      id: t.id,
      titleUz: t.titleUz,
      titleRu: t.titleRu,
      courseUz: t.course.subject.nameUz,
      courseRu: t.course.subject.nameRu,
    })),
  };
}
