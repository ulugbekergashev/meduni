// Guruh xatolari xaritasi (Modul 28 Faza 1) — o'qituvchi kursdagi barcha
// talabalarning xato-signallarini savol/qadam darajasida ko'radi.
//
// MUHIM assotsiatsiya: mezonlar talaba tomonidagi "Xatolar ustida ishlash"
// (me/practice.ts::topicMistakes) bilan BIR XIL — har talabaning OXIRGI
// YAKUNLANGAN test urinishi + topshirilgan keys qadamlari. Shu tufayli
// o'qituvchi xaritada ko'rgan raqam talabaning mashq to'plami bilan mos keladi.
import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";

function forbidden() {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}

interface WrongStudent {
  id: number;
  fullName: string;
}

export async function getCourseMistakes(courseId: number, teacherId: number) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      topics: {
        orderBy: { orderIndex: "asc" },
        include: {
          contentItems: {
            where: { status: "PUBLISHED", kind: { in: ["QUIZ", "CASE"] } },
            include: {
              quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
              clinicalCase: true,
            },
          },
        },
      },
      enrollments: { where: { status: "ACTIVE" }, include: { student: { select: { id: true, fullName: true } } } },
    },
  });
  if (!course) throw notFound("Kurs");
  if (course.teacherId !== teacherId) throw forbidden();

  const students = course.enrollments.map((e) => e.student);
  const studentIds = students.map((s) => s.id);
  const nameById = new Map(students.map((s) => [s.id, s.fullName]));
  if (studentIds.length === 0) return { topics: [], studentCount: 0 };

  const quizIds = course.topics
    .flatMap((t) => t.contentItems)
    .filter((c) => c.kind === "QUIZ" && c.quiz)
    .map((c) => c.quiz!.id);
  const caseIds = course.topics
    .flatMap((t) => t.contentItems)
    .filter((c) => c.kind === "CASE" && c.clinicalCase)
    .map((c) => c.clinicalCase!.id);

  // Har talabaning OXIRGI yakunlangan urinishi (quiz bo'yicha) — bitta batch.
  const attempts = quizIds.length
    ? await prisma.quizAttempt.findMany({
        where: { quizId: { in: quizIds }, studentId: { in: studentIds }, finishedAt: { not: null } },
        orderBy: { attemptNo: "desc" },
        select: { quizId: true, studentId: true, answersJson: true, attemptNo: true },
      })
    : [];
  const latestByStudentQuiz = new Map<string, Record<string, number>>();
  for (const a of attempts) {
    const k = `${a.quizId}:${a.studentId}`;
    if (!latestByStudentQuiz.has(k)) latestByStudentQuiz.set(k, (a.answersJson as Record<string, number>) ?? {});
  }

  // Keys javoblari — bitta batch.
  const caseAttempts = caseIds.length
    ? await prisma.caseAttempt.findMany({
        where: { caseId: { in: caseIds }, studentId: { in: studentIds } },
        select: { caseId: true, studentId: true, stepsJson: true },
      })
    : [];
  const caseByStudent = new Map<string, Record<string, number>>();
  for (const a of caseAttempts) {
    caseByStudent.set(`${a.caseId}:${a.studentId}`, (a.stepsJson as Record<string, number>) ?? {});
  }

  // "Bilmayman" kartalar — mavzu kesimida jami (guruh bo'ylab).
  const topicIds = course.topics.map((t) => t.id);
  const unknown = topicIds.length
    ? await prisma.flashcardReview.groupBy({
        by: ["topicId"],
        where: { topicId: { in: topicIds }, studentId: { in: studentIds }, known: false },
        _count: { _all: true },
      })
    : [];
  const unknownByTopic = new Map(unknown.map((u) => [u.topicId, u._count._all]));

  const topics = course.topics
    .map((topic) => {
      const quizItem = topic.contentItems.find((c) => c.kind === "QUIZ")?.quiz ?? null;
      const caseItem = topic.contentItems.find((c) => c.kind === "CASE")?.clinicalCase ?? null;

      // ---- Test savollari ----
      let quizBlock: {
        attempted: number;
        questions: {
          questionId: number;
          text: string;
          options: string[];
          correctIndex: number;
          wrongCount: number;
          wrongPct: number;
          /** Har variant nechta marta tanlangani (+oxirida javobsizlar). */
          distribution: number[];
          noAnswer: number;
          wrongStudents: WrongStudent[];
        }[];
      } | null = null;

      if (quizItem) {
        const answersPerStudent = studentIds
          .map((sid) => ({ sid, answers: latestByStudentQuiz.get(`${quizItem.id}:${sid}`) }))
          .filter((x): x is { sid: number; answers: Record<string, number> } => x.answers !== undefined);
        const attempted = answersPerStudent.length;
        if (attempted > 0) {
          quizBlock = {
            attempted,
            questions: quizItem.questions.map((q) => {
              const options = (q.optionsJson as string[]) ?? [];
              const distribution = options.map(() => 0);
              let noAnswer = 0;
              const wrongStudents: WrongStudent[] = [];
              for (const { sid, answers } of answersPerStudent) {
                const your = answers[String(q.id)];
                if (Number.isInteger(your) && your >= 0 && your < options.length) distribution[your]++;
                else noAnswer++;
                if (your !== q.correctIndex) {
                  wrongStudents.push({ id: sid, fullName: nameById.get(sid) ?? "—" });
                }
              }
              const wrongCount = wrongStudents.length;
              return {
                questionId: q.id,
                text: q.text,
                options,
                correctIndex: q.correctIndex,
                wrongCount,
                wrongPct: Math.round((wrongCount / attempted) * 100),
                distribution,
                noAnswer,
                wrongStudents,
              };
            }),
          };
        }
      }

      // ---- Keys qadamlari ----
      let caseBlock: {
        submitted: number;
        steps: {
          index: number;
          title: string;
          prompt: string;
          options: { text: string; correct: boolean }[];
          wrongCount: number;
          wrongPct: number;
          distribution: number[];
          wrongStudents: WrongStudent[];
        }[];
      } | null = null;

      if (caseItem) {
        const caseJson = caseItem.caseJson as unknown as {
          steps?: { title: string; prompt: string; options: { text: string; correct: boolean }[] }[];
        };
        const steps = caseJson.steps ?? [];
        const perStudent = studentIds
          .map((sid) => ({ sid, picked: caseByStudent.get(`${caseItem.id}:${sid}`) }))
          .filter((x): x is { sid: number; picked: Record<string, number> } => x.picked !== undefined);
        const submitted = perStudent.length;
        if (submitted > 0 && steps.length > 0) {
          caseBlock = {
            submitted,
            steps: steps.map((s, si) => {
              const correctIdx = s.options.findIndex((o) => o.correct);
              const distribution = s.options.map(() => 0);
              const wrongStudents: WrongStudent[] = [];
              for (const { sid, picked } of perStudent) {
                const your = picked[String(si)];
                if (Number.isInteger(your) && your >= 0 && your < s.options.length) distribution[your]++;
                if (your !== correctIdx) wrongStudents.push({ id: sid, fullName: nameById.get(sid) ?? "—" });
              }
              return {
                index: si,
                title: s.title,
                prompt: s.prompt,
                options: s.options.map((o) => ({ text: o.text, correct: o.correct })),
                wrongCount: wrongStudents.length,
                wrongPct: Math.round((wrongStudents.length / submitted) * 100),
                distribution,
                wrongStudents,
              };
            }),
          };
        }
      }

      // Mavzu og'irligi — savol/qadam xato% larining o'rtachasi.
      const pcts = [
        ...(quizBlock?.questions.map((q) => q.wrongPct) ?? []),
        ...(caseBlock?.steps.map((s) => s.wrongPct) ?? []),
      ];
      const severity = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;

      return {
        topicId: topic.id,
        title: topic.title,
        orderIndex: topic.orderIndex,
        quiz: quizBlock,
        case: caseBlock,
        unknownCards: unknownByTopic.get(topic.id) ?? 0,
        severity,
      };
    })
    // Faqat signal bor mavzular; eng og'iri tepada.
    .filter((t) => t.quiz || t.case || t.unknownCards > 0)
    .sort((a, b) => b.severity - a.severity);

  return { topics, studentCount: studentIds.length };
}
