import { Router, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";
import * as lesson from "./lesson";
import * as profile from "./profile";
import * as chat from "./chat";
import * as flashcards from "./flashcards";
import * as patient from "./patient";
import * as practice from "./practice";
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

// Konspekt bo'limi o'qildi (1a — "O'qildi n/N").
meRouter.post(
  "/topics/:id/sections/:index/read",
  wrap(async (req, res) =>
    res.json(await lesson.markSectionRead(req.user!.id, parseId(req.params.id), Number(req.params.index)))
  )
);

// ---------- Fleshkartalar (takrorlash) ----------

meRouter.get(
  "/topics/:id/flashcards",
  wrap(async (req, res) => res.json(await flashcards.getFlashcards(req.user!.id, parseId(req.params.id))))
);

const reviewSchema = z.object({ cardKey: z.string().min(1).max(64), known: z.boolean() });
meRouter.post(
  "/topics/:id/flashcards/review",
  wrap(async (req, res) => {
    const b = parseBody(reviewSchema, req.body);
    res.json(await flashcards.reviewFlashcard(req.user!.id, parseId(req.params.id), b.cardKey, b.known));
  })
);

meRouter.post(
  "/topics/:id/flashcards/reset",
  wrap(async (req, res) => res.json(await flashcards.resetFlashcards(req.user!.id, parseId(req.params.id))))
);

// Interval takrorlash — bugun takrorlash kerak bo'lgan kartalar (Dashboard).
meRouter.get("/review/due", wrap(async (req, res) => res.json(await flashcards.getReviewDue(req.user!.id))));
// Kross-mavzu takrorlash sessiyasi + statistika (O'zlashtirish → Takrorlash tabi).
meRouter.get(
  "/review/session",
  wrap(async (req, res) => {
    const topicId = req.query.topicId ? Number(req.query.topicId) : undefined;
    res.json(await flashcards.getReviewSession(req.user!.id, topicId));
  })
);
meRouter.get("/review/stats", wrap(async (req, res) => res.json(await flashcards.getReviewStats(req.user!.id))));

// ---------- Qo'shimcha mashg'ulotlar (Modul 27) ----------
// ⚠️ /practice/patients marshuti /practice/:topicId dan OLDIN turishi shart.
meRouter.get("/practice", wrap(async (req, res) => res.json(await practice.getPracticeOverview(req.user!.id))));
meRouter.get("/practice/patients", wrap(async (req, res) => res.json(await practice.getPatientPractice(req.user!.id))));
meRouter.get(
  "/practice/:topicId",
  wrap(async (req, res) => res.json(await practice.getPracticeSet(req.user!.id, parseId(req.params.topicId))))
);

// ---------- Virtual bemor roleplay (Modul 26) ----------

meRouter.get("/topics/:id/patient", wrap(async (req, res) => res.json(await patient.getPatient(req.user!.id, parseId(req.params.id)))));

const patientMsgSchema = z.object({ text: z.string().min(1).max(2000) });
meRouter.post(
  "/topics/:id/patient",
  wrap(async (req, res) => {
    const b = parseBody(patientMsgSchema, req.body);
    res.json(await patient.sendPatient(req.user!.id, parseId(req.params.id), b.text));
  })
);

const patientFinishSchema = z.object({ diagnosis: z.string().max(2000).default("") });
meRouter.post(
  "/topics/:id/patient/finish",
  wrap(async (req, res) => {
    const b = parseBody(patientFinishSchema, req.body);
    res.json(await patient.finishPatient(req.user!.id, parseId(req.params.id), b.diagnosis));
  })
);

meRouter.post("/topics/:id/patient/reset", wrap(async (req, res) => res.json(await patient.resetPatient(req.user!.id, parseId(req.params.id)))));

// ---------- AI-tutor chat (layout v2, 2C) ----------

meRouter.get("/topics/:id/chat", wrap(async (req, res) => res.json(await chat.getChat(req.user!.id, parseId(req.params.id)))));

const chatSchema = z.object({ text: z.string().min(1).max(2000) });
meRouter.post(
  "/topics/:id/chat",
  wrap(async (req, res) => {
    const b = parseBody(chatSchema, req.body);
    res.json(await chat.sendChat(req.user!.id, parseId(req.params.id), b.text));
  })
);

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

// Savolni belgilash / belgini olib tashlash (1c — "Belgilash").
const flagSchema = z.object({ questionId: z.number().int().positive(), flagged: z.boolean() });
meRouter.post(
  "/attempts/:id/flag",
  wrap(async (req, res) => {
    const b = parseBody(flagSchema, req.body);
    res.json(await lesson.setQuizFlag(req.user!.id, parseId(req.params.id), b.questionId, b.flagged));
  })
);
meRouter.get("/attempts/:id", wrap(async (req, res) => res.json(await lesson.getQuizAttempt(req.user!.id, parseId(req.params.id)))));

// ---------- Case attempts ----------

const caseAnswersSchema = z.object({
  answers: z.array(z.string()),
  /** v2 — qadam qarorlari: { "0": 1, "1": 0, ... } */
  steps: z.record(z.string(), z.number().int().min(0)).optional(),
});
meRouter.post(
  "/cases/:id/attempts",
  wrap(async (req, res) => {
    const b = parseBody(caseAnswersSchema, req.body);
    res.json(await lesson.submitCase(req.user!.id, parseId(req.params.id), b.answers, b.steps));
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

// 1C: audio-konspekt (o'qish ustuni pleyeri)
meRouter.get(
  "/topics/:id/digest-audio",
  wrap(async (req, res) => {
    const buf = await lesson.studentDigestAudio(req.user!.id, parseId(req.params.id));
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Accept-Ranges", "bytes");
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

// Ajratilgan matn — "Material matni" mini-konspekt bloki.
meRouter.get(
  "/materials/:id/text",
  wrap(async (req, res) => res.json(await lesson.studentMaterialText(req.user!.id, parseId(req.params.id))))
);

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
