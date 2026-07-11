import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { generateStructured } from "../../ai/gemini";
import {
  caseResponseSchema,
  caseSchema,
  quizResponseSchema,
  quizGenSchema,
  type CaseJson,
  type DigestJson,
  type QuizGen,
  type Slide,
} from "../../ai/types";
import { quizSystemPrompt, quizUserContent } from "../../ai/prompts/quiz";
import { caseSystemPrompt, caseUserContent } from "../../ai/prompts/case";

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}

// ---------- Ownership ----------

async function topicForTeacher(topicId: number, teacherId: number) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { course: true, digest: true } });
  if (!topic) throw notFound("Mavzu");
  if (topic.course.teacherId !== teacherId) throw forbidden();
  return topic;
}

const contentInclude = {
  quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
  clinicalCase: true,
  presentation: true,
  approvedBy: true,
} satisfies Prisma.ContentItemInclude;

type ContentFull = Prisma.ContentItemGetPayload<{ include: typeof contentInclude }>;

async function contentForTeacher(contentId: number, teacherId: number): Promise<ContentFull> {
  const item = await prisma.contentItem.findUnique({
    where: { id: contentId },
    include: { ...contentInclude, topic: { include: { course: true } } },
  });
  if (!item) throw notFound("Kontent");
  if (item.topic.course.teacherId !== teacherId) throw forbidden();
  return item;
}

// ---------- Serialization ----------

function toContentOut(item: ContentFull) {
  return {
    id: item.id,
    topicId: item.topicId,
    kind: item.kind.toLowerCase(),
    language: item.language,
    status: item.status.toLowerCase(),
    version: item.version,
    editedByTeacher: item.editedByTeacher,
    approvedAt: item.approvedAt,
    approvedByName: item.approvedBy?.fullName ?? null,
    quiz: item.quiz
      ? {
          passThreshold: item.quiz.passThreshold,
          maxAttempts: item.quiz.maxAttempts,
          questions: item.quiz.questions.map((q) => ({
            id: q.id,
            text: q.text,
            options: q.optionsJson as string[],
            correctIndex: q.correctIndex,
            explanations: q.explanationJson as string[],
            difficulty: q.difficulty,
            sourceFragment: q.sourceFragment,
          })),
        }
      : null,
    clinicalCase: item.clinicalCase
      ? { caseJson: item.clinicalCase.caseJson as unknown as CaseJson, format: item.clinicalCase.format }
      : null,
    presentation: item.presentation
      ? {
          id: item.presentation.id,
          templateId: item.presentation.templateId,
          slides: (item.presentation.slidesJson as unknown as Slide[]).map((slide, si) => ({
            id: slide.id,
            layout: slide.layout,
            title: slide.title,
            bullets: slide.bullets,
            speakerNotes: slide.speakerNotes,
            imageSlots: slide.imageSlots.map((slot, sloti) => ({
              prompt: slot.prompt,
              status: slot.status,
              // Expose a media URL (not the internal storage path) only when ready.
              url: slot.status === "DONE" ? `/api/v1/presentations/${item.presentation!.id}/image/${si}/${sloti}` : null,
            })),
          })),
        }
      : null,
  };
}

async function approvedDigest(topicId: number, teacherId: number): Promise<DigestJson> {
  const topic = await topicForTeacher(topicId, teacherId);
  if (!topic.digest || !topic.digest.approvedByTeacher) {
    throw new ApiError(403, "digest_not_approved", "Avval konspektni tasdiqlang", "Сначала утвердите конспект");
  }
  return topic.digest.digestJson as unknown as DigestJson;
}

// ---------- Generate: quiz ----------

export async function generateQuiz(
  topicId: number,
  teacherId: number,
  opts: { language: "uz" | "ru"; questionCount: number; difficulty: string }
) {
  const digest = await approvedDigest(topicId, teacherId);

  const gen = await generateStructured<QuizGen>({
    systemInstruction: quizSystemPrompt(opts.language, opts.questionCount, opts.difficulty),
    userContent: quizUserContent(digest),
    responseSchema: quizResponseSchema,
    kind: "quiz",
    topicId,
  });
  const parsed = quizGenSchema.safeParse(gen);
  const questions = (parsed.success ? parsed.data : gen).questions;

  const existing = await prisma.contentItem.findUnique({ where: { topicId_kind: { topicId, kind: "QUIZ" } } });

  const item = await prisma.$transaction(async (tx) => {
    const content = existing
      ? await tx.contentItem.update({
          where: { id: existing.id },
          data: { language: opts.language, status: "DRAFT", editedByTeacher: false, version: { increment: 1 } },
        })
      : await tx.contentItem.create({
          data: { topicId, kind: "QUIZ", language: opts.language, status: "DRAFT" },
        });

    const quiz = await tx.quiz.upsert({
      where: { contentItemId: content.id },
      create: { contentItemId: content.id },
      update: {},
    });
    await tx.question.deleteMany({ where: { quizId: quiz.id } });
    await tx.question.createMany({
      data: questions.map((q, i) => ({
        quizId: quiz.id,
        text: q.text,
        optionsJson: q.options,
        correctIndex: Math.max(0, Math.min(q.correctIndex, q.options.length - 1)),
        explanationJson: q.explanations,
        difficulty: q.difficulty,
        sourceFragment: q.sourceFragment || null,
        orderIndex: i,
      })),
    });
    return content;
  });

  return toContentOut(await contentForTeacher(item.id, teacherId));
}

// ---------- Generate: case ----------

export async function generateCase(
  topicId: number,
  teacherId: number,
  opts: { language: "uz" | "ru"; format: "SHORT" | "EXTENDED" }
) {
  const digest = await approvedDigest(topicId, teacherId);

  const gen = await generateStructured<CaseJson>({
    systemInstruction: caseSystemPrompt(opts.language, opts.format),
    userContent: caseUserContent(digest),
    responseSchema: caseResponseSchema,
    kind: "case",
    topicId,
  });
  const parsed = caseSchema.safeParse(gen);
  const caseJson = parsed.success ? parsed.data : gen;

  const existing = await prisma.contentItem.findUnique({ where: { topicId_kind: { topicId, kind: "CASE" } } });

  const item = await prisma.$transaction(async (tx) => {
    const content = existing
      ? await tx.contentItem.update({
          where: { id: existing.id },
          data: { language: opts.language, status: "DRAFT", editedByTeacher: false, version: { increment: 1 } },
        })
      : await tx.contentItem.create({ data: { topicId, kind: "CASE", language: opts.language, status: "DRAFT" } });

    await tx.clinicalCase.upsert({
      where: { contentItemId: content.id },
      create: { contentItemId: content.id, caseJson: caseJson as object, format: opts.format },
      update: { caseJson: caseJson as object, format: opts.format },
    });
    return content;
  });

  return toContentOut(await contentForTeacher(item.id, teacherId));
}

// ---------- Get / Update / Approve ----------

export async function getContent(contentId: number, teacherId: number) {
  return toContentOut(await contentForTeacher(contentId, teacherId));
}

interface QuizEdit {
  passThreshold?: number;
  questions: {
    text: string;
    options: string[];
    correctIndex: number;
    explanations: string[];
    difficulty: "RECALL" | "UNDERSTAND" | "APPLY";
    sourceFragment?: string | null;
  }[];
}

export async function updateContent(contentId: number, teacherId: number, body: unknown) {
  const item = await contentForTeacher(contentId, teacherId);

  if (item.kind === "QUIZ") {
    const b = body as QuizEdit;
    if (!b || !Array.isArray(b.questions)) throw badRequest("Savollar notoʻgʻri", "Неверные вопросы");
    const quiz = item.quiz!;
    await prisma.$transaction(async (tx) => {
      if (typeof b.passThreshold === "number") {
        await tx.quiz.update({ where: { id: quiz.id }, data: { passThreshold: b.passThreshold } });
      }
      await tx.question.deleteMany({ where: { quizId: quiz.id } });
      await tx.question.createMany({
        data: b.questions.map((q, i) => ({
          quizId: quiz.id,
          text: q.text,
          optionsJson: q.options,
          correctIndex: Math.max(0, Math.min(q.correctIndex, q.options.length - 1)),
          explanationJson: q.explanations,
          difficulty: q.difficulty,
          sourceFragment: q.sourceFragment || null,
          orderIndex: i,
        })),
      });
      await tx.contentItem.update({ where: { id: contentId }, data: { editedByTeacher: true } });
    });
  } else if (item.kind === "CASE") {
    const parsed = caseSchema.safeParse(body);
    if (!parsed.success) throw badRequest("Keys tuzilishi notoʻgʻri", "Неверная структура кейса");
    await prisma.clinicalCase.update({
      where: { contentItemId: contentId },
      data: { caseJson: parsed.data as object },
    });
    await prisma.contentItem.update({ where: { id: contentId }, data: { editedByTeacher: true } });
  } else if (item.kind === "PRESENTATION") {
    const b = body as { slides: { id: string; layout: Slide["layout"]; title: string; bullets: string[]; speakerNotes: string }[] };
    if (!b || !Array.isArray(b.slides)) throw badRequest("Slaydlar notoʻgʻri", "Неверные слайды");
    const pres = item.presentation!;
    const stored = pres.slidesJson as unknown as Slide[];
    const byId = new Map(stored.map((s) => [s.id, s]));
    // Only text/layout comes from the client; image slots stay server-managed
    // (matched by stable slide id, so deletion/reorder can't corrupt them).
    const merged: Slide[] = b.slides.map((s) => ({
      id: s.id,
      layout: s.layout,
      title: s.title,
      bullets: s.bullets,
      speakerNotes: s.speakerNotes,
      imageSlots: byId.get(s.id)?.imageSlots ?? [],
    }));
    await prisma.presentation.update({ where: { contentItemId: contentId }, data: { slidesJson: merged as object } });
    await prisma.contentItem.update({ where: { id: contentId }, data: { editedByTeacher: true } });
  } else {
    throw badRequest("Bu kontent turi hali tahrirlanmaydi", "Этот тип контента пока не редактируется");
  }

  return toContentOut(await contentForTeacher(contentId, teacherId));
}

export async function approveContent(contentId: number, teacherId: number) {
  const item = await contentForTeacher(contentId, teacherId);
  await prisma.contentItem.update({
    where: { id: item.id },
    data: { status: "APPROVED", approvedById: teacherId, approvedAt: new Date() },
  });
  return toContentOut(await contentForTeacher(contentId, teacherId));
}

// ---------- Topic detail summary ----------

export async function topicContentSummary(topicId: number) {
  const items = await prisma.contentItem.findMany({ where: { topicId } });
  return items.map((i) => ({
    id: i.id,
    kind: i.kind.toLowerCase(),
    status: i.status.toLowerCase(),
    editedByTeacher: i.editedByTeacher,
  }));
}
