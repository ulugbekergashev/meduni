import { Prisma, prisma } from "../../lib/prisma";
import { resolvePolicy } from "../policy/service";
import { answersToOriginal, hasShownAnswers, ORDER_VERSION, readAnswers, readOrder, type ShownIndex } from "./integrity";
import { attemptQuestions, gradeAnswers, questionLoader } from "./quizGrading";
import { quizPassPctForStudent, syncTopicProgress } from "./service";

/**
 * BIR MARTALIK TUZATISH (2026-10-31, buyurtmachi: "to'g'ri javobni belgilasa
 * ham noto'g'ri deyapti").
 *
 * 2026-08-11 dan beri variantlar har urinishda aralashtiriladi, lekin
 * `saveQuizAnswers` talaba bosgan EKRAN indeksini aslga o'girmay saqlardi →
 * baholash ham, tahlildagi "sizning javobingiz" ham boshqa variantga tushardi.
 *
 * Bu funksiya `v: 2` belgisi YO'Q (ya'ni tuzatishdan oldingi) har urinishni:
 *   1) javoblarini asl indeksga o'giradi;
 *   2) yakunlangan bo'lsa — O'SHA urinishning savollar to'plami (orderJson.q,
 *      keyin eskirgan savollar ham) bilan qayta baholaydi;
 *   3) belgini qo'yadi — takror ishga tushsa hech narsa qilmaydi;
 *   4) ball o'zgargan bo'lsa AuditLog'ga yozadi va mavzu progressini qayta hisoblaydi.
 */
export async function repairShuffledAnswers(): Promise<{ fixed: number; regraded: number }> {
  const rows = await prisma.quizAttempt.findMany({
    where: { orderJson: { not: Prisma.DbNull } },
    select: {
      id: true,
      quizId: true,
      studentId: true,
      answersJson: true,
      orderJson: true,
      finishedAt: true,
      scorePct: true,
      passed: true,
      quiz: {
        select: {
          passThreshold: true,
          contentItem: { select: { topicId: true, topic: { select: { course: { select: { departmentId: true } } } } } },
        },
      },
    },
  });

  const todo = rows.filter((r) => hasShownAnswers(readOrder(r.orderJson)));
  if (todo.length === 0) return { fixed: 0, regraded: 0 };

  const passByDept = new Map<number | null, number>();
  const passByTopic = new Map<string, number>();
  const touched = new Set<string>();
  let regraded = 0;

  for (const r of todo) {
    const order = readOrder(r.orderJson)!;
    // Bu urinishlarda answersJson EKRAN indeksida saqlangan (xatoning o'zi).
    const answers = answersToOriginal(order, readAnswers(r.answersJson) as unknown as Record<string, ShownIndex>);
    const data: Record<string, unknown> = { answersJson: answers, orderJson: { ...order, v: ORDER_VERSION } };

    if (r.finishedAt) {
      // Baholash — oddiy urinishlar bilan AYNAN bir yo'l (quizGrading).
      const questions = await attemptQuestions(r, [], questionLoader(r.quizId));
      const { scorePct } = gradeAnswers(questions, answers);

      const dept = r.quiz.contentItem.topic.course.departmentId;
      if (!passByDept.has(dept)) passByDept.set(dept, (await resolvePolicy(dept)).minQuizPassedPct);
      const passKey = `${r.studentId}:${r.quiz.contentItem.topicId}`;
      if (!passByTopic.has(passKey)) {
        passByTopic.set(
          passKey,
          await quizPassPctForStudent(r.studentId, r.quiz.contentItem.topicId, Math.max(r.quiz.passThreshold, passByDept.get(dept)!))
        );
      }
      const passed = scorePct >= passByTopic.get(passKey)!;

      if (scorePct !== r.scorePct || passed !== r.passed) {
        data.scorePct = scorePct;
        data.passed = passed;
        regraded++;
        touched.add(`${r.studentId}:${r.quiz.contentItem.topicId}`);
      }

      await prisma.$transaction([
        prisma.quizAttempt.update({ where: { id: r.id }, data }),
        ...(data.scorePct !== undefined
          ? [
              prisma.auditLog.create({
                data: {
                  actorId: r.studentId,
                  action: "REGRADE_QUIZ_ATTEMPT",
                  entity: "QuizAttempt",
                  entityId: r.id,
                  detailsJson: {
                    reason: "shuffled_answer_index_bug",
                    before: { scorePct: r.scorePct, passed: r.passed },
                    after: { scorePct: data.scorePct as number, passed: data.passed as boolean },
                  },
                },
              }),
            ]
          : []),
      ]);
    } else {
      await prisma.quizAttempt.update({ where: { id: r.id }, data });
    }
  }

  // Ball o'zgargan mavzular — ochilish/tugash holati yangi ballga qarab.
  for (const key of touched) {
    const [studentId, topicId] = key.split(":").map(Number);
    await syncTopicProgress(studentId, topicId).catch((e) => console.error("[quizRepair] sync", key, e));
  }
  return { fixed: todo.length, regraded };
}
