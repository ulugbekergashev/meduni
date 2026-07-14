import { Router, type RequestHandler } from "express";
import { notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";
import * as progress from "./progress";
import * as review from "./review";
import * as attendance from "./attendance";
import { computeTeacherAutoTasks } from "../tasks/service";

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

// My Tasks hub — auto-derived tasks (assigned tasks added in Phase 2).
teachCoursesRouter.get(
  "/tasks",
  wrap(async (req, res) => res.json({ auto: await computeTeacherAutoTasks(req.user!.id), assigned: [] }))
);

// Own courses only.
teachCoursesRouter.get(
  "/courses",
  wrap(async (req, res) => res.json(await svc.listTeacherCourses(req.user!.id)))
);

// Groups the teacher teaches (with students).
teachCoursesRouter.get(
  "/groups",
  wrap(async (req, res) => res.json(await svc.listTeacherGroups(req.user!.id)))
);

// One group's profile (info + students + this teacher's courses).
teachCoursesRouter.get(
  "/groups/:id",
  wrap(async (req, res) => res.json(await svc.getTeacherGroup(parseId(req.params.id), req.user!.id)))
);

// Groups a course is taught in, with per-group stats (course profile tab).
teachCoursesRouter.get(
  "/courses/:id/groups",
  wrap(async (req, res) => res.json(await progress.getCourseGroupsStats(parseId(req.params.id), req.user!.id)))
);

// One student's full picture (attendance + progress + tests + cases).
teachCoursesRouter.get(
  "/students/:id",
  wrap(async (req, res) => res.json(await progress.getStudentDetail(req.user!.id, parseId(req.params.id))))
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

// ---------- Attendance (sessions + marking + report) ----------

const qs = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

teachCoursesRouter.get(
  "/courses/:id/sessions",
  wrap(async (req, res) =>
    res.json(await attendance.listSessions(parseId(req.params.id), req.user!.id, { from: qs(req.query.from), to: qs(req.query.to), search: qs(req.query.search) }))
  )
);

teachCoursesRouter.post(
  "/courses/:id/sessions",
  wrap(async (req, res) => res.json(await attendance.createSession(parseId(req.params.id), req.user!.id, req.body ?? {})))
);

// Report BEFORE the generic /sessions/:id routes are fine (different prefix); also
// place .xlsx before the plain report so the literal path matches first.
const qnum = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

teachCoursesRouter.get(
  "/courses/:id/attendance-report.xlsx",
  wrap(async (req, res) => {
    const view = req.query.view === "list" ? "list" : "matrix";
    const buf = await attendance.exportAttendance(parseId(req.params.id), req.user!.id, view, { from: qs(req.query.from), to: qs(req.query.to), groupId: qnum(req.query.groupId) });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${req.params.id}-${view}.xlsx"`);
    res.send(buf);
  })
);

teachCoursesRouter.get(
  "/courses/:id/attendance-report",
  wrap(async (req, res) =>
    res.json(
      await attendance.attendanceReport(parseId(req.params.id), req.user!.id, { from: qs(req.query.from), to: qs(req.query.to), search: qs(req.query.search), groupId: qnum(req.query.groupId) })
    )
  )
);

teachCoursesRouter.get("/sessions/:id/roster", wrap(async (req, res) => res.json(await attendance.getRoster(parseId(req.params.id), req.user!.id, qnum(req.query.groupId)))));

teachCoursesRouter.post(
  "/sessions/:id/attendance",
  wrap(async (req, res) => res.json(await attendance.markAttendance(parseId(req.params.id), req.user!.id, req.body?.marks ?? [])))
);

teachCoursesRouter.patch(
  "/sessions/:id",
  wrap(async (req, res) => res.json(await attendance.updateSession(parseId(req.params.id), req.user!.id, req.body ?? {})))
);

teachCoursesRouter.delete("/sessions/:id", wrap(async (req, res) => res.json(await attendance.deleteSession(parseId(req.params.id), req.user!.id))));

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

// Syllabus (o'quv rejasi).
teachCoursesRouter.get(
  "/courses/:id/syllabus",
  wrap(async (req, res) => res.json(await svc.getSyllabus(parseId(req.params.id), req.user!.id)))
);
teachCoursesRouter.put(
  "/courses/:id/syllabus",
  wrap(async (req, res) => res.json(await svc.saveSyllabus(parseId(req.params.id), req.user!.id, req.body ?? {})))
);

// Course-level default unlock rule (Settings tab).
teachCoursesRouter.put(
  "/courses/:id/settings",
  wrap(async (req, res) =>
    res.json(await svc.updateCourseSettings(parseId(req.params.id), req.user!.id, req.body?.defaultUnlockRuleJson))
  )
);
