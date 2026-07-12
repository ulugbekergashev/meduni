import argon2 from "argon2";
import type { Prisma, Role } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { generatePassword } from "../../lib/password";

const PAGE_SIZE = 20;

type UserWithRelations = Prisma.UserGetPayload<{
  include: { group: true; teacherProfile: { include: { department: true } } };
}>;

const withRelations = {
  group: true,
  teacherProfile: { include: { department: true } },
} satisfies Prisma.UserInclude;

function toUserOut(u: UserWithRelations) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role.toLowerCase(),
    locale: u.locale,
    isActive: u.isActive,
    groupId: u.groupId,
    groupName: u.group?.name ?? null,
    departmentId: u.teacherProfile?.departmentId ?? null,
    departmentNameUz: u.teacherProfile?.department.nameUz ?? null,
    departmentNameRu: u.teacherProfile?.department.nameRu ?? null,
    position: u.teacherProfile?.position ?? null,
  };
}

// ---------- List (filter + search + pagination) ----------

export async function listUsers(params: {
  role?: Role;
  groupId?: number;
  search?: string;
  page?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const where: Prisma.UserWhereInput = {};
  if (params.role) where.role = params.role;
  if (params.groupId) where.groupId = params.groupId;
  if (params.search) {
    where.OR = [
      { fullName: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: withRelations,
      orderBy: { id: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: rows.map(toUserOut), total, page, pageSize: PAGE_SIZE };
}

// ---------- Create ----------

interface CreateUserInput {
  fullName: string;
  email: string;
  role: Role;
  phone?: string | null;
  locale?: "uz" | "ru";
  password?: string | null;
  groupId?: number | null;
  departmentId?: number | null;
  position?: string | null;
}

async function assertEmailFree(email: string, exceptId?: number) {
  const clash = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), id: exceptId ? { not: exceptId } : undefined },
  });
  if (clash) {
    throw conflict("DUPLICATE_EMAIL", "Bu email band", "Этот email занят");
  }
}

export async function createUser(input: CreateUserInput) {
  const email = input.email.trim().toLowerCase();
  await assertEmailFree(email);

  if (input.role === "STUDENT") {
    if (!input.groupId) throw badRequest("Talaba uchun guruh majburiy", "Для студента группа обязательна");
    const group = await prisma.studentGroup.findUnique({ where: { id: input.groupId } });
    if (!group) throw notFound("Guruh");
  }
  if (input.role === "TEACHER") {
    if (!input.departmentId)
      throw badRequest("Oʻqituvchi uchun kafedra majburiy", "Для преподавателя кафедра обязательна");
    const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!dept) throw notFound("Kafedra");
  }

  const generated = input.password?.trim() ? null : generatePassword();
  const plain = input.password?.trim() || generated!;
  const passwordHash = await argon2.hash(plain);

  const created = await prisma.user.create({
    data: {
      fullName: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || null,
      role: input.role,
      locale: input.locale === "ru" ? "ru" : "uz",
      passwordHash,
      groupId: input.role === "STUDENT" ? input.groupId : null,
      teacherProfile:
        input.role === "TEACHER"
          ? { create: { departmentId: input.departmentId!, position: input.position?.trim() || null } }
          : undefined,
    },
    include: withRelations,
  });

  return { ...toUserOut(created), generatedPassword: generated };
}

// ---------- Update ----------

interface UpdateUserInput {
  fullName?: string;
  email?: string;
  phone?: string | null;
  locale?: "uz" | "ru";
  groupId?: number | null;
  departmentId?: number | null;
  position?: string | null;
}

export async function updateUser(id: number, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { id }, include: withRelations });
  if (!existing) throw notFound("Foydalanuvchi");

  if (input.email && input.email.trim().toLowerCase() !== existing.email) {
    await assertEmailFree(input.email.trim().toLowerCase(), id);
  }

  if (existing.role === "STUDENT" && input.groupId !== undefined) {
    if (!input.groupId) throw badRequest("Talaba uchun guruh majburiy", "Для студента группа обязательна");
    const group = await prisma.studentGroup.findUnique({ where: { id: input.groupId } });
    if (!group) throw notFound("Guruh");
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.fullName !== undefined) data.fullName = input.fullName.trim();
  if (input.email !== undefined) data.email = input.email.trim().toLowerCase();
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.locale !== undefined) data.locale = input.locale === "ru" ? "ru" : "uz";
  if (existing.role === "STUDENT" && input.groupId !== undefined) {
    data.group = { connect: { id: input.groupId! } };
  }

  await prisma.user.update({ where: { id }, data });

  if (existing.role === "TEACHER" && (input.departmentId !== undefined || input.position !== undefined)) {
    if (input.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
      if (!dept) throw notFound("Kafedra");
    }
    await prisma.teacherProfile.update({
      where: { userId: id },
      data: {
        departmentId: input.departmentId ?? existing.teacherProfile?.departmentId,
        position: input.position !== undefined ? input.position?.trim() || null : undefined,
      },
    });
  }

  const updated = await prisma.user.findUnique({ where: { id }, include: withRelations });
  return toUserOut(updated!);
}

// ---------- Toggle active ----------

export async function toggleActive(id: number) {
  const existing = await prisma.user.findUnique({ where: { id }, include: withRelations });
  if (!existing) throw notFound("Foydalanuvchi");
  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !existing.isActive },
    include: withRelations,
  });
  return toUserOut(updated);
}

// ---------- Reset password ----------

export async function resetPassword(id: number) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound("Foydalanuvchi");
  const password = generatePassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: await argon2.hash(password) } });
  return { password };
}

// ---------- Role-aware profile page (admin) ----------

export async function getUserProfile(id: number) {
  const user = await prisma.user.findUnique({ where: { id }, include: withRelations });
  if (!user) throw notFound("Foydalanuvchi");
  const base = toUserOut(user);

  if (user.role === "TEACHER") {
    const courses = await prisma.course.findMany({
      where: { teacherId: id },
      include: {
        subject: true,
        courseGroups: { include: { group: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { id: "asc" },
    });
    const publishedTopics = await prisma.topic.count({
      where: { course: { teacherId: id }, contentItems: { some: { status: "PUBLISHED" } } },
    });
    const distinctStudents = await prisma.enrollment.findMany({
      where: { status: "ACTIVE", course: { teacherId: id } },
      distinct: ["studentId"],
      select: { studentId: true },
    });
    return {
      ...base,
      kind: "teacher" as const,
      stats: { courses: courses.length, students: distinctStudents.length, publishedTopics },
      courses: courses.map((c) => ({
        id: c.id,
        subjectNameUz: c.subject.nameUz,
        subjectNameRu: c.subject.nameRu,
        semester: c.semester,
        academicYear: c.academicYear,
        groups: c.courseGroups.map((cg) => cg.group.name),
        studentCount: c._count.enrollments,
      })),
    };
  }

  if (user.role === "STUDENT") {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: id, status: "ACTIVE" },
      include: { course: { include: { subject: true } } },
      orderBy: { courseId: "asc" },
    });
    // Progress per course: COMPLETED topics / published topics (from persisted Progress rows).
    const progressRows = await prisma.progress.findMany({ where: { studentId: id, state: "COMPLETED" }, select: { topic: { select: { courseId: true } } } });
    const completedByCourse = new Map<number, number>();
    for (const p of progressRows) {
      completedByCourse.set(p.topic.courseId, (completedByCourse.get(p.topic.courseId) ?? 0) + 1);
    }
    const topicTotals = await prisma.topic.groupBy({
      by: ["courseId"],
      where: { courseId: { in: enrollments.map((e) => e.courseId) }, contentItems: { some: { status: "PUBLISHED" } } },
      _count: true,
    });
    const totalByCourse = new Map(topicTotals.map((t) => [t.courseId, t._count]));

    const att = await prisma.attendance.groupBy({ by: ["status"], where: { studentId: id }, _count: true });
    let present = 0, late = 0, marked = 0;
    for (const a of att) {
      marked += a._count;
      if (a.status === "PRESENT") present += a._count;
      else if (a.status === "LATE") late += a._count;
    }

    return {
      ...base,
      kind: "student" as const,
      attendancePct: marked === 0 ? null : Math.round(((present + late) / marked) * 100),
      courses: enrollments.map((e) => {
        const total = totalByCourse.get(e.courseId) ?? 0;
        const done = completedByCourse.get(e.courseId) ?? 0;
        return {
          id: e.courseId,
          subjectNameUz: e.course.subject.nameUz,
          subjectNameRu: e.course.subject.nameRu,
          semester: e.course.semester,
          completed: done,
          total,
          progressPct: total === 0 ? 0 : Math.round((done / total) * 100),
        };
      }),
    };
  }

  return { ...base, kind: "admin" as const };
}
