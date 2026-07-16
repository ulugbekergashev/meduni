import { prisma } from "../../lib/prisma";
import { conflict, duplicate, notFound } from "../../lib/errors";

// ---------- Faculties ----------

export async function listFaculties(onlyId?: number) {
  const rows = await prisma.faculty.findMany({ where: onlyId ? { id: onlyId } : undefined, orderBy: { id: "asc" } });
  return rows.map((f) => ({ id: f.id, name: f.name }));
}

export async function createFaculty(data: { name: string }) {
  const clash = await prisma.faculty.findFirst({ where: { name: data.name } });
  if (clash) throw duplicate();
  const f = await prisma.faculty.create({ data });
  return { id: f.id, name: f.name };
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

export async function createDepartment(data: { facultyId: number; name: string }) {
  await ensureFaculty(data.facultyId);
  const clash = await prisma.department.findFirst({
    where: { facultyId: data.facultyId, name: data.name },
  });
  if (clash) throw duplicate();
  const d = await prisma.department.create({ data });
  return { id: d.id, facultyId: d.facultyId, name: d.name };
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
  const subCount = await prisma.subject.count({ where: { departmentId: id } });
  if (subCount > 0) {
    throw conflict(
      "HAS_CHILDREN",
      `Oʻchirib boʻlmaydi: bu kafedrada ${subCount} ta fan bor`,
      `Нельзя удалить: на этой кафедре ${subCount} предметов`
    );
  }
  await prisma.department.delete({ where: { id } });
}

// ---------- Subjects ----------

export async function listSubjects(departmentId?: number, facultyId?: number) {
  const rows = await prisma.subject.findMany({
    where: {
      ...(departmentId ? { departmentId } : {}),
      ...(facultyId ? { department: { facultyId } } : {}),
    },
    orderBy: { id: "asc" },
    include: { department: true },
  });
  return rows.map((s) => ({
    id: s.id,
    departmentId: s.departmentId,
    name: s.name,
    description: s.description,
    departmentName: s.department.name,
  }));
}

async function ensureDepartment(departmentId: number) {
  const d = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!d) throw notFound("Kafedra");
}

export async function createSubject(data: {
  departmentId: number;
  name: string;
  description?: string | null;
}) {
  await ensureDepartment(data.departmentId);
  const clash = await prisma.subject.findFirst({
    where: { departmentId: data.departmentId, name: data.name },
  });
  if (clash) throw duplicate();
  const s = await prisma.subject.create({ data });
  return { id: s.id, departmentId: s.departmentId, name: s.name, description: s.description };
}

export async function updateSubject(
  id: number,
  data: { departmentId?: number; name: string; description?: string | null }
) {
  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing) throw notFound("Fan");
  const departmentId = data.departmentId ?? existing.departmentId;
  if (data.departmentId) await ensureDepartment(data.departmentId);
  const clash = await prisma.subject.findFirst({
    where: { id: { not: id }, departmentId, name: data.name },
  });
  if (clash) throw duplicate();
  const s = await prisma.subject.update({
    where: { id },
    data: { departmentId, name: data.name, description: data.description },
  });
  return { id: s.id, departmentId: s.departmentId, name: s.name, description: s.description };
}

export async function deleteSubject(id: number) {
  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing) throw notFound("Fan");
  await prisma.subject.delete({ where: { id } });
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
