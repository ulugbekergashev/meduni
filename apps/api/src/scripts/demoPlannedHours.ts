// DEMO: o'quv rejasidagi auditoriya soatini kurslarga yozadi.
// ⚠️ 25 % limitining MAXRAJI shu (VM №824). Haqiqiy vuzda admin kiritadi;
// bu skript faqat demo bazani ma'noli qilish uchun.
//   npx tsx src/scripts/demoPlannedHours.ts
import { prisma } from "../lib/prisma";

/** Nomga qarab tipik o'quv yuklamasi (akademik soat). */
const HOURS: Record<string, number> = { Kardiologiya: 72, Nefrologiya: 54 };
const DEFAULT_HOURS = 72;

async function main() {
  const courses = await prisma.course.findMany({ select: { id: true, name: true, plannedHours: true } });
  let n = 0;
  for (const c of courses) {
    if (c.plannedHours != null) continue;
    const hours = HOURS[c.name] ?? DEFAULT_HOURS;
    await prisma.course.update({ where: { id: c.id }, data: { plannedHours: hours } });
    console.log(`  ${c.name}: plannedHours = ${hours}`);
    n++;
  }
  console.log(`\n${n} ta kursga reja soati yozildi (jami ${courses.length}).`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
