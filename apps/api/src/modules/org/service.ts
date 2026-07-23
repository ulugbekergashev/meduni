import argon2 from "argon2";
import { prisma } from "../../lib/prisma";
import { conflict, duplicate, notFound } from "../../lib/errors";
import { generatePassword } from "../../lib/password";
import type { AdminScope } from "../../middleware/adminScope";

/** Optional admin account created together with a faculty (dekan) or department (mudir). */
export interface UnitAdminInput {
  fullName: string;
  email: string;
  phone?: string | null;
  password?: string | null;
}

export interface UnitQuotaInput {
  monthlyTokenLimit: number;
  monthlyImageLimit: number;
  monthlyCostLimit: number;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Create the unit's admin user inside the same transaction; returns reveal payload. */
async function createUnitAdmin(
  tx: Tx,
  input: UnitAdminInput,
  role: "FACULTY_ADMIN" | "DEPT_ADMIN",
  unit: { facultyId?: number; adminDepartmentId?: number },
  actorId?: number
) {
  const email = input.email.trim().toLowerCase();
  const clash = await tx.user.findFirst({ where: { email } });
  if (clash) throw conflict("DUPLICATE_EMAIL", "Bu email band", "Этот email занят");
  const generated = input.password?.trim() ? null : generatePassword();
  const plain = input.password?.trim() || generated!;
  const passwordHash = await argon2.hash(plain);
  const u = await tx.user.create({
    data: {
      fullName: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || null,
      role,
      locale: "uz",
      passwordHash,
      ...unit,
    },
  });
  if (actorId) {
    await tx.auditLog.create({
      data: { actorId, action: "CREATE_USER", entity: "User", entityId: u.id, detailsJson: { role, email } },
    });
  }
  return { id: u.id, fullName: u.fullName, email: u.email, generatedPassword: generated };
}

// ---------- Structure tree (single-page overview) ----------

/** Whole university skeleton in one call, collapsed to the caller's scope:
 *  SUPER — all faculties; FACULTY — own faculty; DEPT — own faculty with only
 *  the own department (groups stay visible read-only). */
export async function structureTree(scope: AdminScope) {
  const rows = await prisma.faculty.findMany({
    where: scope.level === "SUPER" ? {} : { id: scope.facultyId! },
    orderBy: { id: "asc" },
    include: {
      admins: { where: { isActive: true }, select: { id: true, fullName: true, phone: true, email: true } },
      departments: {
        where: scope.level === "DEPT" ? { id: scope.departmentId! } : {},
        orderBy: { id: "asc" },
        include: {
          admins: { where: { isActive: true }, select: { id: true, fullName: true, phone: true, email: true } },
          courses: { orderBy: { id: "asc" } },
          _count: { select: { teachers: true } },
        },
      },
      groups: { orderBy: { name: "asc" }, include: { _count: { select: { students: true } } } },
    },
  });
  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    admins: f.admins,
    departments: f.departments.map((d) => ({
      id: d.id,
      name: d.name,
      admins: d.admins,
      teacherCount: d._count.teachers,
      courses: d.courses.map((c) => ({ id: c.id, name: c.name, description: c.description })),
    })),
    groups: f.groups.map((g) => ({ id: g.id, name: g.name, yearOfStudy: g.yearOfStudy, studentCount: g._count.students })),
  }));
}

// ---------- Faculties ----------

export async function listFaculties(onlyId?: number) {
  const rows = await prisma.faculty.findMany({ where: onlyId ? { id: onlyId } : undefined, orderBy: { id: "asc" } });
  return rows.map((f) => ({ id: f.id, name: f.name }));
}

export async function createFaculty(
  data: { name: string; admin?: UnitAdminInput | null },
  actorId?: number
) {
  const clash = await prisma.faculty.findFirst({ where: { name: data.name } });
  if (clash) throw duplicate();
  return prisma.$transaction(async (tx) => {
    const f = await tx.faculty.create({ data: { name: data.name } });
    const admin = data.admin
      ? await createUnitAdmin(tx, data.admin, "FACULTY_ADMIN", { facultyId: f.id }, actorId)
      : null;
    return { id: f.id, name: f.name, admin };
  });
}

export async function updateFaculty(id: number, data: { name: string }) {
  const existing = await prisma.faculty.findUnique({ where: { id } });
  if (!existing) throw notFound("Fakultet");
  const clash = await prisma.faculty.findFirst({ where: { id: { not: id }, name: data.name } });
  if (clash) throw duplicate();
  const f = await prisma.faculty.update({ where: { id }, data });
  return { id: f.id, name: f.name };
}

export async function deleteFaculty(id: number) {
  const existing = await prisma.faculty.findUnique({ where: { id } });
  if (!existing) throw notFound("Fakultet");

  const depCount = await prisma.department.count({ where: { facultyId: id } });
  if (depCount > 0) {
    throw conflict(
      "HAS_CHILDREN",
      `Oʻchirib boʻlmaydi: bu fakultetda ${depCount} ta kafedra bor`,
      `Нельзя удалить: на этом факультете ${depCount} кафедр`
    );
  }
  const grpCount = await prisma.studentGroup.count({ where: { facultyId: id } });
  if (grpCount > 0) {
    throw conflict(
      "HAS_CHILDREN",
      `Oʻchirib boʻlmaydi: bu fakultetda ${grpCount} ta guruh bor`,
      `Нельзя удалить: на этом факультете ${grpCount} групп`
    );
  }
  await prisma.faculty.delete({ where: { id } });
}

// ---------- Departments ----------

export async function listDepartments(facultyId?: number, departmentId?: number) {
  const rows = await prisma.department.findMany({
    where: { ...(facultyId ? { facultyId } : {}), ...(departmentId ? { id: departmentId } : {}) },
    orderBy: { id: "asc" },
    include: { faculty: true },
  });
  return rows.map((d) => ({
    id: d.id,
    facultyId: d.facultyId,
    name: d.name,
    facultyName: d.faculty.name,
  }));
}

async function ensureFaculty(facultyId: number) {
  const f = await prisma.faculty.findUnique({ where: { id: facultyId } });
  if (!f) throw notFound("Fakultet");
}

export async function createDepartment(
  data: { facultyId: number; name: string; admin?: UnitAdminInput | null; quota?: UnitQuotaInput | null },
  actorId?: number
) {
  await ensureFaculty(data.facultyId);
  const clash = await prisma.department.findFirst({
    where: { facultyId: data.facultyId, name: data.name },
  });
  if (clash) throw duplicate();
  return prisma.$transaction(async (tx) => {
    const d = await tx.department.create({ data: { facultyId: data.facultyId, name: data.name } });
    const admin = data.admin
      ? await createUnitAdmin(tx, data.admin, "DEPT_ADMIN", { adminDepartmentId: d.id }, actorId)
      : null;
    if (data.quota) {
      await tx.aiQuota.create({
        data: {
          departmentId: d.id,
          monthlyTokenLimit: data.quota.monthlyTokenLimit,
          monthlyImageLimit: data.quota.monthlyImageLimit,
          monthlyCostLimit: data.quota.monthlyCostLimit,
        },
      });
      if (actorId) {
        await tx.auditLog.create({
          data: { actorId, action: "UPDATE_QUOTA", entity: "Department", entityId: d.id, detailsJson: { ...data.quota } },
        });
      }
    }
    return { id: d.id, facultyId: d.facultyId, name: d.name, admin };
  });
}

export async function updateDepartment(id: number, data: { facultyId?: number; name: string }) {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw notFound("Kafedra");
  const facultyId = data.facultyId ?? existing.facultyId;
  if (data.facultyId) await ensureFaculty(data.facultyId);
  const clash = await prisma.department.findFirst({
    where: { id: { not: id }, facultyId, name: data.name },
  });
  if (clash) throw duplicate();
  const d = await prisma.department.update({
    where: { id },
    data: { facultyId, name: data.name },
  });
  return { id: d.id, facultyId: d.facultyId, name: d.name };
}

export async function deleteDepartment(id: number) {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw notFound("Kafedra");
  const subCount = await prisma.course.count({ where: { departmentId: id } });
  if (subCount > 0) {
    throw conflict(
      "HAS_CHILDREN",
      `Oʻchirib boʻlmaydi: bu kafedrada ${subCount} ta kurs bor`,
      `Нельзя удалить: на этой кафедре ${subCount} курсов`
    );
  }
  await prisma.department.delete({ where: { id } });
}


// ---------- Groups ----------

export async function listGroups(facultyId?: number) {
  const rows = await prisma.studentGroup.findMany({
    where: facultyId ? { facultyId } : undefined,
    orderBy: { id: "asc" },
    include: { faculty: true, _count: { select: { students: true } } },
  });
  return rows.map((g) => ({
    id: g.id,
    facultyId: g.facultyId,
    name: g.name,
    yearOfStudy: g.yearOfStudy,
    facultyName: g.faculty.name,
    studentCount: g._count.students,
  }));
}

export async function createGroup(data: { facultyId: number; name: string; yearOfStudy: number }) {
  await ensureFaculty(data.facultyId);
  const clash = await prisma.studentGroup.findFirst({
    where: { facultyId: data.facultyId, name: data.name },
  });
  if (clash) throw duplicate();
  const g = await prisma.studentGroup.create({ data });
  return { id: g.id, facultyId: g.facultyId, name: g.name, yearOfStudy: g.yearOfStudy };
}

export async function updateGroup(
  id: number,
  data: { facultyId?: number; name: string; yearOfStudy: number }
) {
  const existing = await prisma.studentGroup.findUnique({ where: { id } });
  if (!existing) throw notFound("Guruh");
  const facultyId = data.facultyId ?? existing.facultyId;
  if (data.facultyId) await ensureFaculty(data.facultyId);
  const clash = await prisma.studentGroup.findFirst({
    where: { id: { not: id }, facultyId, name: data.name },
  });
  if (clash) throw duplicate();
  const g = await prisma.studentGroup.update({
    where: { id },
    data: { facultyId, name: data.name, yearOfStudy: data.yearOfStudy },
  });
  return { id: g.id, facultyId: g.facultyId, name: g.name, yearOfStudy: g.yearOfStudy };
}

export async function deleteGroup(id: number) {
  const existing = await prisma.studentGroup.findUnique({ where: { id } });
  if (!existing) throw notFound("Guruh");
  const studentCount = await prisma.user.count({ where: { groupId: id } });
  if (studentCount > 0) {
    throw conflict(
      "HAS_CHILDREN",
      `Oʻchirib boʻlmaydi: bu guruhda ${studentCount} ta talaba bor`,
      `Нельзя удалить: в этой группе ${studentCount} студентов`
    );
  }
  await prisma.studentGroup.delete({ where: { id } });
}
