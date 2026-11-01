// REGRESSIYA SINOVI (2026-10-31 auditi): test baholashining "bitta haqiqat"
// qoidalari buzilmaganini tekshiradi. Har band — auditda topilgan haqiqiy xato.
//
//   1. Urinish O'Z snimkasi bo'yicha baholanadi (o'qituvchi testni qayta
//      yaratsa ham) — ilgari davom etayotgan urinish bo'sh ekran + 0% edi.
//   2. "Xatolar ustida ishlash" = o'sha urinishning xato savollari — ilgari
//      talaba ko'rmagan yangi savollar talab qilinardi va qayta topshirib
//      bo'lmasdi.
//   3. Remediation endpointi "orakul" emas — ko'rilmagan savolga javob bermaydi.
//   4. Mashg'ulot va kartochka ko'rilmagan savolning to'g'ri javobini ochmaydi.
//   5. O'tish balli bitta: max(test, kafedra, kurs/mavzu qoidasi).
//   6. Keys qadami: ikkita to'g'ri variant bo'lsa ham hamma joyda bir xil hukm.
//
// MAHALLIY bazada ishlaydi; o'zgartirganini oxirida tiklaydi.
//   DATABASE_URL=postgresql://meduni:meduni@localhost:5432/meduni npx tsx src/scripts/smokeQuizIntegrity.ts
import { prisma } from "../lib/prisma";
import { buildOrder, toShownIndex } from "../modules/me/integrity";
import { finishQuizAttempt, recordRemediation, remediationStatus, saveQuizAnswers } from "../modules/me/lesson";
import { getPracticeSet } from "../modules/me/practice";
import { getFlashcards } from "../modules/me/flashcards";
import { attemptCase, isStepCorrect, readStepPicks, stepsWithSnapshot } from "../modules/me/quizGrading";
import { assertTopicOpen, quizPassPct, resolvedRuleFor, syncTopicProgress, type CourseWithTopics } from "../modules/me/service";

let pass = 0;
let fail = 0;
const ok = (c: boolean, n: string) => {
  c ? pass++ : fail++;
  console.log(`${c ? "ok" : "!!"} ${n}`);
};

async function main() {
  // ---------- Sof qoidalar ----------
  const fakeCourse = (rule: object | null, policyMin: number, quizOwn = 0) =>
    ({
      topics: [{ id: 1, unlockRuleJson: rule, contentItems: quizOwn ? [{ quiz: { passThreshold: quizOwn } }] : [] }],
      defaultUnlockRuleJson: null,
      policy: policyMin ? { minQuizPassedPct: policyMin, minVideoWatchedPct: 0 } : null,
    }) as unknown as CourseWithTopics;
  ok(quizPassPct(fakeCourse({ quizPassedPct: 85 }, 0), 1, 70) === 85, "o'tish balli: kurs qoidasi 85 > test 70 → 85");
  ok(quizPassPct(fakeCourse(null, 0), 1, 60) === 70, "o'tish balli: qoida yo'q → sukut 70");
  ok(quizPassPct(fakeCourse({ quizPassedPct: 50 }, 0), 1, 80) === 80, "o'tish balli: test 80 > qoida 50 → 80");
  // Dvigatel ham testning o'z balini biladi — natija ekrani va mavzu tugashi bir raqamdan.
  const engineRule = resolvedRuleFor(fakeCourse({ quizPassedPct: 70 }, 0, 80), 1);
  ok(engineRule.quizPassedPct === 80, "dvigatel: test o'z bali 80 > qoida 70 → mavzu 80% da tugaydi");

  const twoRight = { options: [{ correct: false }, { correct: true }, { correct: true }] };
  ok(isStepCorrect(twoRight, 2) && isStepCorrect(twoRight, 1) && !isStepCorrect(twoRight, 0), "keys: ikkala to'g'ri variant ham to'g'ri");
  ok(!isStepCorrect(twoRight, undefined) && !isStepCorrect(twoRight, 9), "keys: javobsiz/diapazondan tashqari → xato");

  // Keys snimkasi: o'qituvchi keyin keysni o'zgartirsa ham javob O'Z versiyasiga bog'liq.
  const v1 = { steps: [{ prompt: "A" }, { prompt: "B" }] };
  const v2 = { steps: [{ prompt: "B" }, { prompt: "C" }, { prompt: "A" }] };
  const stored = JSON.parse(JSON.stringify(stepsWithSnapshot({ "0": 1, "1": 0 }, v1)));
  ok(attemptCase(stored, v2) === stored.__case && attemptCase(stored, v2).steps[0].prompt === "A", "keys: javob yechilgan versiya bilan o'qiladi (tahrirdan keyin ham)");
  ok(JSON.stringify(readStepPicks(stored)) === JSON.stringify({ "0": 1, "1": 0 }), "keys: snimka tanlovlarga aralashmaydi");
  ok(attemptCase({ "0": 1 }, v2) === v2, "keys: snimkasiz eski javob → hozirgi versiya");

  // ---------- Bazadagi oqim ----------
  const student = await prisma.user.findUniqueOrThrow({ where: { email: "student@meduni.uz" } });
  const quizzes = await prisma.quiz.findMany({
    where: { contentItem: { status: "PUBLISHED" } },
    include: { contentItem: { select: { topicId: true } }, questions: { where: { retiredAt: null }, orderBy: { orderIndex: "asc" } } },
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
  const topicId = quiz.contentItem.topicId;
  const original = quiz.questions;
  console.log(`   test #${quiz.id}, ${original.length} savol, mavzu ${topicId}`);

  const createdAttempts: number[] = [];
  const createdQuestions: number[] = [];
  const retire = async () => {
    // "O'qituvchi testni qayta yaratdi": eskilar retiredAt, o'rniga yangilari.
    await prisma.question.updateMany({ where: { id: { in: original.map((q) => q.id) } }, data: { retiredAt: new Date() } });
    for (const [i, q] of original.entries()) {
      const n = await prisma.question.create({
        data: {
          quizId: quiz!.id,
          text: `[SMOKE] yangi ${i}`,
          optionsJson: q.optionsJson as object,
          correctIndex: q.correctIndex,
          explanationJson: q.explanationJson as object,
          orderIndex: 900 + i,
        },
      });
      createdQuestions.push(n.id);
    }
  };
  const restore = async () => {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestions } } });
    createdQuestions.length = 0;
    await prisma.question.updateMany({ where: { id: { in: original.map((q) => q.id) } }, data: { retiredAt: null } });
  };

  try {
    // ===== 1. Davom etayotgan urinish + test qayta yaratildi =====
    const order = buildOrder(original);
    const a = await prisma.quizAttempt.create({
      data: { quizId: quiz.id, studentId: student.id, answersJson: {}, attemptNo: 97, orderJson: { ...order } },
    });
    createdAttempts.push(a.id);
    await retire();
    const view = await saveQuizAnswers(student.id, a.id, {
      [original[0].id]: toShownIndex(order, original[0].id, original[0].correctIndex)!,
    });
    ok(view.questions.length === original.length, `qayta yaratilgandan keyin ham urinish o'z ${original.length} savolini ko'radi (keldi ${view.questions.length})`);
    for (const q of original.slice(1)) {
      await saveQuizAnswers(student.id, a.id, { [q.id]: toShownIndex(order, q.id, q.correctIndex)! });
    }
    const fin = await finishQuizAttempt(student.id, a.id);
    ok(fin.attempt.scorePct === 100, `snimka bo'yicha baho: hammasi to'g'ri → 100% (keldi ${fin.attempt.scorePct})`);
    await restore();

    // ===== 2-4. Yiqilgan urinish → test qayta yaratildi → remediation/mashg'ulot =====
    const order2 = buildOrder(original);
    const wrongQ = original[0];
    const answers: Record<string, number> = {};
    for (const q of original) answers[String(q.id)] = q.correctIndex;
    answers[String(wrongQ.id)] = (wrongQ.correctIndex + 1) % ((wrongQ.optionsJson as string[]).length || 2);
    const b = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId: student.id,
        answersJson: answers,
        attemptNo: 98,
        orderJson: { ...order2 },
        scorePct: 50,
        passed: false,
        finishedAt: new Date(Date.now() + 1000),
      },
    });
    createdAttempts.push(b.id);
    await retire();

    const rs = await remediationStatus(student.id, quiz.id);
    ok(rs.total === 1, `remediation faqat o'sha urinish xatosini so'raydi: 1 (keldi ${rs.total}; ilgari = yangi savollar soni)`);

    let oracle = 0;
    try {
      await recordRemediation(student.id, b.id, createdQuestions[1], 0);
    } catch (e) {
      oracle = (e as { status?: number }).status ?? -1;
    }
    ok(oracle === 404, `ko'rilmagan savolga remediation → 404, orakul emas (keldi ${oracle})`);

    const rec = await recordRemediation(student.id, b.id, wrongQ.id, wrongQ.correctIndex);
    ok(rec.correct && rec.done === 1 && rec.total === 1, "xato savolga to'g'ri javob → remediation bajarildi 1/1");

    const set = await getPracticeSet(student.id, topicId);
    const quizItems = set.items.filter((x) => x.kind === "quiz") as { questionId: number; attemptId: number }[];
    ok(
      quizItems.length === 1 && quizItems[0].questionId === wrongQ.id && quizItems[0].attemptId === b.id,
      `mashg'ulot faqat ko'rilgan xato savolni beradi (keldi ${quizItems.length} ta)`
    );
    ok(!quizItems.some((x) => createdQuestions.includes(x.questionId)), "mashg'ulot yangi (ko'rilmagan) savol javobini ochmaydi");

    const fc = await getFlashcards(student.id, topicId);
    const leaked = fc.cards.filter((c) => createdQuestions.some((id) => c.key === `q:${id}`));
    ok(leaked.length === 0, `kartochka ko'rilmagan savol javobini ochmaydi (sizdi ${leaked.length})`);
  } finally {
    await restore();
    await prisma.remediationAnswer.deleteMany({ where: { attemptId: { in: createdAttempts } } });
    await prisma.quizAttempt.deleteMany({ where: { id: { in: createdAttempts } } });
    await syncTopicProgress(student.id, topicId);
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
