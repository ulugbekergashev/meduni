import { Prisma, prisma } from "../../lib/prisma";

const PAGE_SIZE = 30;

export async function listAudit(opts: { actor?: string; action?: string; entity?: string; from?: string; to?: string; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {
    ...(opts.actor?.trim() ? { actor: { fullName: { contains: opts.actor.trim(), mode: "insensitive" } } } : {}),
    ...(opts.action?.trim() ? { action: opts.action.trim() } : {}),
    ...(opts.entity?.trim() ? { entity: opts.entity.trim() } : {}),
  };
  const dateFilter: Prisma.DateTimeFilter = {};
  if (opts.from) dateFilter.gte = new Date(opts.from);
  if (opts.to) {
    const end = new Date(opts.to);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  if (opts.from || opts.to) where.createdAt = dateFilter;

  const [total, rows, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { actor: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      actorName: r.actor.fullName,
      actorRole: r.actor.role,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      details: r.detailsJson,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    actions: actions.map((a) => a.action),
  };
}
