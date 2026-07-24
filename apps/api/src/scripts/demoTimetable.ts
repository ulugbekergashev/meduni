/**
 * Demo haftalik jadval: Kardiologiya kursiga takroriy slotlar qo'yadi —
 * darslar avtomatik hosil bo'ladi. Bugun ham dars bo'lsin (dashboard ko'rsatadi).
 * Ishga tushirish: npx tsx src/scripts/demoTimetable.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  const teacher = await prisma.user.findFirstOrThrow({ where: { email: "teacher.m11demo@meduni.uz" } });
  const cardio = await prisma.course.findFirstOrThrow({ where: { name: "Kardiologiya", teacherId: teacher.id } });
  const cg = await prisma.courseGroup.findFirstOrThrow({ where: { courseId: cardio.id } });
  const groupId = cg.groupId; // 301-guruh

  await prisma.scheduleSlot.deleteMany({ where: { courseId: cardio.id } });

  const todayWeekday = (new Date().getDay() + 6) % 7; // 0=Dushanba
  const slots = [
    { weekday: todayWeekday, startTime: "09:00", room: "204-xona" }, // bugun
    { weekday: (todayWeekday + 2) % 7, startTime: "14:00", room: "301-xona" },
    { weekday: (todayWeekday + 4) % 7, startTime: "11:00", room: "204-xona" },
  ];
  // Dublikatga tushmaslik uchun unique kun-vaqt; slotlar 301-guruhga bog'lanadi
  const seen = new Set<string>();
  for (const s of slots) {
    const k = `${s.weekday}:${s.startTime}`;
    if (seen.has(k)) continue;
    seen.add(k);
    await prisma.scheduleSlot.create({ data: { courseId: cardio.id, groupId, ...s } });
  }

  const wd = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
  const list = await prisma.scheduleSlot.findMany({ where: { courseId: cardio.id }, orderBy: { weekday: "asc" } });
  console.log("✅ Kardiologiya haftalik jadvali:");
  for (const s of list) console.log(`   ${wd[s.weekday]} ${s.startTime} · ${s.room}`);
  console.log("   (bugun dars bor — dashboard 'Bugungi mashg'ulotlar' ko'rsatadi)");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
