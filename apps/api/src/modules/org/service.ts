import { prisma } from "../../lib/prisma";
import { conflict, duplicate, notFound } from "../../lib/errors";

// ---------- Faculties ----------

export async function listFaculties() {
  const rows = await prisma.faculty.findMany({ orderBy: { id: "asc" } });
  return rows.map((f) => ({ id: f.id, nameUz: f.nameUz, nameRu: f.nameRu }));
}

export async function createFaculty(data: { nameUz: string; nameRu: string }) {
  const clash = await prisma.faculty.findFirst({
    where: { OR: [{ nameUz: data.nameUz }, { nameRu: data.nameRu }] },
  });
  if (clash) throw duplicate();
  const f = await prisma.faculty.create({ data });
  return { id: f.id, nameUz: f.nameUz, nameRu: f.nameRu };
}

export async function updateFaculty(id: number, data: { nameUz: string; nameRu: string }) {
  const existing = await prisma.faculty.findUnique({ where: { id } });
  if (!existing) throw notFound("Fakultet");
  const clash = await prisma.faculty.findFirst({
    where: { id: { not: id }, OR: [{ nameUz: data.nameUz }, { nameRu: data.nameRu }] },
  });
  if (clash) throw duplicate();
  const f = await prisma.faculty.update({ where: { id }, data });
  return { id: f.id, nameUz: f.nameUz, nameRu: f.nameRu };
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

export async function listDepartments(facultyId?: number) {
  const rows = await prisma.department.findMany({
    where: facultyId ? { facultyId } : undefined,
    orderBy: { id: "asc" },
    include: { faculty: true },
  });
  return rows.map((d) => ({
    id: d.id,
    facultyId: d.facultyId,
    nameUz: d.nameUz,
    nameRu: d.nameRu,
    facultyNameUz: d.faculty.nameUz,
    facultyNameRu: d.faculty.nameRu,
  }));
}

async function ensureFaculty(facultyId: number) {
  const f = await prisma.faculty.findUnique({ where: { id: facultyId } });
  if (!f) throw notFound("Fakultet");
}

export async function createDepartment(data: { facultyId: number; nameUz: string; nameRu: string }) {
  await ensureFaculty(data.facultyId);
  const clash = await prisma.department.findFirst({
    where: { facultyId: data.facultyId, OR: [{ nameUz: data.nameUz }, { nameRu: data.nameRu }] },
  });
  if (clash) throw duplicate();
  const d = await prisma.department.create({ data });
  return { id: d.id, facultyId: d.facultyId, nameUz: d.nameUz, nameRu: d.nameRu };
}

export async function updateDepartment(
  id: number,
  data: { facultyId?: number; nameUz: string; nameRu: string }
) {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw notFound("Kafedra");
  const facultyId = data.facultyId ?? existing.facultyId;
  if (data.facultyId) await ensureFaculty(data.facultyId);
  const clash = await prisma.department.findFirst({
    where: { id: { not: id }, facultyId, OR: [{ nameUz: data.nameUz }, { nameRu: data.nameRu }] },
  });
  if (clash) throw duplicate();
  const d = await prisma.department.update({
    where: { id },
    data: { facultyId, nameUz: data.nameUz, nameRu: data.nameRu },
  });
  return { id: d.id, facultyId: d.facultyId, nameUz: d.nameUz, nameRu: d.nameRu };
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

export async function listSubjects(departmentId?: number) {
  const rows = await prisma.subject.findMany({
    where: departmentId ? { departmentId } : undefined,
    orderBy: { id: "asc" },
    include: { department: true },
  });
  return rows.map((s) => ({
    id: s.id,
    departmentId: s.departmentId,
    nameUz: s.nameUz,
    nameRu: s.nameRu,
    description: s.description,
    departmentNameUz: s.department.nameUz,
    departmentNameRu: s.department.nameRu,
  }));
}

async function ensureDepartment(departmentId: number) {
  const d = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!d) throw notFound("Kafedra");
}

export async function createSubject(data: {
  departmentId: number;
  nameUz: string;
  nameRu: string;
  description?: string | null;
}) {
  await ensureDepartment(data.departmentId);
  const clash = await prisma.subject.findFirst({
    where: { departmentId: data.departmentId, OR: [{ nameUz: data.nameUz }, { nameRu: data.nameRu }] },
  });
  if (clash) throw duplicate();
  const s = await prisma.subject.create({ data });
  return {
    id: s.id,
    departmentId: s.departmentId,
    nameUz: s.nameUz,
    nameRu: s.nameRu,
    description: s.description,
  };
}

export async function updateSubject(
  id: number,
  data: { departmentId?: number; nameUz: string; nameRu: string; description?: string | null }
) {
  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing) throw notFound("Fan");
  const departmentId = data.departmentId ?? existing.departmentId;
  if (data.departmentId) await ensureDepartment(data.departmentId);
  const clash = await prisma.subject.findFirst({
    where: { id: { not: id }, departmentId, OR: [{ nameUz: data.nameUz }, { nameRu: data.nameRu }] },
  });
  if (clash) throw duplicate();
  const s = await prisma.subject.update({
    where: { id },
    data: { departmentId, nameUz: data.nameUz, nameRu: data.nameRu, description: data.description },
  });
  return {
    id: s.id,
    departmentId: s.departmentId,
    nameUz: s.nameUz,
    nameRu: s.nameRu,
    description: s.description,
  };
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
    include: { faculty: true },
  });
  return rows.map((g) => ({
    id: g.id,
    facultyId: g.facultyId,
    name: g.name,
    yearOfStudy: g.yearOfStudy,
    facultyNameUz: g.faculty.nameUz,
    facultyNameRu: g.faculty.nameRu,
    studentCount: 0, // студентов пока нет (модуль 2)
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
  await prisma.studentGroup.delete({ where: { id } });
}
