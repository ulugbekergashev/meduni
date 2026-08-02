import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";
import * as podcast from "../content/podcast";

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

// Faza 3: mavzu fanga tegishli — kurs YOKI fan konteksti orqali yaratiladi.
const createSchema = z.object({
  courseId: z.number().int().positive(),
  title: z.string().trim().min(1),
});
const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});
const reorderSchema = z.object({ orderedIds: z.array(z.number().int().positive()) });

// List by course OR subject: GET /api/v1/topics?courseId= | ?subjectId=
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

topicsRouter.put(
  "/:id/unlock-rule",
  wrap(async (req, res) => res.json(await svc.setTopicUnlockRule(parseId(req.params.id), req.body?.unlockRuleJson, req.user!.id)))
);

topicsRouter.post(
  "/:id/materials",
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Fayl yuklanmadi", "Файл не загружен");
    res.status(201).json(await svc.uploadMaterial(parseId(req.params.id), req.file, req.user!.id));
  })
);

// Digest (AI konspekt, first control point)
topicsRouter.post(
  "/:id/digest/generate",
  wrap(async (req, res) => res.json(await svc.generateDigest(parseId(req.params.id), req.user!.id)))
);

topicsRouter.get(
  "/:id/digest",
  wrap(async (req, res) => res.json(await svc.getDigest(parseId(req.params.id), req.user!.id)))
);

topicsRouter.put(
  "/:id/digest",
  wrap(async (req, res) => res.json(await svc.updateDigest(parseId(req.params.id), req.user!.id, req.body)))
);

topicsRouter.post(
  "/:id/digest/approve",
  wrap(async (req, res) => res.json(await svc.approveDigest(parseId(req.params.id), req.user!.id)))
);

// 1C: audio-konspekt (o'qituvchi tugmasi — joriy konspektni ovozga aylantiradi)
topicsRouter.post(
  "/:id/digest/audio",
  wrap(async (req, res) => res.json(await svc.generateDigestAudio(parseId(req.params.id), req.user!.id)))
);

// ---- Audio-podkast (~20 daqiqa, ikki ovozli suhbat) ----
topicsRouter.get(
  "/:id/podcast",
  wrap(async (req, res) => res.json(await podcast.getPodcast(parseId(req.params.id), req.user!.id)))
);

topicsRouter.post(
  "/:id/podcast/generate",
  wrap(async (req, res) =>
    res.json(
      await podcast.generatePodcast(parseId(req.params.id), req.user!.id, {
        rebuild: req.body?.rebuild === true,
        language: req.body?.language === "ru" ? "ru" : req.body?.language === "uz" ? "uz" : undefined,
      })
    )
  )
);

topicsRouter.get(
  "/:id/podcast/audio",
  wrap(async (req, res) => {
    const buf = await podcast.getPodcastAudio(parseId(req.params.id), req.user!.id);
    res.setHeader("Content-Type", "audio/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.send(buf);
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
