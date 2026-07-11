import { Router, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";

export const coursesRouter = Router();
coursesRouter.use(requireRoles("ADMIN"));

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

const createSchema = z.object({
  subjectId: z.number().int().positive(),
  teacherId: z.number().int().positive(),
  semester: z.number().int().min(1).max(8),
  academicYear: z.string().trim().min(1),
  groupIds: z.array(z.number().int().positive()).min(1),
});

const updateSchema = z.object({
  subjectId: z.number().int().positive().optional(),
  teacherId: z.number().int().positive().optional(),
  semester: z.number().int().min(1).max(8).optional(),
  academicYear: z.string().trim().min(1).optional(),
  groupIds: z.array(z.number().int().positive()).optional(),
});

coursesRouter.get("/", wrap(async (_req, res) => res.json(await svc.listCourses())));

coursesRouter.get("/:id", wrap(async (req, res) => res.json(await svc.getCourseDetail(parseId(req.params.id)))));

coursesRouter.get(
  "/:id/students",
  wrap(async (req, res) => res.json(await svc.listCourseStudents(parseId(req.params.id))))
);

coursesRouter.post(
  "/",
  wrap(async (req, res) => res.status(201).json(await svc.createCourse(parseBody(createSchema, req.body))))
);

coursesRouter.patch(
  "/:id",
  wrap(async (req, res) => res.json(await svc.updateCourse(parseId(req.params.id), parseBody(updateSchema, req.body))))
);

coursesRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    await svc.deleteCourse(parseId(req.params.id));
    res.status(204).end();
  })
);
