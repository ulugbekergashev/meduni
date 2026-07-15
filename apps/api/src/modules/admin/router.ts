import { Router, type RequestHandler } from "express";
import { forbidden, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import { ADMIN_ROLES, adminScope } from "../../middleware/adminScope";
import { prisma } from "../../lib/prisma";
import * as monitoring from "./monitoring";
import * as audit from "./audit";
import { adminStats } from "./stats";
import { adminSearch } from "../search/service";

const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

const qnum = (v: unknown) => (v ? Number(v) : undefined);
const qstr = (v: unknown) => (typeof v === "string" && v ? v : undefined);

// ---------- Admin: AI monitoring / quotas / audit / stats (all admin tiers, scoped) ----------
export const adminRouter = Router();
adminRouter.use(requireRoles(...ADMIN_ROLES));

adminRouter.get("/stats", wrap(async (req, res) => res.json(await adminStats(await adminScope(req)))));

adminRouter.get("/search", wrap(async (req, res) => {
  const scope = await adminScope(req);
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json(await adminSearch(q, { facultyId: scope.facultyId, departmentId: scope.departmentId }));
}));

adminRouter.get("/ai-usage", wrap(async (req, res) => {
  const scope = await adminScope(req);
  res.json(
    await monitoring.getAiUsage({
      month: qstr(req.query.month),
      departmentId: scope.level === "DEPT" ? scope.departmentId! : qnum(req.query.departmentId),
      facultyId: scope.level === "FACULTY" ? scope.facultyId! : undefined,
    })
  );
}));

adminRouter.get("/quotas", wrap(async (req, res) => {
  const scope = await adminScope(req);
  res.json(await monitoring.getQuotas({ facultyId: scope.facultyId ?? undefined, departmentId: scope.departmentId ?? undefined }));
}));

// Budget control: SUPERADMIN anywhere; faculty admin within own faculty; dept admin — no.
adminRouter.put("/quotas/:departmentId", wrap(async (req, res) => {
  const scope = await adminScope(req);
  const departmentId = parseId(req.params.departmentId);
  if (scope.level === "DEPT") throw forbidden();
  if (scope.level === "FACULTY") {
    const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { facultyId: true } });
    if (!dept || dept.facultyId !== scope.facultyId) throw forbidden("Bu sizning fakultetingiz emas", "Это не ваш факультет");
  }
  res.json(await monitoring.setQuota(req.user!.id, departmentId, req.body ?? {}));
}));

// University-wide audit trail — SUPERADMIN only.
adminRouter.get(
  "/audit",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    if (scope.level !== "SUPER") throw forbidden();
    res.json(await audit.listAudit({ actor: qstr(req.query.actor), action: qstr(req.query.action), entity: qstr(req.query.entity), from: qstr(req.query.from), to: qstr(req.query.to), page: qnum(req.query.page) }));
  })
);
