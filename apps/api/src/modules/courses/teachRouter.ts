import { Router, type RequestHandler } from "express";
import { notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";

export const teachCoursesRouter = Router();
teachCoursesRouter.use(requireRoles("TEACHER"));

const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

// Own courses only.
teachCoursesRouter.get(
  "/courses",
  wrap(async (req, res) => res.json(await svc.listTeacherCourses(req.user!.id)))
);

// Lightweight metadata for the course shell (ownership enforced -> 403).
teachCoursesRouter.get(
  "/courses/:id",
  wrap(async (req, res) => res.json(await svc.getTeacherCourseMeta(parseId(req.params.id), req.user!.id)))
);

// Course-level default unlock rule (Settings tab).
teachCoursesRouter.put(
  "/courses/:id/settings",
  wrap(async (req, res) =>
    res.json(await svc.updateCourseSettings(parseId(req.params.id), req.user!.id, req.body?.defaultUnlockRuleJson))
  )
);
