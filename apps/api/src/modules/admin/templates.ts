import { prisma } from "../../lib/prisma";
import { badRequest, notFound } from "../../lib/errors";

export interface TemplateColors {
  primary: string;
  secondary: string;
}

function out(t: { id: number; name: string; colorsJson: unknown; logoUrl: string | null; pptxMasterUrl: string | null; isDefault: boolean }) {
  const colors = (t.colorsJson as TemplateColors) ?? { primary: "#0F9E8E", secondary: "#0F172A" };
  return { id: t.id, name: t.name, colors, logoUrl: t.logoUrl, hasMaster: !!t.pptxMasterUrl, isDefault: t.isDefault };
}

export async function listTemplates() {
  const rows = await prisma.presentationTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { id: "asc" }] });
  return rows.map(out);
}

/** The default branded template used by presentation generation/export. */
export async function getDefaultTemplate() {
  const t = (await prisma.presentationTemplate.findFirst({ where: { isDefault: true } })) ?? (await prisma.presentationTemplate.findFirst({ orderBy: { id: "asc" } }));
  return t ? out(t) : null;
}

export async function createTemplate(body: { name?: string; colors?: TemplateColors; logoUrl?: string | null }) {
  if (!body.name?.trim()) throw badRequest("Nom kiriting", "Введите название");
  const colors: TemplateColors = { primary: body.colors?.primary || "#0F9E8E", secondary: body.colors?.secondary || "#0F172A" };
  const count = await prisma.presentationTemplate.count();
  const t = await prisma.presentationTemplate.create({
    data: { name: body.name.trim(), colorsJson: colors as object, logoUrl: body.logoUrl?.trim() || null, isDefault: count === 0 },
  });
  return { id: t.id };
}

export async function updateTemplate(id: number, body: { name?: string; colors?: TemplateColors; logoUrl?: string | null }) {
  const t = await prisma.presentationTemplate.findUnique({ where: { id } });
  if (!t) throw notFound("Shablon");
  await prisma.presentationTemplate.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.colors ? { colorsJson: { primary: body.colors.primary, secondary: body.colors.secondary } as object } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl?.trim() || null } : {}),
    },
  });
  return { ok: true };
}

export async function deleteTemplate(id: number) {
  const t = await prisma.presentationTemplate.findUnique({ where: { id } });
  if (!t) throw notFound("Shablon");
  await prisma.presentationTemplate.delete({ where: { id } });
  // Ensure some template remains default.
  if (t.isDefault) {
    const next = await prisma.presentationTemplate.findFirst({ orderBy: { id: "asc" } });
    if (next) await prisma.presentationTemplate.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return { ok: true };
}

export async function setDefault(id: number) {
  const t = await prisma.presentationTemplate.findUnique({ where: { id } });
  if (!t) throw notFound("Shablon");
  await prisma.$transaction([
    prisma.presentationTemplate.updateMany({ data: { isDefault: false } }),
    prisma.presentationTemplate.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return { ok: true };
}
