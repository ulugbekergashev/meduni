import { Router, type RequestHandler } from "express";
import { forbidden, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import { ADMIN_ROLES, adminScope } from "../../middleware/adminScope";
import { prisma } from "../../lib/prisma";
import * as monitoring from "./monitoring";
import * as audit from "./audit";
import * as students from "./students";
import { getAdminGroup, assertGroupInScope } from "./groups";
import { getGroupLessons } from "../courses/timetable";
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
import * as control from "../policy/control";
import * as calendar from "./calendar";
import * as excuse from "../attendance/excuse";
import * as attendanceControl from "./attendance";

export const adminRouter = Router();
adminRouter.use(requireRoles(...ADMIN_ROLES));

adminRouter.get("/stats", wrap(async (req, res) => res.json(await adminStats(await adminScope(req)))));

// ЖЁСТКИЙ КОНТРОЛЬ (2026-08-11): отклонения от коридора политики + редактирование
// самого коридора. Область видимости — как во всём админ-контуре.
adminRouter.get("/control", wrap(async (req, res) => res.json(await control.getControlReport(req))));
adminRouter.get("/policies", wrap(async (req, res) => res.json(await control.listPolicies(req))));
adminRouter.put("/policies", wrap(async (req, res) => res.json(await control.upsertPolicy(req, req.body ?? {}))));

// O'QUV KALENDARI (Davomat 2.0 · F1): semestr sanalari + dars bo'lmaydigan kunlar.
// Kalendarsiz darslar bayramda ham hosil bo'laveradi va davomat maxraji shishadi.
// DAVOMAT NAZORATI — dekanat ekrani (guruhlar, xavf ro'yxati, sikllar).
adminRouter.get("/attendance", wrap(async (req, res) => res.json(await attendanceControl.getAttendanceControl(await adminScope(req)))));

// SPRAVKA ARIZALARI — dekanat navbati (siyosat bo'yicha "Sababli"ni dekanat qo'yadi).
adminRouter.get("/excuses", wrap(async (req, res) => {
  const scope = await adminScope(req);
  res.json(await excuse.excuseQueue({ status: qstr(req.query.status), facultyId: scope.facultyId ?? undefined }));
}));
adminRouter.post("/excuses/:id/review", wrap(async (req, res) =>
  res.json(await excuse.reviewExcuse(req.user!.id, Number(req.params.id), { approve: req.body?.approve !== false, comment: req.body?.comment }))
));

adminRouter.get("/terms", wrap(async (_req, res) => res.json(await calendar.listTerms())));
adminRouter.put("/terms", wrap(async (req, res) => res.json(await calendar.upsertTerm(await adminScope(req), req.body ?? {}))));
adminRouter.delete("/terms/:id", wrap(async (req, res) => res.json(await calendar.deleteTerm(await adminScope(req), Number(req.params.id)))));
adminRouter.get("/calendar-exceptions", wrap(async (req, res) =>
  res.json(await calendar.listExceptions(await adminScope(req), { from: qstr(req.query.from), to: qstr(req.query.to) }))
));
adminRouter.post("/calendar-exceptions", wrap(async (req, res) => res.status(201).json(await calendar.createException(await adminScope(req), req.body ?? {}))));
adminRouter.delete("/calendar-exceptions/:id", wrap(async (req, res) => res.json(await calendar.deleteException(await adminScope(req), Number(req.params.id)))));

adminRouter.get("/search", wrap(async (req, res) => {
  const scope = await adminScope(req);
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json(await adminSearch(q, { facultyId: scope.facultyId, departmentId: scope.departmentId }));
}));

// ---------- Students module (contingent; dept admins have no student scope) ----------

adminRouter.get("/students", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level === "DEPT") throw forbidden();
  res.json(
    await students.listStudents(scope, {
      facultyId: qnum(req.query.facultyId),
      groupId: qnum(req.query.groupId),
      active: req.query.active === "true" ? true : req.query.active === "false" ? false : undefined,
      search: qstr(req.query.search),
      page: qnum(req.query.page),
    })
  );
}));

adminRouter.get("/students/stats", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level === "DEPT") throw forbidden();
  res.json(await students.studentStats(scope));
}));

// ---------- Group oversight (courses + schedule + attendance/progress; faculty-scoped) ----------

adminRouter.get("/groups/:id", wrap(async (req, res) => {
  res.json(await getAdminGroup(parseId(req.params.id), await adminScope(req)));
}));

// Guruhning [from..to] darslari — slotlardan (admin nazorati uchun jadval).
adminRouter.get("/groups/:id/lessons", wrap(async (req, res) => {
  const scope = await adminScope(req);
  const id = parseId(req.params.id);
  await assertGroupInScope(id, scope);
  const from = qstr(req.query.from) ?? "";
  const to = qstr(req.query.to) ?? "";
  if (!from || !to) throw notFound();
  res.json(await getGroupLessons(id, from, to));
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
