import { Router, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";

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
