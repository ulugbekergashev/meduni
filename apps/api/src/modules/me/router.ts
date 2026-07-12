import { Router, type RequestHandler } from "express";
import { notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";

export const meRouter = Router();
meRouter.use(requireRoles("STUDENT"));

const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

meRouter.get(
  "/dashboard",
  wrap(async (req, res) => res.json(await svc.getDashboard(req.user!.id)))
);

meRouter.get(
  "/courses",
  wrap(async (req, res) => res.json(await svc.listMyCourses(req.user!.id)))
);

meRouter.get(
  "/courses/:id",
  wrap(async (req, res) => res.json(await svc.getMyCourse(req.user!.id, parseId(req.params.id))))
);
