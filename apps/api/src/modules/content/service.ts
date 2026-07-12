import { Prisma, prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { readText } from "../../lib/storage";
import { generateStructured } from "../../ai/gemini";
import { assertQuota } from "../../ai/quota";
import { departmentForTopic, getGlossaryForDepartment, glossaryBlock } from "../../ai/glossary";
import { factcheckSystemPrompt, factcheckUserContent } from "../../ai/prompts/factcheck";
import { factcheckGenSchema, factcheckResponseSchema, type FactcheckFlag, type FactcheckGen } from "../../ai/types";
import {
  caseResponseSchema,
  caseSchema,
  quizResponseSchema,
  quizGenSchema,
  type CaseJson,
  type DigestJson,
  type QuizGen,
  type Slide,
  type ScriptSegment,
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
  video: true,
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
    reviewOpened: item.reviewOpenedAt !== null,
    factcheckStatus: item.factcheckStatus.toLowerCase(),
    factcheckFlags: (item.factcheckFlagsJson as unknown as FactcheckFlag[] | null) ?? [],
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
    video: item.video
      ? {
          id: item.video.id,
          buildStatus: item.video.buildStatus.toLowerCase(),
          errorStage: item.video.errorStage,
          voiceId: item.video.voiceId,
          durationSec: item.video.durationSec,
          script: item.video.scriptJson as unknown as ScriptSegment[],
          hasMp4: !!item.video.mp4Url,
          hasSrt: !!item.video.srtUrl,
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
  const departmentId = await departmentForTopic(topicId);
  await assertQuota(departmentId);
  const glossary = glossaryBlock(await getGlossaryForDepartment(departmentId));

  const gen = await generateStructured<QuizGen>({
    systemInstruction: quizSystemPrompt(opts.language, opts.questionCount, opts.difficulty) + glossary,
    userContent: quizUserContent(digest),
    responseSchema: quizResponseSchema,
    kind: "QUIZ",
    topicId,
    departmentId,
    userId: teacherId,
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
  const departmentId = await departmentForTopic(topicId);
  await assertQuota(departmentId);
  const glossary = glossaryBlock(await getGlossaryForDepartment(departmentId));

  const gen = await generateStructured<CaseJson>({
    systemInstruction: caseSystemPrompt(opts.language, opts.format) + glossary,
    userContent: caseUserContent(digest),
    responseSchema: caseResponseSchema,
    kind: "CASE",
    topicId,
    departmentId,
    userId: teacherId,
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
  const item = await contentForTeacher(contentId, teacherId);
  // Mark "opened in editor" the first time it's fetched (publish gate #2).
  if (item.reviewOpenedAt === null) {
    await prisma.contentItem.update({ where: { id: contentId }, data: { reviewOpenedAt: new Date() } });
    return toContentOut(await contentForTeacher(contentId, teacherId));
  }
  return toContentOut(item);
}

/** Editing content invalidates its factcheck and any prior approval/publish. */
async function invalidateAfterEdit(contentId: number, status: string) {
  await prisma.contentItem.update({
    where: { id: contentId },
    data: {
      editedByTeacher: true,
      factcheckStatus: "NONE",
      factcheckFlagsJson: Prisma.JsonNull,
      factcheckedAt: null,
      ...(status === "PUBLISHED" || status === "APPROVED"
        ? { status: "DRAFT", approvedById: null, approvedAt: null }
        : {}),
    },
  });
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
    });
  } else if (item.kind === "CASE") {
    const parsed = caseSchema.safeParse(body);
    if (!parsed.success) throw badRequest("Keys tuzilishi notoʻgʻri", "Неверная структура кейса");
    await prisma.clinicalCase.update({
      where: { contentItemId: contentId },
      data: { caseJson: parsed.data as object },
    });
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
  } else if (item.kind === "VIDEO") {
    const b = body as { script: { slideIndex: number; narration: string }[] };
    if (!b || !Array.isArray(b.script)) throw badRequest("Skript notoʻgʻri", "Неверный скрипт");
    // Only narration text is editable; durations are re-measured on rebuild.
    const segs: ScriptSegment[] = b.script.map((s) => ({ slideIndex: s.slideIndex, narration: s.narration, durationSec: 0 }));
    await prisma.video.update({ where: { contentItemId: contentId }, data: { scriptJson: segs as object } });
  } else {
    throw badRequest("Bu kontent turi hali tahrirlanmaydi", "Этот тип контента пока не редактируется");
  }

  // Any edit invalidates the factcheck and reverts approval/publish (medical safety).
  await invalidateAfterEdit(contentId, item.status);
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

// ---------- Factcheck (second AI pass vs source) ----------

function contentToText(item: ContentFull): string {
  if (item.quiz) {
    return item.quiz.questions
      .map((q, i) => {
        const opts = (q.optionsJson as string[]).map((o, j) => `${j + 1}) ${o}`).join("; ");
        const correct = (q.optionsJson as string[])[q.correctIndex];
        const expl = (q.explanationJson as string[]).join(" | ");
        return `Test, savol ${i + 1}: ${q.text}\nVariantlar: ${opts}\nToʻgʻri javob: ${correct}\nIzohlar: ${expl}`;
      })
      .join("\n\n");
  }
  if (item.clinicalCase) {
    const c = item.clinicalCase.caseJson as unknown as { complaints: string; anamnesis: string; objectiveStatus: string; labData: string; questions: string[]; referenceAnswer: string[] };
    return [
      `Keys, shikoyatlar: ${c.complaints}`,
      `Keys, anamnez: ${c.anamnesis}`,
      `Keys, obyektiv: ${c.objectiveStatus}`,
      `Keys, lab: ${c.labData}`,
      ...c.questions.map((q, i) => `Keys, savol ${i + 1}: ${q}`),
      ...c.referenceAnswer.map((a, i) => `Keys, etalon javob ${i + 1}: ${a}`),
    ].join("\n");
  }
  if (item.presentation) {
    return (item.presentation.slidesJson as unknown as { title: string; bullets: string[]; speakerNotes: string }[])
      .map((s, i) => `Slayd ${i + 1}: ${s.title}\n${s.bullets.join("; ")}\nIzoh: ${s.speakerNotes}`)
      .join("\n\n");
  }
  if (item.video) {
    return (item.video.scriptJson as unknown as { slideIndex: number; narration: string }[])
      .map((s) => `Video, slayd ${s.slideIndex + 1}: ${s.narration}`)
      .join("\n\n");
  }
  return "";
}

async function collectSource(topicId: number): Promise<string> {
  const materials = await prisma.sourceMaterial.findMany({ where: { topicId, parseStatus: "DONE" }, orderBy: { id: "asc" } });
  const parts: string[] = [];
  for (const m of materials) if (m.parsedTextUrl) parts.push(await readText(m.parsedTextUrl));
  return parts.join("\n\n---\n\n").slice(0, 100_000);
}

export async function runFactcheck(contentId: number, teacherId: number) {
  const item = await contentForTeacher(contentId, teacherId);
  const contentText = contentToText(item);
  const sourceText = await collectSource(item.topicId);

  const departmentId = await departmentForTopic(item.topicId);
  await assertQuota(departmentId);
  await prisma.contentItem.update({ where: { id: contentId }, data: { factcheckStatus: "CHECKING" } });

  const gen = await generateStructured<FactcheckGen>({
    systemInstruction: factcheckSystemPrompt(),
    userContent: factcheckUserContent(contentText, sourceText),
    responseSchema: factcheckResponseSchema,
    departmentId,
    userId: teacherId,
    kind: "FACTCHECK",
    topicId: item.topicId,
  });
  const parsed = factcheckGenSchema.safeParse(gen);
  const rawFlags = (parsed.success ? parsed.data : gen).flags;
  const flags: FactcheckFlag[] = rawFlags.map((f) => ({ ...f, resolved: false, resolution: null }));

  await prisma.contentItem.update({
    where: { id: contentId },
    data: {
      factcheckFlagsJson: flags as object,
      factcheckStatus: flags.length === 0 ? "CLEAN" : "FLAGGED",
      factcheckedAt: new Date(),
    },
  });
  return toContentOut(await contentForTeacher(contentId, teacherId));
}

export async function resolveFactcheckFlag(
  contentId: number,
  teacherId: number,
  flagIndex: number,
  resolution: "confirmed" | "fixed"
) {
  const item = await contentForTeacher(contentId, teacherId);
  const flags = (item.factcheckFlagsJson as unknown as FactcheckFlag[] | null) ?? [];
  if (!flags[flagIndex]) throw notFound("Belgi");
  flags[flagIndex] = { ...flags[flagIndex], resolved: true, resolution };
  const allResolved = flags.every((f) => f.resolved);
  await prisma.contentItem.update({
    where: { id: contentId },
    data: { factcheckFlagsJson: flags as object, factcheckStatus: allResolved ? "RESOLVED" : "FLAGGED" },
  });
  return toContentOut(await contentForTeacher(contentId, teacherId));
}

// ---------- Publish (second control point — backend-enforced) ----------

export async function publishContent(contentId: number, teacherId: number) {
  const item = await contentForTeacher(contentId, teacherId);
  const topic = await prisma.topic.findUnique({ where: { id: item.topicId }, include: { digest: true } });

  // Gate 1: digest approved
  if (!topic?.digest?.approvedByTeacher) {
    throw new ApiError(403, "digest_not_approved", "Avval konspektni tasdiqlang", "Сначала утвердите конспект");
  }
  // Gate 2: opened in editor at least once
  if (item.reviewOpenedAt === null) {
    throw new ApiError(403, "not_reviewed", "Avval kontentni tahrirlagichda oching", "Сначала откройте контент в редакторе");
  }
  // Gate 3: factcheck clean or all flags resolved
  if (item.factcheckStatus !== "CLEAN" && item.factcheckStatus !== "RESOLVED") {
    throw new ApiError(403, "factcheck_unresolved", "Avval faktcheck belgilarini hal qiling", "Сначала решите флаги факт-чека");
  }

  const flags = (item.factcheckFlagsJson as unknown as FactcheckFlag[] | null) ?? [];
  const published = await prisma.contentItem.update({
    where: { id: contentId },
    data: { status: "PUBLISHED", approvedById: teacherId, approvedAt: new Date() },
    include: contentInclude,
  });
  await prisma.auditLog.create({
    data: {
      actorId: teacherId,
      action: "PUBLISH_CONTENT",
      entity: "ContentItem",
      entityId: contentId,
      detailsJson: { kind: item.kind, flagCount: flags.length },
    },
  });
  return toContentOut(published as ContentFull);
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
