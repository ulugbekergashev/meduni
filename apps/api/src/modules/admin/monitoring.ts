import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";

function monthBounds(month?: string): { start: Date; end: Date } {
  const base = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T00:00:00`) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return { start, end };
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const localDay = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export async function getAiUsage(opts: { month?: string; departmentId?: number }) {
  const { start, end } = monthBounds(opts.month);
  const where = { createdAt: { gte: start, lt: end }, ...(opts.departmentId ? { departmentId: opts.departmentId } : {}) };

  // Usage volume is modest, so fetch the month's rows once and aggregate in JS —
  // lets us build day/model/user cuts that groupBy can't express (date-trunc, top-N).
  const [rows, depts] = await Promise.all([
    prisma.aiUsage.findMany({
      where,
      select: { createdAt: true, departmentId: true, userId: true, kind: true, model: true, totalTokens: true, images: true, ttsChars: true, costUsd: true },
    }),
    prisma.department.findMany({ include: { aiQuota: true } }),
  ]);
  const deptMap = new Map(depts.map((d) => [d.id, d]));

  const totals = { tokens: 0, images: 0, ttsChars: 0, cost: 0 };
  const kind = new Map<string, { tokens: number; images: number; ttsChars: number; cost: number }>();
  const model = new Map<string, { tokens: number; cost: number }>();
  const dept = new Map<number, { tokens: number; images: number; ttsChars: number; cost: number }>();
  const user = new Map<number, { tokens: number; cost: number }>();
  const day = new Map<string, { tokens: number; images: number; cost: number }>();
  const bump = <K, V extends object>(m: Map<K, V>, k: K, init: () => V) => {
    let v = m.get(k);
    if (!v) m.set(k, (v = init()));
    return v;
  };

  for (const r of rows) {
    const tokens = r.totalTokens ?? 0, images = r.images ?? 0, tts = r.ttsChars ?? 0, cost = r.costUsd ?? 0;
    totals.tokens += tokens; totals.images += images; totals.ttsChars += tts; totals.cost += cost;
    const k = bump(kind, r.kind, () => ({ tokens: 0, images: 0, ttsChars: 0, cost: 0 }));
    k.tokens += tokens; k.images += images; k.ttsChars += tts; k.cost += cost;
    const mo = bump(model, r.model, () => ({ tokens: 0, cost: 0 }));
    mo.tokens += tokens; mo.cost += cost;
    if (r.departmentId != null) { const d = bump(dept, r.departmentId, () => ({ tokens: 0, images: 0, ttsChars: 0, cost: 0 })); d.tokens += tokens; d.images += images; d.ttsChars += tts; d.cost += cost; }
    if (r.userId != null) { const u = bump(user, r.userId, () => ({ tokens: 0, cost: 0 })); u.tokens += tokens; u.cost += cost; }
    const dy = bump(day, localDay(r.createdAt), () => ({ tokens: 0, images: 0, cost: 0 }));
    dy.tokens += tokens; dy.images += images; dy.cost += cost;
  }

  // Continuous per-day timeline (every day of the month, even zero days).
  const byDay: { day: string; tokens: number; images: number; cost: number }[] = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const key = localDay(d);
    const v = day.get(key) ?? { tokens: 0, images: 0, cost: 0 };
    byDay.push({ day: key, tokens: v.tokens, images: v.images, cost: round4(v.cost) });
  }

  const byKind = [...kind.entries()]
    .map(([k, v]) => ({ kind: k, tokens: v.tokens, images: v.images, ttsChars: v.ttsChars, cost: round4(v.cost) }))
    .sort((a, b) => b.cost - a.cost);

  const byModel = [...model.entries()]
    .map(([m, v]) => ({ model: m, tokens: v.tokens, cost: round4(v.cost) }))
    .sort((a, b) => b.cost - a.cost);

  const byDept = [...dept.entries()]
    .map(([id, v]) => {
      const d = deptMap.get(id);
      const q = d?.aiQuota;
      const pct = (used: number, lim?: number) => (q && lim && lim > 0 ? Math.round((used / lim) * 100) : null);
      return {
        departmentId: id,
        nameUz: d?.nameUz ?? "—",
        nameRu: d?.nameRu ?? "—",
        tokens: v.tokens,
        images: v.images,
        ttsChars: v.ttsChars,
        cost: round4(v.cost),
        quota: q ? { token: q.monthlyTokenLimit, image: q.monthlyImageLimit, cost: q.monthlyCostLimit } : null,
        tokenPct: pct(v.tokens, q?.monthlyTokenLimit),
        imagePct: pct(v.images, q?.monthlyImageLimit),
        costPct: pct(v.cost, q?.monthlyCostLimit),
      };
    })
    .sort((a, b) => b.cost - a.cost);

  // Top teachers/users by cost, with names.
  const userIds = [...user.keys()];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
  const nameMap = new Map(users.map((u) => [u.id, u.fullName]));
  const byUser = [...user.entries()]
    .map(([id, v]) => ({ userId: id, name: nameMap.get(id) ?? "—", tokens: v.tokens, cost: round4(v.cost) }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8);

  return {
    totals: { tokens: totals.tokens, images: totals.images, ttsChars: totals.ttsChars, cost: round4(totals.cost) },
    byDay,
    byKind,
    byModel,
    byDept,
    byUser,
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
