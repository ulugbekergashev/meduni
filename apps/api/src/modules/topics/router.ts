import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

// ---- Topics router (/api/v1/topics) ----

export const topicsRouter = Router();
topicsRouter.use(requireRoles("TEACHER"));

const createSchema = z.object({
  courseId: z.number().int().positive(),
  titleUz: z.string().trim().min(1),
  titleRu: z.string().trim().min(1),
});
const updateSchema = z.object({
  titleUz: z.string().trim().min(1).optional(),
  titleRu: z.string().trim().min(1).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});
const reorderSchema = z.object({ orderedIds: z.array(z.number().int().positive()) });

// List by course: GET /api/v1/topics?courseId=
topicsRouter.get(
  "/",
  wrap(async (req, res) => {
    const courseId = Number(req.query.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) throw badRequest("courseId kerak", "Требуется courseId");
    res.json(await svc.listTopics(courseId, req.user!.id));
  })
);

topicsRouter.post(
  "/",
  wrap(async (req, res) => res.status(201).json(await svc.createTopic(parseBody(createSchema, req.body), req.user!.id)))
);

// /reorder must be registered before /:id.
topicsRouter.patch(
  "/reorder",
  wrap(async (req, res) => {
    await svc.reorderTopics(parseBody(reorderSchema, req.body).orderedIds, req.user!.id);
    res.status(204).end();
  })
);

topicsRouter.get("/:id", wrap(async (req, res) => res.json(await svc.getTopicDetail(parseId(req.params.id), req.user!.id))));

topicsRouter.patch(
  "/:id",
  wrap(async (req, res) => res.json(await svc.updateTopic(parseId(req.params.id), parseBody(updateSchema, req.body), req.user!.id)))
);

topicsRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    await svc.deleteTopic(parseId(req.params.id), req.user!.id);
    res.status(204).end();
  })
);

topicsRouter.post(
  "/:id/materials",
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Fayl yuklanmadi", "Файл не загружен");
    res.status(201).json(await svc.uploadMaterial(parseId(req.params.id), req.file, req.user!.id));
  })
);

// ---- Materials router (/api/v1/materials) ----

export const materialsRouter = Router();
materialsRouter.use(requireRoles("TEACHER"));

materialsRouter.get("/:id", wrap(async (req, res) => res.json(await svc.getMaterial(parseId(req.params.id), req.user!.id))));

materialsRouter.get(
  "/:id/text",
  wrap(async (req, res) => res.json(await svc.getMaterialText(parseId(req.params.id), req.user!.id)))
);

materialsRouter.post(
  "/:id/retry",
  wrap(async (req, res) => res.json(await svc.retryMaterial(parseId(req.params.id), req.user!.id)))
);

materialsRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    await svc.deleteMaterial(parseId(req.params.id), req.user!.id);
    res.status(204).end();
  })
);
