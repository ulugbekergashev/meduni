import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import { importUsers } from "./import";
import * as svc from "./service";

export const usersRouter = Router();
usersRouter.use(requireRoles("ADMIN"));

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

const roleEnum = z.enum(["STUDENT", "TEACHER"]);
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
  position: z.string().trim().optional().nullable(),
});

const updateSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional().nullable(),
  locale: localeEnum.optional(),
  groupId: z.number().int().positive().optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
  position: z.string().trim().optional().nullable(),
});

// List ------------------------------------------------------------------
usersRouter.get(
  "/",
  wrap(async (req, res) => {
    const roleRaw = String(req.query.role ?? "").toUpperCase();
    const role = roleRaw === "STUDENT" || roleRaw === "TEACHER" || roleRaw === "ADMIN" ? roleRaw : undefined;
    const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    res.json(await svc.listUsers({ role, groupId, search, page }));
  })
);

// Create ----------------------------------------------------------------
usersRouter.post(
  "/",
  wrap(async (req, res) => {
    res.status(201).json(await svc.createUser(parseBody(createSchema, req.body)));
  })
);

// Update ----------------------------------------------------------------
usersRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    res.json(await svc.updateUser(parseId(req.params.id), parseBody(updateSchema, req.body)));
  })
);

// Toggle active ---------------------------------------------------------
usersRouter.post(
  "/:id/toggle-active",
  wrap(async (req, res) => {
    res.json(await svc.toggleActive(parseId(req.params.id)));
  })
);

// Reset password --------------------------------------------------------
usersRouter.post(
  "/:id/reset-password",
  wrap(async (req, res) => {
    res.json(await svc.resetPassword(parseId(req.params.id)));
  })
);

// XLSX import -----------------------------------------------------------
usersRouter.post(
  "/import",
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Fayl yuklanmadi", "Файл не загружен");
    res.json(await importUsers(req.file.buffer));
  })
);
