// Sinov: aralashtirilgan variantlarda to'g'ri javob to'g'ri baholanadimi
// (2026-10-31 xatosi) + eski urinishlarni tuzatish (quizRepair.ts).
// MAHALLIY bazada ishlaydi; o'zi yaratgan urinish/audit yozuvlarini o'chiradi.
import { prisma } from "../lib/prisma";
import { buildOrder, readOrder, toOriginalIndex, toShownIndex } from "../modules/me/integrity";
import { finishQuizAttempt, saveQuizAnswers } from "../modules/me/lesson";
import { repairShuffledAnswers } from "../modules/me/quizRepair";
import { assertTopicOpen, syncTopicProgress } from "../modules/me/service";

let pass = 0;
let fail = 0;
const ok = (c: boolean, n: string) => {
  c ? pass++ : fail++;
  console.log(`${c ? "ok" : "!!"} ${n}`);
};

async function main() {
  // 1) Sof mantiq: ekran ↔ asl o'girish o'zaro teskari.
  const fake = Array.from({ length: 20 }, (_, i) => ({ id: 1000 + i, optionsJson: ["a", "b", "c", "d"] }));
  const o = buildOrder(fake);
  ok(o.v === 2, "yangi tartib v:2 belgisi bilan");
  ok(
    fake.every((q) => [0, 1, 2, 3].every((orig) => toOriginalIndex(o, q.id, toShownIndex(o, q.id, orig)!) === orig)),
    "toOriginalIndex(toShownIndex(x)) === x (80 holat)"
  );
  ok(readOrder(JSON.parse(JSON.stringify(o)))?.v === 2, "v belgisi JSON orqali saqlanadi");

  // 2) Talabaga ochiq, chop etilgan testni topamiz.
  const student = await prisma.user.findUniqueOrThrow({ where: { email: "student@meduni.uz" } });
  const quizzes = await prisma.quiz.findMany({
    where: { contentItem: { status: "PUBLISHED" } },
    include: { contentItem: { select: { topicId: true } }, questions: { where: { retiredAt: null } } },
  });
  let quiz: (typeof quizzes)[number] | null = null;
  for (const q of quizzes) {
    if (q.questions.length < 3) continue;
    try {
      await assertTopicOpen(student.id, q.contentItem.topicId);
      quiz = q;
      break;
    } catch {
      /* yopiq mavzu */
    }
  }
  if (!quiz) throw new Error("talabaga ochiq test topilmadi");
  console.log(`   test #${quiz.id}, ${quiz.questions.length} savol, mavzu ${quiz.contentItem.topicId}`);

  const created: number[] = [];
  try {
    // 3) YANGI urinish: har savolga TO'G'RI variantni ekran tartibida bosamiz.
    const order = buildOrder(quiz.questions);
    const a = await prisma.quizAttempt.create({
      data: { quizId: quiz.id, studentId: student.id, answersJson: {}, attemptNo: 99, orderJson: { ...order } },
    });
    created.push(a.id);
    const permuted = quiz.questions.some((q) => order.opt[String(q.id)].some((v, i) => v !== i));
    ok(permuted, "variantlar haqiqatan aralashtirilgan");
    for (const q of quiz.questions) {
      await saveQuizAnswers(student.id, a.id, { [q.id]: toShownIndex(order, q.id, q.correctIndex)! });
    }
    const saved = (await prisma.quizAttempt.findUniqueOrThrow({ where: { id: a.id } })).answersJson as Record<string, number>;
    ok(
      quiz.questions.every((q) => saved[String(q.id)] === q.correctIndex),
      "bazada ASL indeks saqlandi (to'g'ri javob = correctIndex)"
    );
    const res = await finishQuizAttempt(student.id, a.id);
    ok(res.attempt.scorePct === 100, `hammasi to'g'ri → 100% (keldi ${res.attempt.scorePct})`);
    ok(
      res.attempt.questions.every((q) => "studentAnswer" in q && q.studentAnswer === q.correctIndex),
      "tahlilda 'sizning javobingiz' = yashil variant"
    );

    // 4) ESKI (buzilgan) urinish: v belgisiz, ekran indeksi saqlangan, ball noto'g'ri.
    const oldOrder = buildOrder(quiz.questions);
    const legacyOrder = { q: oldOrder.q, opt: oldOrder.opt }; // v yo'q
    const shownAnswers = Object.fromEntries(
      quiz.questions.map((q) => [String(q.id), toShownIndex(oldOrder, q.id, q.correctIndex)!])
    );
    const b = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId: student.id,
        answersJson: shownAnswers,
        attemptNo: 98,
        orderJson: legacyOrder,
        scorePct: 20,
        passed: false,
        finishedAt: new Date(),
      },
    });
    created.push(b.id);
    const r1 = await repairShuffledAnswers();
    const fixed = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: b.id } });
    ok(r1.fixed >= 1, `tuzatish ishladi (${r1.fixed} urinish)`);
    ok(fixed.scorePct === 100 && fixed.passed, `eski urinish qayta baholandi: 20% → ${fixed.scorePct}%`);
    ok(readOrder(fixed.orderJson)?.v === 2, "belgi qo'yildi");
    const audit = await prisma.auditLog.findFirst({ where: { action: "REGRADE_QUIZ_ATTEMPT", entityId: b.id } });
    ok(!!audit, "AuditLog'ga yozildi");

    const r2 = await repairShuffledAnswers();
    const again = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: b.id } });
    ok(r2.fixed === 0 && again.scorePct === 100, "takror ishga tushsa hech narsa o'zgarmaydi");
  } finally {
    await prisma.auditLog.deleteMany({ where: { action: "REGRADE_QUIZ_ATTEMPT", entityId: { in: created } } });
    await prisma.quizAttempt.deleteMany({ where: { id: { in: created } } });
    await syncTopicProgress(student.id, quiz.contentItem.topicId);
  }

  console.log(`\n${pass}/${pass + fail}`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
