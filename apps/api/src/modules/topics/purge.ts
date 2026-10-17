import { prisma, Prisma } from "../../lib/prisma";
import { conflict } from "../../lib/errors";
import { deleteTopicFiles } from "../../lib/storage";

/**
 * Mavzu(lar)ni BUTUNLAY o'chirish — mavzu o'chirish va kurs o'chirish umumiy yo'li.
 *
 * ⚠️ 2026-10-17 (productionda topildi): ilgari `deleteTopic` faqat materiallarni
 * o'chirib, keyin `topic.delete` qilardi. Konspekt, test yoki keys yaratilgan
 * bo'lsa ularning FK'si (ContentItem / TopicDigest / Progress) o'chirishni to'sib,
 * foydalanuvchi **500 "Server xatosi"** ko'rardi — ya'ni AI ishlatilgan mavzuni
 * umuman o'chirib bo'lmasdi.
 *
 * Qoida (buyurtmachi bilan kelishilgan):
 *  - Talabalar NATIJASI bor (test urinishi, keys javobi, tugatilgan/qo'lda ochilgan
 *    progress) → o'chirilMAYDI, aniq 409 (baholar tasodifan yo'qolmasin).
 *  - Natija yo'q → mavzu AI yaratgan hamma narsa bilan birga o'chadi: konspekt,
 *    test, keys, taqdimot, video, podkast, materiallar va ularning fayllari.
 */

export interface StudentResults {
  quizAttempts: number;
  caseAttempts: number;
  completed: number;
}

export const hasResults = (r: StudentResults) => r.quizAttempts + r.caseAttempts + r.completed > 0;

async function contentIds(db: Prisma.TransactionClient | typeof prisma, topicIds: number[]) {
  const items = await db.contentItem.findMany({ where: { topicId: { in: topicIds } }, select: { id: true } });
  const itemIds = items.map((i) => i.id);
  const [quizzes, cases] = await Promise.all([
    db.quiz.findMany({ where: { contentItemId: { in: itemIds } }, select: { id: true } }),
    db.clinicalCase.findMany({ where: { contentItemId: { in: itemIds } }, select: { id: true } }),
  ]);
  return { itemIds, quizIds: quizzes.map((q) => q.id), caseIds: cases.map((c) => c.id) };
}

export async function studentResults(topicIds: number[]): Promise<StudentResults> {
  if (topicIds.length === 0) return { quizAttempts: 0, caseAttempts: 0, completed: 0 };
  const { quizIds, caseIds } = await contentIds(prisma, topicIds);
  const [quizAttempts, caseAttempts, completed] = await Promise.all([
    prisma.quizAttempt.count({ where: { quizId: { in: quizIds } } }),
    prisma.caseAttempt.count({ where: { caseId: { in: caseIds } } }),
    prisma.progress.count({
      where: { topicId: { in: topicIds }, OR: [{ state: "COMPLETED" }, { overriddenAt: { not: null } }] },
    }),
  ]);
  return { quizAttempts, caseAttempts, completed };
}

export function resultsConflict(what: "topic" | "course", r: StudentResults, attendance = 0) {
  const uz = [
    r.quizAttempts ? `${r.quizAttempts} ta test urinishi` : null,
    r.caseAttempts ? `${r.caseAttempts} ta keys javobi` : null,
    r.completed ? `${r.completed} ta tugatilgan mavzu` : null,
    attendance ? `${attendance} ta davomat belgisi` : null,
  ].filter(Boolean).join(", ");
  const ru = [
    r.quizAttempts ? `попыток теста: ${r.quizAttempts}` : null,
    r.caseAttempts ? `ответов на кейс: ${r.caseAttempts}` : null,
    r.completed ? `завершённых тем: ${r.completed}` : null,
    attendance ? `отметок посещаемости: ${attendance}` : null,
  ].filter(Boolean).join(", ");
  return what === "topic"
    ? conflict(
        "HAS_STUDENT_RESULTS",
        `Mavzuni oʻchirib boʻlmaydi: talabalarning natijalari bor (${uz}). Baholar saqlanib qolishi kerak.`,
        `Тему нельзя удалить: у студентов есть результаты (${ru}). Оценки должны сохраниться.`
      )
    : conflict(
        "HAS_STUDENT_RESULTS",
        `Kursni oʻchirib boʻlmaydi: talabalarning natijalari bor (${uz}). Baholar saqlanib qolishi kerak.`,
        `Курс нельзя удалить: у студентов есть результаты (${ru}). Оценки должны сохраниться.`
      );
}

/** Mavzu qatorlarini bitta tranzaksiya ichida o'chiradi (fayllar — tranzaksiyadan KEYIN). */
export async function purgeTopicRows(tx: Prisma.TransactionClient, topicIds: number[]): Promise<void> {
  if (topicIds.length === 0) return;
  const { itemIds, quizIds, caseIds } = await contentIds(tx, topicIds);
  const questions = await tx.question.findMany({ where: { quizId: { in: quizIds } }, select: { id: true } });

  // Bolalardan ota-onaga: har bir FK o'chirishni to'smasligi uchun tartib muhim.
  await tx.remediationAnswer.deleteMany({ where: { questionId: { in: questions.map((q) => q.id) } } });
  await tx.quizAttempt.deleteMany({ where: { quizId: { in: quizIds } } });
  await tx.caseAttempt.deleteMany({ where: { caseId: { in: caseIds } } });
  await tx.question.deleteMany({ where: { quizId: { in: quizIds } } });
  await tx.quiz.deleteMany({ where: { id: { in: quizIds } } });
  await tx.clinicalCase.deleteMany({ where: { id: { in: caseIds } } });
  await tx.presentation.deleteMany({ where: { contentItemId: { in: itemIds } } });
  await tx.video.deleteMany({ where: { contentItemId: { in: itemIds } } });
  await tx.contentItem.deleteMany({ where: { id: { in: itemIds } } });
  await tx.topicDigest.deleteMany({ where: { topicId: { in: topicIds } } });
  await tx.progress.deleteMany({ where: { topicId: { in: topicIds } } });
  await tx.sourceMaterial.deleteMany({ where: { topicId: { in: topicIds } } });
  // Dars va topshiriq tarixi qoladi — faqat mavzuga havola uziladi.
  await tx.lessonSession.updateMany({ where: { topicId: { in: topicIds } }, data: { topicId: null } });
  await tx.task.updateMany({ where: { topicId: { in: topicIds } }, data: { topicId: null } });
  // Qolganlari (fleshkarta takrori, bemor suhbati, AI-tutor, o'qilgan bo'limlar,
  // havolalar, podkast) Prisma sxemasida onDelete: Cascade.
  await tx.topic.deleteMany({ where: { id: { in: topicIds } } });
}

/** Tranzaksiya muvaffaqiyatli tugagach chaqiriladi — fayl xatosi bazani buzmaydi. */
export async function purgeTopicFiles(topicIds: number[]): Promise<void> {
  for (const id of topicIds) {
    await deleteTopicFiles(id).catch((err) => console.warn(`[purge] topic ${id} fayllari:`, (err as Error).message));
  }
}

export const PURGE_TX_OPTS = { timeout: 30_000, maxWait: 10_000 } as const;
