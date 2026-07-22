import type { SourceMaterial, Topic } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { deletePath, readText, readFileBuffer, saveMaterialFile, saveParsedText } from "../../lib/storage";
import { extractText, fileTypeFromName, parseErrorMessages, pdfPageCount, type ParseErrorCode } from "./parse";
import { generateStructured } from "../../ai/gemini";
import { assertQuota } from "../../ai/quota";
import { departmentForTopic } from "../../ai/glossary";
import { digestSchema, digestResponseSchema, type DigestJson } from "../../ai/types";
import { digestSystemPrompt, digestUserContent } from "../../ai/prompts/digest";

const MAX_MATERIAL_CHARS = 100_000;

// ---------- Ownership (Faza 3: kafedra-markazlashgan) ----------
// Mavzu FANGA tegishli. Tahrir huquqi: o'qituvchi fan kafedrasining a'zosi
// YOKI shu fandan kurs olib boradi. Shu ikki holatdan biri yetarli.

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu fan sizga tegishli emas", "Этот предмет вам не принадлежит");
}

export function subjectTeacherFilter(teacherId: number) {
  return {
    OR: [
      { department: { teachers: { some: { userId: teacherId } } } },
      { courses: { some: { teacherId } } },
    ],
  };
}

export async function assertSubjectTeacher(subjectId: number, teacherId: number) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, ...subjectTeacherFilter(teacherId) },
  });
  if (!subject) throw forbidden();
  return subject;
}

async function courseForTeacher(courseId: number, teacherId: number) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Kurs");
  // Kurs orqali kirilganda ham huquq fan darajasida tekshiriladi.
  await assertSubjectTeacher(course.subjectId, teacherId);
  return course;
}

export async function topicForTeacher(topicId: number, teacherId: number) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) throw notFound("Mavzu");
  await assertSubjectTeacher(topic.subjectId, teacherId);
  return topic;
}

async function materialForTeacher(materialId: number, teacherId: number) {
  const material = await prisma.sourceMaterial.findUnique({
    where: { id: materialId },
    include: { topic: true },
  });
  if (!material) throw notFound("Material");
  await assertSubjectTeacher(material.topic.subjectId, teacherId);
  return material;
}

/** Back-nav uchun: o'qituvchining shu fandagi (birinchi) kursi. */
async function teacherCourseIdForSubject(subjectId: number, teacherId: number): Promise<number | null> {
  const course = await prisma.course.findFirst({
    where: { subjectId, teacherId },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return course?.id ?? null;
}

// ---------- Topic serialization ----------

function toTopicOut(
  t: Topic & {
    _count?: { materials: number };
    digest?: { approvedByTeacher: boolean } | null;
    contentItems?: { kind: string; status: string }[];
  },
  courseId: number | null = null
) {
  return {
    id: t.id,
    subjectId: t.subjectId,
    // Frontend back-nav uchun: shu o'qituvchining fandagi kursi (kontekstga bog'liq).
    courseId,
    title: t.title,
    orderIndex: t.orderIndex,
    status: t.status.toLowerCase(),
    materialCount: t._count?.materials ?? 0,
    // Pipeline summary for the list rows (empty when not included, e.g. create/update).
    digestState: t.digest ? (t.digest.approvedByTeacher ? "approved" : "draft") : null,
    contentKinds: (t.contentItems ?? []).map((ci) => ({ kind: ci.kind.toLowerCase(), status: ci.status.toLowerCase() })),
  };
}

// ---------- Topics CRUD ----------

const topicListInclude = {
  _count: { select: { materials: true } },
  digest: { select: { approvedByTeacher: true } },
  contentItems: { select: { kind: true, status: true } },
} as const;

export async function listTopics(courseId: number, teacherId: number) {
  const course = await courseForTeacher(courseId, teacherId);
  const rows = await prisma.topic.findMany({
    where: { subjectId: course.subjectId },
    orderBy: { orderIndex: "asc" },
    include: topicListInclude,
  });
  return rows.map((t) => toTopicOut(t, courseId));
}

/** Fan sahifasi uchun: kurs kontekstisiz, to'g'ridan fan bo'yicha. */
export async function listTopicsBySubject(subjectId: number, teacherId: number) {
  await assertSubjectTeacher(subjectId, teacherId);
  const [rows, backCourseId] = await Promise.all([
    prisma.topic.findMany({
      where: { subjectId },
      orderBy: { orderIndex: "asc" },
      include: topicListInclude,
    }),
    teacherCourseIdForSubject(subjectId, teacherId),
  ]);
  return rows.map((t) => toTopicOut(t, backCourseId));
}

export async function createTopic(
  input: { courseId?: number; subjectId?: number; title: string },
  teacherId: number
) {
  let subjectId: number;
  let backCourseId: number | null = null;
  if (input.courseId !== undefined) {
    const course = await courseForTeacher(input.courseId, teacherId);
    subjectId = course.subjectId;
    backCourseId = input.courseId;
  } else {
    await assertSubjectTeacher(input.subjectId!, teacherId);
    subjectId = input.subjectId!;
    backCourseId = await teacherCourseIdForSubject(subjectId, teacherId);
  }
  const last = await prisma.topic.findFirst({
    where: { subjectId },
    orderBy: { orderIndex: "desc" },
  });
  const orderIndex = (last?.orderIndex ?? -1) + 1;
  const t = await prisma.topic.create({
    data: { subjectId, title: input.title.trim(), orderIndex },
  });
  return toTopicOut(t, backCourseId);
}

export async function updateTopic(
  id: number,
  input: { title?: string; status?: "DRAFT" | "PUBLISHED" },
  teacherId: number
) {
  await topicForTeacher(id, teacherId);
  const t = await prisma.topic.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      status: input.status,
    },
  });
  return toTopicOut(t);
}

export async function setTopicUnlockRule(id: number, unlockRule: unknown, teacherId: number) {
  await topicForTeacher(id, teacherId);
  // null => fall back to the course default.
  await prisma.topic.update({ where: { id }, data: { unlockRuleJson: (unlockRule ?? null) as object } });
  return { ok: true };
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
  // All must belong to the same subject the teacher can edit.
  const topics = await prisma.topic.findMany({
    where: { id: { in: orderedIds } },
  });
  if (topics.length !== orderedIds.length) throw notFound("Mavzu");
  const subjectIds = new Set(topics.map((t) => t.subjectId));
  if (subjectIds.size !== 1) throw badRequest("Bitta fan mavzulari boʻlishi kerak", "Темы должны быть из одного предмета");
  await assertSubjectTeacher(topics[0].subjectId, teacherId);

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
  const content = await prisma.contentItem.findMany({ where: { topicId: id }, include: { approvedBy: true } });
  const backCourseId = await teacherCourseIdForSubject(topic.subjectId, teacherId);
  return {
    ...toTopicOut(topic, backCourseId),
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
    unlockRule: topic.unlockRuleJson ?? null,
    content: content.map((c) => ({
      id: c.id,
      kind: c.kind.toLowerCase(),
      status: c.status.toLowerCase(),
      editedByTeacher: c.editedByTeacher,
      reviewOpened: c.reviewOpenedAt !== null,
      factcheckStatus: c.factcheckStatus.toLowerCase(),
      factcheckFlags: (c.factcheckFlagsJson as unknown as unknown[] | null) ?? [],
      approvedByName: c.approvedBy?.fullName ?? null,
      approvedAt: c.approvedAt,
    })),
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

  const departmentId = await departmentForTopic(topicId);
  await assertQuota(departmentId);

  const raw = await generateStructured<DigestJson>({
    systemInstruction: digestSystemPrompt(lang),
    userContent: digestUserContent(materialText),
    responseSchema: digestResponseSchema,
    kind: "DIGEST",
    topicId,
    departmentId,
    userId: teacherId,
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
    // Talabaga ko'rsatiladigan metama'lumot ("PDF · 24 bet"). Aniqlanmasa null.
    const pageCount = pdfPageCount(buffer, m.fileType);
    if (outcome.ok) {
      const textUrl = await saveParsedText(m.topicId, m.id, outcome.text);
      await prisma.sourceMaterial.update({
        where: { id: materialId },
        data: { parseStatus: "DONE", parsedTextUrl: textUrl, parseError: null, pageCount },
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
      sizeBytes: file.buffer.length,
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
