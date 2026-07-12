import { Router, type RequestHandler } from "express";
import multer from "multer";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as glossary from "./glossary";
import * as templates from "./templates";
import * as monitoring from "./monitoring";
import * as audit from "./audit";
import { adminStats } from "./stats";

const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const qnum = (v: unknown) => (v ? Number(v) : undefined);
const qstr = (v: unknown) => (typeof v === "string" && v ? v : undefined);

// ---------- Glossary (ADMIN + TEACHER) ----------
export const glossaryRouter = Router();
glossaryRouter.use(requireRoles("ADMIN", "TEACHER"));

glossaryRouter.get("/", wrap(async (req, res) => res.json(await glossary.listGlossary(req.user!, { departmentId: qnum(req.query.departmentId), search: qstr(req.query.search) }))));
glossaryRouter.post("/", wrap(async (req, res) => res.json(await glossary.createTerm(req.user!, req.body ?? {}))));
glossaryRouter.patch("/:id", wrap(async (req, res) => res.json(await glossary.updateTerm(req.user!, parseId(req.params.id), req.body ?? {}))));
glossaryRouter.delete("/:id", wrap(async (req, res) => res.json(await glossary.deleteTerm(req.user!, parseId(req.params.id)))));
glossaryRouter.post(
  "/import",
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Fayl yuklang", "Загрузите файл");
    res.json(await glossary.importGlossary(req.user!, qnum(req.body?.departmentId), req.file.buffer));
  })
);

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
adminRouter.get("/ai-usage", wrap(async (req, res) => res.json(await monitoring.getAiUsage({ month: qstr(req.query.month), departmentId: qnum(req.query.departmentId) }))));
adminRouter.get("/quotas", wrap(async (_req, res) => res.json(await monitoring.getQuotas())));
adminRouter.put("/quotas/:departmentId", wrap(async (req, res) => res.json(await monitoring.setQuota(req.user!.id, parseId(req.params.departmentId), req.body ?? {}))));
adminRouter.get(
  "/audit",
  wrap(async (req, res) =>
    res.json(await audit.listAudit({ actor: qstr(req.query.actor), action: qstr(req.query.action), entity: qstr(req.query.entity), from: qstr(req.query.from), to: qstr(req.query.to), page: qnum(req.query.page) }))
  )
);
