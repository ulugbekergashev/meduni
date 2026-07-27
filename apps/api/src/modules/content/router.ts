import { Router, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";
import * as pres from "./presentation";
import * as video from "./video";

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

const genQuizSchema = z.object({
  language: z.enum(["uz", "ru"]),
  questionCount: z.number().int().min(3).max(30),
  difficulty: z.enum(["balanced", "easy", "hard"]).default("balanced"),
});
const genCaseSchema = z.object({
  language: z.enum(["uz", "ru"]),
  format: z.enum(["SHORT", "EXTENDED"]).default("SHORT"),
});
const genPresSchema = z.object({
  language: z.enum(["uz", "ru"]),
});
const genVideoSchema = z.object({
  language: z.enum(["uz", "ru"]),
  voice: z.enum(["male", "female"]).default("female"),
});

// Generation lives on the topic (topicsRouter mounts this at /api/v1/topics).
export const generateRouter = Router();
generateRouter.use(requireRoles("TEACHER"));

generateRouter.post(
  "/:id/generate/quiz",
  wrap(async (req, res) =>
    res.json(await svc.generateQuiz(parseId(req.params.id), req.user!.id, parseBody(genQuizSchema, req.body)))
  )
);

generateRouter.post(
  "/:id/generate/case",
  wrap(async (req, res) =>
    res.json(await svc.generateCase(parseId(req.params.id), req.user!.id, parseBody(genCaseSchema, req.body)))
  )
);

generateRouter.post(
  "/:id/generate/presentation",
  wrap(async (req, res) => {
    const contentId = await pres.generatePresentation(parseId(req.params.id), req.user!.id, parseBody(genPresSchema, req.body));
    res.json(await svc.getContent(contentId, req.user!.id));
  })
);

generateRouter.post(
  "/:id/generate/video",
  wrap(async (req, res) => {
    const contentId = await video.generateVideo(parseId(req.params.id), req.user!.id, parseBody(genVideoSchema, req.body));
    res.json(await svc.getContent(contentId, req.user!.id));
  })
);

// Content read/edit/approve at /api/v1/content.
export const contentRouter = Router();
contentRouter.use(requireRoles("TEACHER"));

contentRouter.get("/:id", wrap(async (req, res) => res.json(await svc.getContent(parseId(req.params.id), req.user!.id))));

contentRouter.put(
  "/:id",
  wrap(async (req, res) => res.json(await svc.updateContent(parseId(req.params.id), req.user!.id, req.body)))
);

contentRouter.post(
  "/:id/approve",
  wrap(async (req, res) => res.json(await svc.approveContent(parseId(req.params.id), req.user!.id)))
);

contentRouter.post(
  "/:id/publish",
  wrap(async (req, res) => res.json(await svc.publishContent(parseId(req.params.id), req.user!.id)))
);

// Presentation images, media, and exports at /api/v1/presentations.
export const presentationsRouter = Router();
presentationsRouter.use(requireRoles("TEACHER"));

presentationsRouter.post(
  "/:id/generate-images",
  wrap(async (req, res) => {
    // 3A: ixtiyoriy slideIds — faqat tanlangan slaydlarga rasm (bo'sh = hammasi).
    const raw = (req.body as { slideIds?: unknown })?.slideIds;
    const slideIds = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : undefined;
    await pres.generateAllImages(parseId(req.params.id), req.user!.id, slideIds);
    res.json({ ok: true });
  })
);

presentationsRouter.post(
  "/:id/regenerate-image/:slideIndex/:slotIndex",
  wrap(async (req, res) => {
    await pres.regenerateOneImage(
      parseId(req.params.id),
      req.user!.id,
      Number(req.params.slideIndex),
      Number(req.params.slotIndex)
    );
    res.json({ ok: true });
  })
);

presentationsRouter.get(
  "/:id/image/:slideIndex/:slotIndex",
  wrap(async (req, res) => {
    const buf = await pres.getSlotImage(
      parseId(req.params.id),
      req.user!.id,
      Number(req.params.slideIndex),
      Number(req.params.slotIndex)
    );
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(buf);
  })
);

presentationsRouter.get(
  "/:id/pptx",
  wrap(async (req, res) => {
    const buf = await pres.exportPptx(parseId(req.params.id), req.user!.id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="presentation-${req.params.id}.pptx"`);
    res.send(buf);
  })
);

presentationsRouter.get(
  "/:id/pdf",
  wrap(async (req, res) => {
    const buf = await pres.exportPdf(parseId(req.params.id), req.user!.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="presentation-${req.params.id}.pdf"`);
    res.send(buf);
  })
);

// Video rebuild + media at /api/v1/videos.
export const videosRouter = Router();
videosRouter.use(requireRoles("TEACHER"));

videosRouter.post(
  "/:id/rebuild",
  wrap(async (req, res) => {
    await video.rebuildVideo(parseId(req.params.id), req.user!.id);
    res.json({ ok: true });
  })
);

videosRouter.get(
  "/:id/mp4",
  wrap(async (req, res) => {
    const buf = await video.getVideoMedia(parseId(req.params.id), req.user!.id, "mp4");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.send(buf);
  })
);

videosRouter.get(
  "/:id/srt",
  wrap(async (req, res) => {
    const buf = await video.getVideoMedia(parseId(req.params.id), req.user!.id, "srt");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(buf);
  })
);
