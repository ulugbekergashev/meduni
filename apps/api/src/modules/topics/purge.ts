import { prisma, Prisma } from "../../lib/prisma";
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
 * Qoida (2026-10-31, buyurtmachi: "kim nima yaratsa, o'zi o'chirsin — talaba
 * ishlasa ham"): mavzu AI yaratgan hamma narsa va TALABALAR NATIJALARI (test
 * urinishlari, keys javoblari, progress) bilan birga o'chadi. Ilgari natija bo'lsa
 * 409 HAS_STUDENT_RESULTS berilardi — bu o'qituvchini xato mavzudan qutulish
 * imkonidan mahrum qilardi.
 *
 * Himoya endi TAQIQ emas, OGOHLANTIRISH: UI o'chirishdan oldin `studentResults`
 * (nechta talaba, nechta urinish) ni ko'rsatadi, o'chirilgan hajm AuditLog'ga
 * yoziladi.
 */

export interface StudentResults {
  /** Natijasi o'chadigan TURLI talabalar soni. */
  students: number;
  quizAttempts: number;
  caseAttempts: number;
  completed: number;
}

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
  if (topicIds.length === 0) return { students: 0, quizAttempts: 0, caseAttempts: 0, completed: 0 };
  const { quizIds, caseIds } = await contentIds(prisma, topicIds);
  const progressWhere = { topicId: { in: topicIds }, OR: [{ state: "COMPLETED" as const }, { overriddenAt: { not: null } }] };
  const [qa, ca, pr] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { quizId: { in: quizIds } }, select: { studentId: true } }),
    prisma.caseAttempt.findMany({ where: { caseId: { in: caseIds } }, select: { studentId: true } }),
    prisma.progress.findMany({ where: progressWhere, select: { studentId: true } }),
  ]);
  const students = new Set([...qa, ...ca, ...pr].map((r) => r.studentId)).size;
  return { students, quizAttempts: qa.length, caseAttempts: ca.length, completed: pr.length };
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
