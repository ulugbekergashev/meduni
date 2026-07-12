import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";

function monthBounds(month?: string): { start: Date; end: Date } {
  const base = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T00:00:00`) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return { start, end };
}

export async function getAiUsage(opts: { month?: string; departmentId?: number }) {
  const { start, end } = monthBounds(opts.month);
  const where = { createdAt: { gte: start, lt: end }, ...(opts.departmentId ? { departmentId: opts.departmentId } : {}) };

  const [totals, byDeptRaw, byKindRaw, depts] = await Promise.all([
    prisma.aiUsage.aggregate({ where, _sum: { totalTokens: true, images: true, ttsChars: true, costUsd: true } }),
    prisma.aiUsage.groupBy({ by: ["departmentId"], where, _sum: { totalTokens: true, images: true, ttsChars: true, costUsd: true } }),
    prisma.aiUsage.groupBy({ by: ["kind"], where, _sum: { totalTokens: true, images: true, ttsChars: true, costUsd: true } }),
    prisma.department.findMany({ include: { aiQuota: true } }),
  ]);
  const deptMap = new Map(depts.map((d) => [d.id, d]));

  const byDept = byDeptRaw
    .filter((r) => r.departmentId !== null)
    .map((r) => {
      const d = deptMap.get(r.departmentId!);
      const q = d?.aiQuota;
      const tokens = r._sum.totalTokens ?? 0;
      const cost = r._sum.costUsd ?? 0;
      const images = r._sum.images ?? 0;
      const tokenPct = q && q.monthlyTokenLimit > 0 ? Math.round((tokens / q.monthlyTokenLimit) * 100) : null;
      const costPct = q && q.monthlyCostLimit > 0 ? Math.round((cost / q.monthlyCostLimit) * 100) : null;
      return {
        departmentId: r.departmentId!,
        nameUz: d?.nameUz ?? "—",
        nameRu: d?.nameRu ?? "—",
        tokens,
        images,
        ttsChars: r._sum.ttsChars ?? 0,
        cost: Math.round(cost * 1e4) / 1e4,
        quota: q ? { token: q.monthlyTokenLimit, image: q.monthlyImageLimit, cost: q.monthlyCostLimit } : null,
        tokenPct,
        costPct,
      };
    })
    .sort((a, b) => b.tokens - a.tokens);

  const byKind = byKindRaw.map((r) => ({
    kind: r.kind,
    tokens: r._sum.totalTokens ?? 0,
    images: r._sum.images ?? 0,
    ttsChars: r._sum.ttsChars ?? 0,
    cost: Math.round((r._sum.costUsd ?? 0) * 1e4) / 1e4,
  }));

  return {
    totals: {
      tokens: totals._sum.totalTokens ?? 0,
      images: totals._sum.images ?? 0,
      ttsChars: totals._sum.ttsChars ?? 0,
      cost: Math.round((totals._sum.costUsd ?? 0) * 1e4) / 1e4,
    },
    byDept,
    byKind,
  };
}

export async function getQuotas() {
  const { start, end } = monthBounds();
  const [depts, usage] = await Promise.all([
    prisma.department.findMany({ include: { aiQuota: true, faculty: true }, orderBy: { id: "asc" } }),
    prisma.aiUsage.groupBy({ by: ["departmentId"], where: { createdAt: { gte: start, lt: end } }, _sum: { totalTokens: true, images: true, costUsd: true } }),
  ]);
  const uMap = new Map(usage.filter((u) => u.departmentId).map((u) => [u.departmentId!, u._sum]));
  return depts.map((d) => {
    const u = uMap.get(d.id);
    return {
      departmentId: d.id,
      nameUz: d.nameUz,
      nameRu: d.nameRu,
      facultyNameUz: d.faculty.nameUz,
      facultyNameRu: d.faculty.nameRu,
      quota: {
        monthlyTokenLimit: d.aiQuota?.monthlyTokenLimit ?? 0,
        monthlyImageLimit: d.aiQuota?.monthlyImageLimit ?? 0,
        monthlyCostLimit: d.aiQuota?.monthlyCostLimit ?? 0,
      },
      used: { tokens: u?.totalTokens ?? 0, images: u?.images ?? 0, cost: Math.round((u?.costUsd ?? 0) * 1e4) / 1e4 },
    };
  });
}

export async function setQuota(actorId: number, departmentId: number, body: { monthlyTokenLimit?: number; monthlyImageLimit?: number; monthlyCostLimit?: number }) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) throw notFound("Kafedra");
  const data = {
    monthlyTokenLimit: Math.max(0, Math.round(body.monthlyTokenLimit ?? 0)),
    monthlyImageLimit: Math.max(0, Math.round(body.monthlyImageLimit ?? 0)),
    monthlyCostLimit: Math.max(0, body.monthlyCostLimit ?? 0),
  };
  await prisma.aiQuota.upsert({ where: { departmentId }, create: { departmentId, ...data }, update: data });
  await prisma.auditLog.create({
    data: { actorId, action: "UPDATE_QUOTA", entity: "Department", entityId: departmentId, detailsJson: data },
  });
  return { ok: true };
}

/** Count departments currently over any of their monthly limits (for the dashboard). */
export async function departmentsOverQuota(): Promise<number> {
  const quotas = await prisma.aiQuota.findMany();
  if (quotas.length === 0) return 0;
  const { start, end } = monthBounds();
  const usage = await prisma.aiUsage.groupBy({ by: ["departmentId"], where: { createdAt: { gte: start, lt: end } }, _sum: { totalTokens: true, images: true, costUsd: true } });
  const uMap = new Map(usage.filter((u) => u.departmentId).map((u) => [u.departmentId!, u._sum]));
  let over = 0;
  for (const q of quotas) {
    const u = uMap.get(q.departmentId);
    const tokens = u?.totalTokens ?? 0, images = u?.images ?? 0, cost = u?.costUsd ?? 0;
    if ((q.monthlyTokenLimit > 0 && tokens >= q.monthlyTokenLimit) || (q.monthlyImageLimit > 0 && images >= q.monthlyImageLimit) || (q.monthlyCostLimit > 0 && cost >= q.monthlyCostLimit)) over++;
  }
  return over;
}
