import { Router, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";
import * as lesson from "./lesson";
import * as profile from "./profile";
import { computeStudentAutoTasks, listAssigned } from "../tasks/service";
import { studentSearch } from "../search/service";

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

function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest("Maʼlumotlar notoʻgʻri", "Неверные данные");
  return parsed.data;
}

// ---------- Dashboard + path (Module 11) ----------

meRouter.get("/dashboard", wrap(async (req, res) => res.json(await svc.getDashboard(req.user!.id))));
meRouter.get("/search", wrap(async (req, res) => res.json(await studentSearch(req.user!.id, typeof req.query.q === "string" ? req.query.q : ""))));
meRouter.get("/tasks", wrap(async (req, res) => {
  // ?includeDone=1 — vazifalar sahifasidagi "Bajarilganlar" bo'limi uchun.
  const includeDone = req.query.includeDone === "1" || req.query.includeDone === "true";
  const [auto, assigned] = await Promise.all([
    computeStudentAutoTasks(req.user!.id),
    listAssigned(req.user!.id, includeDone),
  ]);
  res.json({ auto, assigned });
}));
meRouter.get("/courses", wrap(async (req, res) => res.json(await svc.listMyCourses(req.user!.id))));
meRouter.get("/courses/:id", wrap(async (req, res) => res.json(await svc.getMyCourse(req.user!.id, parseId(req.params.id)))));

// ---------- Attendance + profile (Module 16) ----------

meRouter.get(
  "/attendance",
  wrap(async (req, res) =>
    res.json(
      await profile.getMyAttendance(req.user!.id, {
        courseId: req.query.courseId ? Number(req.query.courseId) : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
      })
    )
  )
);

meRouter.get("/profile", wrap(async (req, res) => res.json(await profile.getMyProfile(req.user!.id))));
meRouter.get(
  "/schedule",
  wrap(async (req, res) =>
    res.json(
      await profile.getMySchedule(req.user!.id, {
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
      })
    )
  )
);
meRouter.get("/grades", wrap(async (req, res) => res.json(await profile.getMyGrades(req.user!.id))));
meRouter.get("/activity", wrap(async (req, res) => res.json(await profile.getMyActivity(req.user!.id))));
meRouter.get("/rank", wrap(async (req, res) => res.json(await profile.getMyRank(req.user!.id))));
meRouter.put("/locale", wrap(async (req, res) => res.json(await profile.setLocale(req.user!.id, req.body?.locale))));
meRouter.post("/change-password", wrap(async (req, res) => res.json(await profile.changePassword(req.user!.id, req.body?.oldPassword, req.body?.newPassword))));

// ---------- Lesson (Module 12) ----------

meRouter.get("/topics/:id", wrap(async (req, res) => res.json(await lesson.getTopicLesson(req.user!.id, parseId(req.params.id)))));

const videoProgressSchema = z.object({ watchedPct: z.number().min(0).max(100), positionSec: z.number().min(0).default(0) });
meRouter.post(
  "/topics/:id/video-progress",
  wrap(async (req, res) => {
    const b = parseBody(videoProgressSchema, req.body);
    res.json(await lesson.setVideoProgress(req.user!.id, parseId(req.params.id), b.watchedPct, b.positionSec));
  })
);

meRouter.post("/topics/:id/slides-viewed", wrap(async (req, res) => res.json(await lesson.setSlidesViewed(req.user!.id, parseId(req.params.id)))));

// ---------- Quiz attempts ----------

meRouter.post("/quizzes/:id/attempts", wrap(async (req, res) => res.json(await lesson.startQuizAttempt(req.user!.id, parseId(req.params.id)))));

const answersSchema = z.object({ answers: z.record(z.string(), z.number().int().min(0)) });
meRouter.put(
  "/attempts/:id/answers",
  wrap(async (req, res) => {
    const b = parseBody(answersSchema, req.body);
    res.json(await lesson.saveQuizAnswers(req.user!.id, parseId(req.params.id), b.answers));
  })
);

meRouter.post("/attempts/:id/finish", wrap(async (req, res) => res.json(await lesson.finishQuizAttempt(req.user!.id, parseId(req.params.id)))));
meRouter.get("/attempts/:id", wrap(async (req, res) => res.json(await lesson.getQuizAttempt(req.user!.id, parseId(req.params.id)))));

// ---------- Case attempts ----------

const caseAnswersSchema = z.object({ answers: z.array(z.string()) });
meRouter.post(
  "/cases/:id/attempts",
  wrap(async (req, res) => {
    const b = parseBody(caseAnswersSchema, req.body);
    res.json(await lesson.submitCase(req.user!.id, parseId(req.params.id), b.answers));
  })
);

meRouter.get("/case-attempts/:id", wrap(async (req, res) => res.json(await lesson.getCaseAttempt(req.user!.id, parseId(req.params.id)))));

// ---------- Media ----------

meRouter.get(
  "/videos/:id/mp4",
  wrap(async (req, res) => {
    const buf = await lesson.studentVideoMedia(req.user!.id, parseId(req.params.id), "mp4");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.send(buf);
  })
);

meRouter.get(
  "/videos/:id/srt",
  wrap(async (req, res) => {
    const buf = await lesson.studentVideoMedia(req.user!.id, parseId(req.params.id), "srt");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(buf);
  })
);

meRouter.get(
  "/presentations/:id/image/:slideIndex/:slotIndex",
  wrap(async (req, res) => {
    const buf = await lesson.studentSlotImage(req.user!.id, parseId(req.params.id), Number(req.params.slideIndex), Number(req.params.slotIndex));
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(buf);
  })
);

meRouter.get(
  "/presentations/:id/pdf",
  wrap(async (req, res) => {
    const buf = await lesson.studentPresentationPdf(req.user!.id, parseId(req.params.id));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="presentation-${req.params.id}.pdf"`);
    res.send(buf);
  })
);

const MATERIAL_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
};

meRouter.get(
  "/materials/:id/file",
  wrap(async (req, res) => {
    const { buf, fileName, fileType } = await lesson.studentMaterialFile(req.user!.id, parseId(req.params.id));
    const inline = fileType === "pdf" || fileType === "txt" || fileType === "md";
    res.setHeader("Content-Type", MATERIAL_MIME[fileType] ?? "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buf);
  })
);
