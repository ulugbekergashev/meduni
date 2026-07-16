import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z, type ZodTypeAny } from "zod";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import { ADMIN_ROLES, adminScope, assertDeptScope, assertFacultyScope, type AdminScope } from "../../middleware/adminScope";
import { prisma } from "../../lib/prisma";
import { importUsers } from "./import";
import * as svc from "./service";

const audit = (actorId: number, action: string, entityId: number, details?: object) =>
  prisma.auditLog.create({ data: { actorId, action, entity: "User", entityId, detailsJson: details ?? undefined } }).catch(() => {});

export const usersRouter = Router();
usersRouter.use(requireRoles(...ADMIN_ROLES));

/** Which roles each admin tier may create. */
const CREATABLE: Record<AdminScope["level"], string[]> = {
  SUPER: ["FACULTY_ADMIN", "DEPT_ADMIN", "TEACHER", "STUDENT"],
  FACULTY: ["DEPT_ADMIN", "TEACHER", "STUDENT"],
  DEPT: ["TEACHER"],
};

/** Assert the target user belongs to the caller's scope (and isn't a higher tier). */
async function assertUserInScope(scope: AdminScope, userId: number) {
  if (scope.level === "SUPER") return;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      facultyId: true,
      adminDepartmentId: true,
      adminDepartment: { select: { facultyId: true } },
      group: { select: { facultyId: true } },
      teacherProfile: { select: { departmentId: true, department: { select: { facultyId: true } } } },
    },
  });
  if (!u) throw notFound("Foydalanuvchi");
  if (u.role === "SUPERADMIN" || u.role === "ADMIN" || u.role === "FACULTY_ADMIN") throw forbidden();
  if (scope.level === "FACULTY") {
    const fid = u.group?.facultyId ?? u.teacherProfile?.department.facultyId ?? u.adminDepartment?.facultyId ?? u.facultyId;
    if (fid !== scope.facultyId) throw forbidden("Bu sizning fakultetingiz emas", "Это не ваш факультет");
    return;
  }
  // DEPT: may manage only teachers of the own department.
  if (u.role !== "TEACHER" || u.teacherProfile?.departmentId !== scope.departmentId) {
    throw forbidden("Bu sizning kafedrangiz emas", "Это не ваша кафедра");
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest("Maʼlumotlar notoʻgʻri", "Неверные данные");
  return parsed.data;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

const roleEnum = z.enum(["STUDENT", "TEACHER", "DEPT_ADMIN", "FACULTY_ADMIN"]);
const localeEnum = z.enum(["uz", "ru"]);

const createSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: roleEnum,
  phone: z.string().trim().optional().nullable(),
  locale: localeEnum.optional(),
  password: z.string().trim().min(4).optional().nullable(),
  groupId: z.number().int().positive().optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
  facultyId: z.number().int().positive().optional().nullable(),
  position: z.string().trim().optional().nullable(),
});

const updateSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional().nullable(),
  locale: localeEnum.optional(),
  groupId: z.number().int().positive().optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
  facultyId: z.number().int().positive().optional().nullable(),
  position: z.string().trim().optional().nullable(),
});

const ROLE_FILTERS = ["STUDENT", "TEACHER", "ADMIN", "SUPERADMIN", "FACULTY_ADMIN", "DEPT_ADMIN"];

// List ------------------------------------------------------------------
usersRouter.get(
  "/",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const roleRaw = String(req.query.role ?? "").toUpperCase();
    const role = ROLE_FILTERS.includes(roleRaw) ? (roleRaw as never) : undefined;
    const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const facultyId = req.query.facultyId ? Number(req.query.facultyId) : undefined;
    const active =
      req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    res.json(await svc.listUsers({ role, groupId, departmentId, facultyId, active, search, page, scope }));
  })
);

// Stats (role counts within scope) ----------------------------------------
usersRouter.get(
  "/stats",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    res.json(await svc.userStats(scope));
  })
);

// Profile page (role-aware) ----------------------------------------------
usersRouter.get(
  "/:id/profile",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const id = parseId(req.params.id);
    await assertUserInScope(scope, id);
    res.json(await svc.getUserProfile(id));
  })
);

// Create ----------------------------------------------------------------
usersRouter.post(
  "/",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const body = parseBody(createSchema, req.body);
    if (!CREATABLE[scope.level].includes(body.role)) throw forbidden();

    // Direction/scope rules per created role.
    if (body.role === "STUDENT" && body.groupId) {
      const group = await prisma.studentGroup.findUnique({ where: { id: body.groupId }, select: { facultyId: true } });
      if (!group) throw notFound("Guruh");
      assertFacultyScope(scope, group.facultyId);
    }
    if ((body.role === "TEACHER" || body.role === "DEPT_ADMIN")) {
      const deptId = scope.level === "DEPT" ? scope.departmentId! : body.departmentId;
      if (!deptId) throw badRequest("Kafedra majburiy", "Кафедра обязательна");
      const dept = await prisma.department.findUnique({ where: { id: deptId }, select: { id: true, facultyId: true } });
      if (!dept) throw notFound("Kafedra");
      assertDeptScope(scope, dept);
      body.departmentId = deptId;
    }
    if (body.role === "FACULTY_ADMIN" && !body.facultyId) {
      throw badRequest("Fakultet majburiy", "Факультет обязателен");
    }

    const created = await svc.createUser(body);
    await audit(req.user!.id, "CREATE_USER", created.id, { role: created.role, email: created.email });
    res.status(201).json(created);
  })
);

// Update ----------------------------------------------------------------
usersRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const id = parseId(req.params.id);
    await assertUserInScope(scope, id);
    const body = parseBody(updateSchema, req.body);
    // New affiliation values must also lie inside the caller's scope.
    if (body.groupId) {
      const group = await prisma.studentGroup.findUnique({ where: { id: body.groupId }, select: { facultyId: true } });
      if (!group) throw notFound("Guruh");
      assertFacultyScope(scope, group.facultyId);
    }
    if (body.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: body.departmentId }, select: { id: true, facultyId: true } });
      if (!dept) throw notFound("Kafedra");
      assertDeptScope(scope, dept);
    }
    res.json(await svc.updateUser(id, body));
  })
);

// Toggle active ---------------------------------------------------------
usersRouter.post(
  "/:id/toggle-active",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const id = parseId(req.params.id);
    await assertUserInScope(scope, id);
    const u = await svc.toggleActive(id);
    await audit(req.user!.id, u.isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER", u.id);
    res.json(u);
  })
);

// Reset password --------------------------------------------------------
usersRouter.post(
  "/:id/reset-password",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const id = parseId(req.params.id);
    await assertUserInScope(scope, id);
    res.json(await svc.resetPassword(id));
  })
);

// XLSX import (bulk) — university-wide, SUPERADMIN only ------------------
usersRouter.post(
  "/import",
  upload.single("file"),
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    if (scope.level !== "SUPER") throw forbidden();
    if (!req.file) throw badRequest("Fayl yuklanmadi", "Файл не загружен");
    res.json(await importUsers(req.file.buffer));
  })
);
