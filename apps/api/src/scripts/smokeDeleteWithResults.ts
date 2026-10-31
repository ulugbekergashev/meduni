// Sinov (2026-10-31, buyurtmachi): mavzu va kurs talabalar natijasi/davomati
// bo'lsa ham o'chadi; o'chirishdan oldin ta'sir aniq sanaladi; audit yoziladi.
// MAHALLIY bazada: o'z kursini yaratadi va oxirida o'zi o'chiradi.
import { prisma } from "../lib/prisma";
import { courseDeleteImpact, deleteCourse } from "../modules/courses/service";
import { deleteTopic, topicDeleteImpact } from "../modules/topics/service";

let pass = 0;
let fail = 0;
const ok = (c: boolean, n: string) => {
  c ? pass++ : fail++;
  console.log(`${c ? "ok" : "!!"} ${n}`);
};

async function topicWithResult(courseId: number, title: string, studentIds: number[]) {
  const topic = await prisma.topic.create({ data: { courseId, title, orderIndex: 900 } });
  const item = await prisma.contentItem.create({ data: { topicId: topic.id, kind: "QUIZ", language: "uz", status: "PUBLISHED" } });
  const quiz = await prisma.quiz.create({ data: { contentItemId: item.id } });
  const q = await prisma.question.create({
    data: { quizId: quiz.id, text: "?", optionsJson: ["a", "b"], correctIndex: 0, explanationJson: ["", ""], orderIndex: 0 },
  });
  for (const sid of studentIds) {
    await prisma.quizAttempt.create({
      data: { quizId: quiz.id, studentId: sid, answersJson: { [q.id]: 0 }, attemptNo: 1, scorePct: 100, passed: true, finishedAt: new Date() },
    });
    await prisma.progress.create({ data: { studentId: sid, topicId: topic.id, state: "COMPLETED", completedAt: new Date() } });
  }
  return topic;
}

async function main() {
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher.m11demo@meduni.uz" } });
  const students = await prisma.user.findMany({ where: { role: "STUDENT" }, take: 2, select: { id: true } });
  const dept = await prisma.teacherProfile.findFirstOrThrow({ where: { userId: teacher.id } });
  const course = await prisma.course.create({
    data: { name: "[SMOKE] delete", departmentId: dept.departmentId, teacherId: teacher.id, semester: 1, academicYear: "2026/2027" },
  });
  let courseGone = false;
  try {
    // ---------- Mavzu ----------
    const t1 = await topicWithResult(course.id, "[SMOKE] mavzu", students.map((s) => s.id));
    const imp = await topicDeleteImpact(t1.id, teacher.id);
    ok(imp.students === students.length && imp.quizAttempts === students.length, `ta'sir: ${imp.students} talaba, ${imp.quizAttempts} urinish`);
    await deleteTopic(t1.id, teacher.id);
    ok((await prisma.topic.findUnique({ where: { id: t1.id } })) === null, "natijali mavzu O'CHDI (ilgari 409)");
    ok((await prisma.progress.count({ where: { topicId: t1.id } })) === 0, "progress ham o'chdi");
    const a1 = await prisma.auditLog.findFirst({ where: { action: "DELETE_TOPIC", entityId: t1.id }, orderBy: { id: "desc" } });
    const removed = (a1?.detailsJson as { removedResults?: { quizAttempts?: number } } | null)?.removedResults;
    ok(removed?.quizAttempts === students.length, "audit: nima o'chgani yozildi");

    // Begona o'qituvchi o'chira olmaydi.
    const t2 = await topicWithResult(course.id, "[SMOKE] begona", []);
    const other = await prisma.user.findFirst({ where: { role: "TEACHER", id: { not: teacher.id } } });
    if (other) {
      let code = 0;
      try { await deleteTopic(t2.id, other.id); } catch (e) { code = (e as { status?: number }).status ?? -1; }
      ok(code === 403, `begona o'qituvchi → 403 (keldi ${code})`);
    }

    // ---------- Kurs (davomat bilan) ----------
    await topicWithResult(course.id, "[SMOKE] kurs mavzusi", [students[0].id]);
    const session = await prisma.lessonSession.create({ data: { courseId: course.id, date: new Date(), createdById: teacher.id } });
    await prisma.attendance.create({ data: { sessionId: session.id, studentId: students[0].id, status: "PRESENT", markedById: teacher.id } });
    const cimp = await courseDeleteImpact(course.id);
    ok(cimp.attendance === 1 && cimp.quizAttempts === 1, `kurs ta'siri: ${cimp.quizAttempts} urinish, ${cimp.attendance} davomat`);
    await deleteCourse(course.id, teacher.id);
    courseGone = (await prisma.course.findUnique({ where: { id: course.id } })) === null;
    ok(courseGone, "davomatli + natijali kurs O'CHDI (ilgari 409)");
    ok((await prisma.attendance.count({ where: { sessionId: session.id } })) === 0, "davomat belgilari ham o'chdi");
  } finally {
    if (!courseGone) await deleteCourse(course.id).catch((e) => console.error("tozalash:", e));
    await prisma.auditLog.deleteMany({ where: { actorId: teacher.id, action: { in: ["DELETE_TOPIC", "DELETE_COURSE"] }, createdAt: { gte: new Date(Date.now() - 600_000) } } });
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
