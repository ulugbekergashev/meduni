import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";

export function monthStart(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export interface MonthUsage {
  tokens: number;
  images: number;
  costUsd: number;
}

export async function currentMonthUsage(departmentId: number): Promise<MonthUsage> {
  const agg = await prisma.aiUsage.aggregate({
    where: { departmentId, createdAt: { gte: monthStart() } },
    _sum: { totalTokens: true, images: true, costUsd: true },
  });
  return {
    tokens: agg._sum.totalTokens ?? 0,
    images: agg._sum.images ?? 0,
    costUsd: agg._sum.costUsd ?? 0,
  };
}

/** Enforce the department's monthly AI quota before a generation. 0 limit = unlimited. */
export async function assertQuota(departmentId: number | null | undefined): Promise<void> {
  if (!departmentId) return;
  const quota = await prisma.aiQuota.findUnique({ where: { departmentId } });
  if (!quota) return; // no quota set -> unlimited
  const used = await currentMonthUsage(departmentId);
  const over =
    (quota.monthlyTokenLimit > 0 && used.tokens >= quota.monthlyTokenLimit) ||
    (quota.monthlyImageLimit > 0 && used.images >= quota.monthlyImageLimit) ||
    (quota.monthlyCostLimit > 0 && used.costUsd >= quota.monthlyCostLimit);
  if (over) {
    throw new ApiError(403, "quota_exceeded", "Kafedra oylik kvotasi tugadi. Admin bilan bogʻlaning.", "Месячная квота кафедры исчерпана. Свяжитесь с администратором.");
  }
}
