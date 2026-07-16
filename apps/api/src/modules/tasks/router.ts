import { Router, type RequestHandler } from "express";
import { notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as tasks from "./service";

export const tasksRouter = Router();
// Any authenticated user; the service enforces per-action direction/ownership.
tasksRouter.use(requireRoles("SUPERADMIN", "FACULTY_ADMIN", "DEPT_ADMIN", "TEACHER", "STUDENT"));

const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

// Tasks I created (with completion) — for admins/teachers.
tasksRouter.get("/created", wrap(async (req, res) => res.json(await tasks.listCreated(req.user!.id))));

// Create an assignment (ADMIN → teacher/department, TEACHER → student/group).
tasksRouter.post("/", wrap(async (req, res) => res.json(await tasks.createTask({ id: req.user!.id, role: req.user!.role }, req.body ?? {}))));

// Assignee marks done/undone.
tasksRouter.patch(
  "/:id",
  wrap(async (req, res) => res.json(await tasks.setTaskDone(parseId(req.params.id), req.user!.id, req.body?.done !== false)))
);

// Creator deletes (whole batch if a group/department assignment).
tasksRouter.delete("/:id", wrap(async (req, res) => res.json(await tasks.deleteTask(parseId(req.params.id), req.user!.id))));
