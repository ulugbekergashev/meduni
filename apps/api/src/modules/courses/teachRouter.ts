import { Router, type RequestHandler } from "express";
import { notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";
import * as progress from "./progress";
import * as review from "./review";

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

// Teacher dashboard (courses + task counts).
teachCoursesRouter.get(
  "/dashboard",
  wrap(async (req, res) => res.json(await progress.getTeacherDashboard(req.user!.id)))
);

// Own courses only.
teachCoursesRouter.get(
  "/courses",
  wrap(async (req, res) => res.json(await svc.listTeacherCourses(req.user!.id)))
);

// Progress matrix (heatmap + list).
teachCoursesRouter.get(
  "/courses/:id/progress",
  wrap(async (req, res) => res.json(await progress.getCourseProgress(parseId(req.params.id), req.user!.id)))
);

// ---------- Clinical-case review queue ----------

teachCoursesRouter.get(
  "/cases/review",
  wrap(async (req, res) =>
    res.json(
      await review.listReviewQueue(req.user!.id, {
        courseId: req.query.courseId ? Number(req.query.courseId) : undefined,
        topicId: req.query.topicId ? Number(req.query.topicId) : undefined,
        status: (req.query.status as "PENDING" | "REVIEWED" | "all") || undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        sort: req.query.sort === "newest" ? "newest" : "oldest",
      })
    )
  )
);

teachCoursesRouter.get("/cases/filters", wrap(async (req, res) => res.json(await review.reviewFilters(req.user!.id))));

teachCoursesRouter.get(
  "/cases/:id",
  wrap(async (req, res) => res.json(await review.getCaseAttemptForReview(req.user!.id, parseId(req.params.id))))
);

teachCoursesRouter.post(
  "/cases/:id/review",
  wrap(async (req, res) => {
    const score = Number(req.body?.score);
    const feedback = typeof req.body?.feedback === "string" ? req.body.feedback : "";
    res.json(await review.reviewCase(req.user!.id, parseId(req.params.id), score, feedback));
  })
);

// Manual unlock override (audited).
teachCoursesRouter.post(
  "/courses/:id/unlock",
  wrap(async (req, res) => {
    const studentId = Number(req.body?.studentId);
    const topicId = Number(req.body?.topicId);
    if (!Number.isInteger(studentId) || !Number.isInteger(topicId)) throw notFound();
    res.json(await progress.manualUnlock(parseId(req.params.id), req.user!.id, studentId, topicId));
  })
);

// Excel export (?view=heatmap|list).
teachCoursesRouter.get(
  "/courses/:id/progress/export",
  wrap(async (req, res) => {
    const view = req.query.view === "list" ? "list" : "heatmap";
    const buf = await progress.exportProgress(parseId(req.params.id), req.user!.id, view);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="progress-${req.params.id}-${view}.xlsx"`);
    res.send(buf);
  })
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
