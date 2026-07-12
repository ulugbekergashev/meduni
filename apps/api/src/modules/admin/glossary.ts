import ExcelJS from "exceljs";
import { Prisma, prisma } from "../../lib/prisma";
import type { Role } from "../../lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors";

interface Actor {
  id: number;
  role: Role;
}

/** Teachers are pinned to their own department; admins pick any. */
async function resolveDepartment(actor: Actor, requested?: number): Promise<number> {
  if (actor.role === "TEACHER") {
    const tp = await prisma.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!tp) throw forbidden();
    return tp.departmentId;
  }
  if (!requested) throw badRequest("Kafedra tanlang", "Выберите кафедру");
  return requested;
}

async function assertCanTouch(actor: Actor, departmentId: number) {
  if (actor.role === "ADMIN") return;
  const tp = await prisma.teacherProfile.findUnique({ where: { userId: actor.id } });
  if (!tp || tp.departmentId !== departmentId) throw forbidden();
}

export async function listGlossary(actor: Actor, opts: { departmentId?: number; search?: string }) {
  const departmentId = await resolveDepartment(actor, opts.departmentId).catch(() => null);
  if (departmentId === null) return [];
  const where: Prisma.GlossaryWhereInput = {
    departmentId,
    ...(opts.search?.trim()
      ? { OR: [{ termRu: { contains: opts.search.trim(), mode: "insensitive" } }, { termUz: { contains: opts.search.trim(), mode: "insensitive" } }] }
      : {}),
  };
  const rows = await prisma.glossary.findMany({ where, orderBy: { termRu: "asc" } });
  return rows.map((r) => ({ id: r.id, departmentId: r.departmentId, termRu: r.termRu, termUz: r.termUz, termLat: r.termLat }));
}

export async function createTerm(actor: Actor, body: { departmentId?: number; termRu?: string; termUz?: string; termLat?: string }) {
  const departmentId = await resolveDepartment(actor, body.departmentId);
  if (!body.termRu?.trim() || !body.termUz?.trim()) throw badRequest("Termin (ru) va (uz) majburiy", "Термин (ru) и (uz) обязательны");
  try {
    const t = await prisma.glossary.create({
      data: { departmentId, termRu: body.termRu.trim(), termUz: body.termUz.trim(), termLat: body.termLat?.trim() || null, createdById: actor.id },
    });
    return { id: t.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("DUPLICATE", "Bu termin allaqachon bor", "Такой термин уже есть");
    throw e;
  }
}

export async function updateTerm(actor: Actor, id: number, body: { termRu?: string; termUz?: string; termLat?: string }) {
  const term = await prisma.glossary.findUnique({ where: { id } });
  if (!term) throw notFound("Termin");
  await assertCanTouch(actor, term.departmentId);
  await prisma.glossary.update({
    where: { id },
    data: {
      ...(body.termRu !== undefined ? { termRu: body.termRu.trim() } : {}),
      ...(body.termUz !== undefined ? { termUz: body.termUz.trim() } : {}),
      ...(body.termLat !== undefined ? { termLat: body.termLat?.trim() || null } : {}),
    },
  });
  return { ok: true };
}

export async function deleteTerm(actor: Actor, id: number) {
  const term = await prisma.glossary.findUnique({ where: { id } });
  if (!term) throw notFound("Termin");
  await assertCanTouch(actor, term.departmentId);
  await prisma.glossary.delete({ where: { id } });
  return { ok: true };
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text);
  return String(v).trim();
}

export async function importGlossary(actor: Actor, departmentIdRaw: number | undefined, buffer: Buffer) {
  const departmentId = await resolveDepartment(actor, departmentIdRaw);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw badRequest("Fayl boʻsh", "Файл пуст");

  let added = 0, skipped = 0;
  const rows: { termRu: string; termUz: string; termLat: string | null }[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return; // header
    const termRu = cellText(row.getCell(1).value);
    const termUz = cellText(row.getCell(2).value);
    const termLat = cellText(row.getCell(3).value) || null;
    if (termRu && termUz) rows.push({ termRu, termUz, termLat });
  });

  for (const r of rows) {
    try {
      await prisma.glossary.create({ data: { departmentId, termRu: r.termRu, termUz: r.termUz, termLat: r.termLat, createdById: actor.id } });
      added++;
    } catch {
      skipped++; // duplicate termRu in this department
    }
  }
  return { added, skipped, total: rows.length };
}
