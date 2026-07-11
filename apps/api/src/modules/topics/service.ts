import type { SourceMaterial, Topic } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { deletePath, readText, readFileBuffer, saveMaterialFile, saveParsedText } from "../../lib/storage";
import { extractText, fileTypeFromName, parseErrorMessages, type ParseErrorCode } from "./parse";
import { generateStructured } from "../../ai/gemini";
import { digestSchema, digestResponseSchema, type DigestJson } from "../../ai/types";
import { digestSystemPrompt, digestUserContent } from "../../ai/prompts/digest";

const MAX_MATERIAL_CHARS = 100_000;

// ---------- Ownership ----------

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}

async function assertCourseOwner(courseId: number, teacherId: number) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Kurs");
  if (course.teacherId !== teacherId) throw forbidden();
  return course;
}

async function topicForTeacher(topicId: number, teacherId: number) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { course: true } });
  if (!topic) throw notFound("Mavzu");
  if (topic.course.teacherId !== teacherId) throw forbidden();
  return topic;
}

async function materialForTeacher(materialId: number, teacherId: number) {
  const material = await prisma.sourceMaterial.findUnique({
    where: { id: materialId },
    include: { topic: { include: { course: true } } },
  });
  if (!material) throw notFound("Material");
  if (material.topic.course.teacherId !== teacherId) throw forbidden();
  return material;
}

// ---------- Topic serialization ----------

function toTopicOut(t: Topic & { _count?: { materials: number } }) {
  return {
    id: t.id,
    courseId: t.courseId,
    titleUz: t.titleUz,
    titleRu: t.titleRu,
    orderIndex: t.orderIndex,
    status: t.status.toLowerCase(),
    materialCount: t._count?.materials ?? 0,
  };
}

// ---------- Topics CRUD ----------

export async function listTopics(courseId: number, teacherId: number) {
  await assertCourseOwner(courseId, teacherId);
  const rows = await prisma.topic.findMany({
    where: { courseId },
    orderBy: { orderIndex: "asc" },
    include: { _count: { select: { materials: true } } },
  });
  return rows.map(toTopicOut);
}

export async function createTopic(input: { courseId: number; titleUz: string; titleRu: string }, teacherId: number) {
  await assertCourseOwner(input.courseId, teacherId);
  const last = await prisma.topic.findFirst({
    where: { courseId: input.courseId },
    orderBy: { orderIndex: "desc" },
  });
  const orderIndex = (last?.orderIndex ?? -1) + 1;
  const t = await prisma.topic.create({
    data: { courseId: input.courseId, titleUz: input.titleUz.trim(), titleRu: input.titleRu.trim(), orderIndex },
  });
  return toTopicOut(t);
}

export async function updateTopic(
  id: number,
  input: { titleUz?: string; titleRu?: string; status?: "DRAFT" | "PUBLISHED" },
  teacherId: number
) {
  await topicForTeacher(id, teacherId);
  const t = await prisma.topic.update({
    where: { id },
    data: {
      titleUz: input.titleUz?.trim(),
      titleRu: input.titleRu?.trim(),
      status: input.status,
    },
  });
  return toTopicOut(t);
}

export async function deleteTopic(id: number, teacherId: number) {
  await topicForTeacher(id, teacherId);
  const materials = await prisma.sourceMaterial.findMany({ where: { topicId: id } });
  for (const m of materials) {
    await deletePath(m.fileUrl);
    if (m.parsedTextUrl) await deletePath(m.parsedTextUrl);
  }
  await prisma.sourceMaterial.deleteMany({ where: { topicId: id } });
  await prisma.topic.delete({ where: { id } });
}

export async function reorderTopics(orderedIds: number[], teacherId: number) {
  if (orderedIds.length === 0) return;
  // All must belong to the same course owned by this teacher.
  const topics = await prisma.topic.findMany({
    where: { id: { in: orderedIds } },
    include: { course: true },
  });
  if (topics.length !== orderedIds.length) throw notFound("Mavzu");
  const courseIds = new Set(topics.map((t) => t.courseId));
  if (courseIds.size !== 1) throw badRequest("Bitta kurs mavzulari boʻlishi kerak", "Темы должны быть из одного курса");
  if (topics.some((t) => t.course.teacherId !== teacherId)) throw forbidden();

  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.topic.update({ where: { id }, data: { orderIndex: index } }))
  );
}

export async function getTopicDetail(id: number, teacherId: number) {
  const topic = await topicForTeacher(id, teacherId);
  const materials = await prisma.sourceMaterial.findMany({
    where: { topicId: id },
    orderBy: { id: "asc" },
  });
  const digest = await prisma.topicDigest.findUnique({ where: { topicId: id } });
  return {
    ...toTopicOut(topic),
    materials: materials.map(toMaterialOut),
    // Lock gate for section 2 (Konspekt): needs a parsed material.
    digestUnlocked: materials.some((m) => m.parseStatus === "DONE"),
    digest: digest
      ? {
          digestJson: digest.digestJson as unknown as DigestJson,
          version: digest.version,
          approvedByTeacher: digest.approvedByTeacher,
        }
      : null,
    // Lock gate for section 3 (Generatsiya) — first control point.
    generateUnlocked: digest?.approvedByTeacher === true,
  };
}

// ---------- Digest (AI, first lock) ----------

async function collectMaterialText(topicId: number): Promise<string> {
  const materials = await prisma.sourceMaterial.findMany({
    where: { topicId, parseStatus: "DONE" },
    orderBy: { id: "asc" },
  });
  const parts: string[] = [];
  for (const m of materials) {
    if (m.parsedTextUrl) parts.push(await readText(m.parsedTextUrl));
  }
  return parts.join("\n\n---\n\n").slice(0, MAX_MATERIAL_CHARS);
}

export async function generateDigest(topicId: number, teacherId: number) {
  await topicForTeacher(topicId, teacherId);

  const doneCount = await prisma.sourceMaterial.count({ where: { topicId, parseStatus: "DONE" } });
  if (doneCount === 0) {
    throw badRequest("Avval material yuklang", "Сначала загрузите материал");
  }

  const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
  const lang = teacher?.locale === "ru" ? "ru" : "uz";
  const materialText = await collectMaterialText(topicId);

  const raw = await generateStructured<DigestJson>({
    systemInstruction: digestSystemPrompt(lang),
    userContent: digestUserContent(materialText),
    responseSchema: digestResponseSchema,
    kind: "digest",
    topicId,
  });

  // Coerce/validate the model output into our shape (never trust it blindly).
  const parsed = digestSchema.safeParse(raw);
  const digestJson: DigestJson = parsed.success ? parsed.data : raw;

  const existing = await prisma.topicDigest.findUnique({ where: { topicId } });
  const digest = await prisma.topicDigest.upsert({
    where: { topicId },
    create: { topicId, digestJson: digestJson as object, version: 1, approvedByTeacher: false },
    update: {
      digestJson: digestJson as object,
      version: (existing?.version ?? 0) + 1,
      approvedByTeacher: false,
    },
  });
  return { digestJson: digest.digestJson as unknown as DigestJson, version: digest.version, approvedByTeacher: false };
}

export async function getDigest(topicId: number, teacherId: number) {
  await topicForTeacher(topicId, teacherId);
  const digest = await prisma.topicDigest.findUnique({ where: { topicId } });
  if (!digest) return null;
  return {
    digestJson: digest.digestJson as unknown as DigestJson,
    version: digest.version,
    approvedByTeacher: digest.approvedByTeacher,
  };
}

export async function updateDigest(topicId: number, teacherId: number, input: unknown) {
  await topicForTeacher(topicId, teacherId);
  const parsed = digestSchema.safeParse(input);
  if (!parsed.success) throw badRequest("Konspekt tuzilishi notoʻgʻri", "Неверная структура конспекта");

  const existing = await prisma.topicDigest.findUnique({ where: { topicId } });
  if (!existing) throw notFound("Konspekt");

  // Editing un-approves — must be re-approved (first control point).
  const digest = await prisma.topicDigest.update({
    where: { topicId },
    data: { digestJson: parsed.data as object, version: existing.version + 1, approvedByTeacher: false },
  });
  return { digestJson: digest.digestJson as unknown as DigestJson, version: digest.version, approvedByTeacher: false };
}

export async function approveDigest(topicId: number, teacherId: number) {
  await topicForTeacher(topicId, teacherId);
  const existing = await prisma.topicDigest.findUnique({ where: { topicId } });
  if (!existing) throw notFound("Konspekt");
  const digest = await prisma.topicDigest.update({ where: { topicId }, data: { approvedByTeacher: true } });
  return {
    digestJson: digest.digestJson as unknown as DigestJson,
    version: digest.version,
    approvedByTeacher: true,
  };
}

// ---------- Materials ----------

function toMaterialOut(m: SourceMaterial) {
  const code = m.parseError as ParseErrorCode | null;
  const err = code && parseErrorMessages[code] ? parseErrorMessages[code] : null;
  return {
    id: m.id,
    topicId: m.topicId,
    fileName: m.fileName,
    fileType: m.fileType,
    parseStatus: m.parseStatus.toLowerCase(),
    hasText: !!m.parsedTextUrl,
    errorUz: err?.uz ?? null,
    errorRu: err?.ru ?? null,
    createdAt: m.createdAt,
  };
}

// Background parse (fire-and-forget). Reads the stored file, extracts text.
async function runParse(materialId: number) {
  await prisma.sourceMaterial.update({ where: { id: materialId }, data: { parseStatus: "PROCESSING" } });
  try {
    const m = await prisma.sourceMaterial.findUnique({ where: { id: materialId } });
    if (!m) return;
    const buffer = await readFileBuffer(m.fileUrl);
    const outcome = await extractText(buffer, m.fileType);
    if (outcome.ok) {
      const textUrl = await saveParsedText(m.topicId, m.id, outcome.text);
      await prisma.sourceMaterial.update({
        where: { id: materialId },
        data: { parseStatus: "DONE", parsedTextUrl: textUrl, parseError: null },
      });
    } else {
      await prisma.sourceMaterial.update({
        where: { id: materialId },
        data: { parseStatus: "ERROR", parseError: outcome.errorCode ?? "READ_FAILED" },
      });
    }
  } catch {
    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { parseStatus: "ERROR", parseError: "READ_FAILED" },
    });
  }
}

export async function uploadMaterial(
  topicId: number,
  file: { originalname: string; buffer: Buffer },
  teacherId: number
) {
  await topicForTeacher(topicId, teacherId);
  const fileType = fileTypeFromName(file.originalname);

  // Create the row first so we have an id for the storage path.
  const material = await prisma.sourceMaterial.create({
    data: {
      topicId,
      fileUrl: "",
      fileName: file.originalname,
      fileType,
      parseStatus: "PENDING",
      uploadedById: teacherId,
    },
  });
  const fileUrl = await saveMaterialFile(topicId, material.id, file.originalname, file.buffer);
  await prisma.sourceMaterial.update({ where: { id: material.id }, data: { fileUrl } });

  // Kick off parsing without blocking the response.
  setImmediate(() => void runParse(material.id));

  const fresh = await prisma.sourceMaterial.findUnique({ where: { id: material.id } });
  return toMaterialOut(fresh!);
}

export async function getMaterial(materialId: number, teacherId: number) {
  const m = await materialForTeacher(materialId, teacherId);
  return toMaterialOut(m);
}

export async function getMaterialText(materialId: number, teacherId: number) {
  const m = await materialForTeacher(materialId, teacherId);
  if (!m.parsedTextUrl) throw notFound("Matn");
  const text = await readText(m.parsedTextUrl);
  return { text };
}

export async function retryMaterial(materialId: number, teacherId: number) {
  const m = await materialForTeacher(materialId, teacherId);
  await prisma.sourceMaterial.update({ where: { id: m.id }, data: { parseStatus: "PENDING", parseError: null } });
  setImmediate(() => void runParse(m.id));
  const fresh = await prisma.sourceMaterial.findUnique({ where: { id: m.id } });
  return toMaterialOut(fresh!);
}

export async function deleteMaterial(materialId: number, teacherId: number) {
  const m = await materialForTeacher(materialId, teacherId);
  await deletePath(m.fileUrl);
  if (m.parsedTextUrl) await deletePath(m.parsedTextUrl);
  await prisma.sourceMaterial.delete({ where: { id: m.id } });
}
