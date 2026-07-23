import { Router, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import { ADMIN_ROLES, adminScope, assertDeptScope, assertFacultyScope } from "../../middleware/adminScope";
import { prisma } from "../../lib/prisma";
import * as svc from "./service";

export const orgRouter = Router();
orgRouter.use(requireRoles(...ADMIN_ROLES));

async function deptOrThrow(id: number) {
  const dept = await prisma.department.findUnique({ where: { id }, select: { id: true, facultyId: true } });
  if (!dept) throw notFound("Kafedra");
  return dept;
}

// Helpers ---------------------------------------------------------------

function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Maʼlumotlar notoʻgʻri", "Неверные данные");
  }
  return parsed.data;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

function optionalId(raw: unknown): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

const wrap = (fn: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Schemas ---------------------------------------------------------------

// Single-language names (Faza 1): one `name` field, entered as-is.
const nameField = z.string().trim().min(1);

// Optional admin account (dekan/mudir) created together with the unit.
const adminIn = z
  .object({
    fullName: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: z.string().trim().optional().nullable(),
    password: z.string().trim().min(4).optional().nullable(),
  })
  .optional()
  .nullable();
const quotaIn = z
  .object({
    monthlyTokenLimit: z.number().int().min(0),
    monthlyImageLimit: z.number().int().min(0),
    monthlyCostLimit: z.number().min(0),
  })
  .optional()
  .nullable();

const facultyIn = z.object({ name: nameField, admin: adminIn });
const facultyUpdate = z.object({ name: nameField });
const departmentIn = z.object({ facultyId: z.number().int().positive(), name: nameField, admin: adminIn, quota: quotaIn });
const departmentUpdate = z.object({ facultyId: z.number().int().positive().optional(), name: nameField });

const groupIn = z.object({
  facultyId: z.number().int().positive(),
  name: z.string().trim().min(1),
  yearOfStudy: z.number().int().min(1).max(6),
});
const groupUpdate = z.object({
  facultyId: z.number().int().positive().optional(),
  name: z.string().trim().min(1),
  yearOfStudy: z.number().int().min(1).max(6),
});

// Structure tree — the whole skeleton in one call (scoped).

orgRouter.get("/structure/tree", wrap(async (req, res) => {
  const scope = await adminScope(req);
  res.json(await svc.structureTree(scope));
}));

// Faculties — CUD is SUPERADMIN-only; lists collapse to the caller's scope.

orgRouter.get("/faculties", wrap(async (req, res) => {
  const scope = await adminScope(req);
  res.json(await svc.listFaculties(scope.level === "SUPER" ? undefined : scope.facultyId ?? undefined));
}));
orgRouter.post("/faculties", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level !== "SUPER") throw forbidden();
  res.status(201).json(await svc.createFaculty(parseBody(facultyIn, req.body), req.user!.id));
}));
orgRouter.patch("/faculties/:id", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level !== "SUPER") throw forbidden();
  res.json(await svc.updateFaculty(parseId(req.params.id), parseBody(facultyUpdate, req.body)));
}));
orgRouter.delete("/faculties/:id", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level !== "SUPER") throw forbidden();
  await svc.deleteFaculty(parseId(req.params.id));
  res.status(204).end();
}));

// Departments — faculty admin manages depts of their own faculty.

orgRouter.get("/departments", wrap(async (req, res) => {
  const scope = await adminScope(req);
  const facultyId = scope.level === "SUPER" ? optionalId(req.query.facultyId) : scope.facultyId ?? undefined;
  const departmentId = scope.level === "DEPT" ? scope.departmentId ?? undefined : undefined;
  res.json(await svc.listDepartments(facultyId, departmentId));
}));
orgRouter.post("/departments", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level === "DEPT") throw forbidden();
  const body = parseBody(departmentIn, req.body);
  assertFacultyScope(scope, body.facultyId);
  res.status(201).json(await svc.createDepartment(body, req.user!.id));
}));
orgRouter.patch("/departments/:id", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level === "DEPT") throw forbidden();
  const dept = await deptOrThrow(parseId(req.params.id));
  assertFacultyScope(scope, dept.facultyId);
  const body = parseBody(departmentUpdate, req.body);
  if (body.facultyId) assertFacultyScope(scope, body.facultyId);
  res.json(await svc.updateDepartment(dept.id, body));
}));
orgRouter.delete("/departments/:id", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level === "DEPT") throw forbidden();
  const dept = await deptOrThrow(parseId(req.params.id));
  assertFacultyScope(scope, dept.facultyId);
  await svc.deleteDepartment(dept.id);
  res.status(204).end();
}));



// Groups — faculty-level entity; dept admin can read (course wiring) but not manage.

orgRouter.get("/groups", wrap(async (req, res) => {
  const scope = await adminScope(req);
  const facultyId = scope.level === "SUPER" ? optionalId(req.query.facultyId) : scope.facultyId ?? undefined;
  res.json(await svc.listGroups(facultyId));
}));
orgRouter.post("/groups", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level === "DEPT") throw forbidden();
  const body = parseBody(groupIn, req.body);
  assertFacultyScope(scope, body.facultyId);
  res.status(201).json(await svc.createGroup(body));
}));
orgRouter.patch("/groups/:id", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level === "DEPT") throw forbidden();
  const group = await prisma.studentGroup.findUnique({ where: { id: parseId(req.params.id) }, select: { id: true, facultyId: true } });
  if (!group) throw notFound("Guruh");
  assertFacultyScope(scope, group.facultyId);
  const body = parseBody(groupUpdate, req.body);
  if (body.facultyId) assertFacultyScope(scope, body.facultyId);
  res.json(await svc.updateGroup(group.id, body));
}));
orgRouter.delete("/groups/:id", wrap(async (req, res) => {
  const scope = await adminScope(req);
  if (scope.level === "DEPT") throw forbidden();
  const group = await prisma.studentGroup.findUnique({ where: { id: parseId(req.params.id) }, select: { id: true, facultyId: true } });
  if (!group) throw notFound("Guruh");
  assertFacultyScope(scope, group.facultyId);
  await svc.deleteGroup(group.id);
  res.status(204).end();
}));
