import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";

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
    subjectNameUz: c.subject.nameUz,
    subjectNameRu: c.subject.nameRu,
    departmentNameUz: c.subject.department.nameUz,
    departmentNameRu: c.subject.department.nameRu,
    teacherId: c.teacherId,
    teacherName: c.teacher.fullName,
    semester: c.semester,
    academicYear: c.academicYear,
    groups: c.courseGroups.map((cg) => ({ id: cg.group.id, name: cg.group.name })),
    studentCount: c._count.enrollments,
  };
}

export async function listCourses() {
  const rows = await prisma.course.findMany({ orderBy: { id: "asc" }, include: courseInclude });
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
  const topicCount = await prisma.topic.count({ where: { courseId: id } });
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

/** Lightweight course metadata for the teacher course shell (no students list). */
export async function getTeacherCourseMeta(courseId: number, teacherId: number) {
  const c = await prisma.course.findUnique({ where: { id: courseId }, include: courseInclude });
  if (!c) throw notFound("Kurs");
  if (c.teacherId !== teacherId) {
    throw new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
  }
  return toCourseOut(c);
}
