/**
 * Sana-rejimi demosi: Kardiologiya kursini DARS JADVALI bo'yicha ochilishga
 * o'tkazadi va mavzularga dars sessiyalarini bog'laydi. Foydalanuvchi ssenariysi:
 *   - 1-mavzu (Yurak anatomiyasi) — 1 dars (o'tgan) → OCHIQ.
 *   - 2-mavzu (Yurak fiziologiyasi) — 2 dars (biri o'tgan, oxirgisi KELAJAKDA)
 *     → oxirgi dars kunidan keyin ochiladi (hozircha QULF).
 * Ishga tushirish:  npx tsx src/scripts/demoSchedule.ts
 */
import { prisma } from "../lib/prisma";
import { loadCourse, studentFactsMap, computeTopics } from "../modules/me/service";

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  const teacher = await prisma.user.findFirstOrThrow({ where: { email: "teacher.m11demo@meduni.uz" } });
  const student = await prisma.user.findFirstOrThrow({ where: { email: "student@meduni.uz" } });
  const course = await prisma.course.findFirstOrThrow({ where: { name: "Kardiologiya", teacherId: teacher.id } });
  const topics = await prisma.topic.findMany({ where: { courseId: course.id }, orderBy: { orderIndex: "asc" } });
  const anatomy = topics.find((t) => t.title.includes("anatomiya"))!;
  const fizio = topics.find((t) => t.title.includes("fiziologiya"))!;

  // Sana-rejimini yoqamiz
  await prisma.course.update({ where: { id: course.id }, data: { scheduleUnlock: true } });

  // Eski demo sessiyalarni tozalab, ssenariy bo'yicha qayta yaratamiz
  await prisma.attendance.deleteMany({ where: { session: { courseId: course.id } } });
  await prisma.lessonSession.deleteMany({ where: { courseId: course.id } });

  const mk = (topicId: number, days: number, title: string) =>
    prisma.lessonSession.create({
      data: { courseId: course.id, topicId, date: daysFromNow(days), title, room: "204-xona", createdById: teacher.id },
    });

  await mk(anatomy.id, -4, "Yurak anatomiyasi — ma'ruza"); // o'tgan → mavzu ochiq
  await mk(fizio.id, -2, "Yurak fiziologiyasi — 1-dars"); // o'tgan
  await mk(fizio.id, +4, "Yurak fiziologiyasi — 2-dars"); // KELAJAK → mavzu hali qulf

  // Tekshiruv: sana-rejimida holatlar
  const loaded = await loadCourse(course.id);
  const facts = await studentFactsMap(student.id, loaded);
  const computed = computeTopics(loaded, facts);
  console.log("\n=== SANA-REJIMI (scheduleUnlock=true) ===");
  for (const t of computed) {
    console.log(`  ${t.orderIndex}. ${t.title}: ${t.state}${t.reason ? ` — ${t.reason.uz}` : ""}`);
  }

  // Taqqoslash: rejimni o'chirib, ketma-ketlik holatini ko'rsatamiz
  const seqCourse = { ...loaded, scheduleDates: null };
  const seq = computeTopics(seqCourse, facts);
  console.log("\n=== KETMA-KETLIK (scheduleUnlock=false) — taqqoslash uchun ===");
  for (const t of seq) {
    console.log(`  ${t.orderIndex}. ${t.title}: ${t.state}${t.reason ? ` — ${t.reason.uz}` : ""}`);
  }

  console.log("\nJadval:");
  const sessions = await prisma.lessonSession.findMany({ where: { courseId: course.id }, orderBy: { date: "asc" }, include: { topic: true } });
  for (const s of sessions) {
    console.log(`  ${s.date.toISOString().slice(0, 10)} · ${s.topic?.title ?? "—"} · ${s.title}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
