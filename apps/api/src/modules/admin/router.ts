import { Router, type RequestHandler } from "express";
import { notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as templates from "./templates";
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

// ---------- Templates (ADMIN) ----------
export const templatesRouter = Router();
templatesRouter.use(requireRoles("ADMIN"));

templatesRouter.get("/", wrap(async (_req, res) => res.json(await templates.listTemplates())));
templatesRouter.post("/", wrap(async (req, res) => res.json(await templates.createTemplate(req.body ?? {}))));
templatesRouter.patch("/:id", wrap(async (req, res) => res.json(await templates.updateTemplate(parseId(req.params.id), req.body ?? {}))));
templatesRouter.delete("/:id", wrap(async (req, res) => res.json(await templates.deleteTemplate(parseId(req.params.id)))));
templatesRouter.post("/:id/set-default", wrap(async (req, res) => res.json(await templates.setDefault(parseId(req.params.id)))));

// ---------- Admin: AI monitoring / quotas / audit / stats (ADMIN) ----------
export const adminRouter = Router();
adminRouter.use(requireRoles("ADMIN"));

adminRouter.get("/stats", wrap(async (_req, res) => res.json(await adminStats())));
adminRouter.get("/search", wrap(async (req, res) => res.json(await adminSearch(typeof req.query.q === "string" ? req.query.q : ""))));
adminRouter.get("/ai-usage", wrap(async (req, res) => res.json(await monitoring.getAiUsage({ month: qstr(req.query.month), departmentId: qnum(req.query.departmentId) }))));
adminRouter.get("/quotas", wrap(async (_req, res) => res.json(await monitoring.getQuotas())));
adminRouter.put("/quotas/:departmentId", wrap(async (req, res) => res.json(await monitoring.setQuota(req.user!.id, parseId(req.params.departmentId), req.body ?? {}))));
adminRouter.get(
  "/audit",
  wrap(async (req, res) =>
    res.json(await audit.listAudit({ actor: qstr(req.query.actor), action: qstr(req.query.action), entity: qstr(req.query.entity), from: qstr(req.query.from), to: qstr(req.query.to), page: qnum(req.query.page) }))
  )
);
