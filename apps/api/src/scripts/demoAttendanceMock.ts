/**
 * Davomat matritsasi demosi: Kardiologiyaga 5 kun × 2-3 para haftalik jadval,
 * 8 talaba va o'tgan darslarga yo'qlama qo'yadi — matritsa to'liq ko'rinsin.
 * Ishga tushirish: npx tsx src/scripts/demoAttendanceMock.ts
 */
import { prisma } from "../lib/prisma";

function atTime(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const mondayIdx = (d: Date) => (d.getDay() + 6) % 7;

// Haftalik jadval: 5 kun (Du–Ju), 2-3 para.
const WEEK: Record<number, string[]> = {
  0: ["09:00", "11:00", "14:00"], // Dushanba — 3 para
  1: ["09:00", "11:00"],          // Seshanba — 2 para
  2: ["09:00", "11:00", "14:00"], // Chorshanba — 3 para
  3: ["09:00", "14:00"],          // Payshanba — 2 para
  4: ["09:00", "11:00", "14:00"], // Juma — 3 para
};
const ROOMS = ["204-xona", "301-xona", "205-xona"];

// Talabalar (Talaba + 7 ta yangi) va davomat "xulqi": keladi ehtimoli.
const NEW_STUDENTS = [
  ["Aziz Karimov", "aziz.k"], ["Dilnoza Yusupova", "dilnoza.y"], ["Sardor Aliyev", "sardor.a"],
  ["Malika Rashidova", "malika.r"], ["Jasur Bobojonov", "jasur.b"], ["Nigora Umarova", "nigora.u"],
  ["Bekzod Fayzullaev", "bekzod.f"],
];

async function main() {
  const teacher = await prisma.user.findFirstOrThrow({ where: { email: "teacher.m11demo@meduni.uz" } });
  const cardio = await prisma.course.findFirstOrThrow({ where: { name: "Kardiologiya", teacherId: teacher.id } });
  const cg = await prisma.courseGroup.findFirstOrThrow({ where: { courseId: cardio.id } });
  const groupId = cg.groupId;

  // Parol hash'ini mavjud talabadan olamiz (yangi talabalar login qila oladi).
  const sample = await prisma.user.findFirstOrThrow({ where: { role: "STUDENT", groupId } });

  // 1) Talabalar — 8 ta bo'lsin.
  for (const [fullName, handle] of NEW_STUDENTS) {
    const email = `${handle}@meduni.uz`;
    const u = await prisma.user.upsert({
      where: { email },
      update: { groupId, isActive: true },
      create: { email, fullName, role: "STUDENT", groupId, passwordHash: sample.passwordHash, isActive: true },
    });
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: u.id, courseId: cardio.id } },
      update: { status: "ACTIVE" },
      create: { courseId: cardio.id, studentId: u.id, status: "ACTIVE" },
    });
  }
  const students = await prisma.user.findMany({ where: { role: "STUDENT", groupId }, orderBy: { fullName: "asc" } });
  // Har talabaga "kelish ehtimoli" (%): matritsada foizlar turlicha chiqsin.
  const profile = new Map(students.map((s, i) => [s.id, [0.97, 0.9, 0.82, 0.7, 0.6][i % 5]]));

  // 2) Haftalik jadval — eski slotlarni almashtiramiz.
  await prisma.scheduleSlot.deleteMany({ where: { courseId: cardio.id } });
  let ri = 0;
  for (const wdStr of Object.keys(WEEK)) {
    const wd = Number(wdStr);
    for (const time of WEEK[wd]) {
      await prisma.scheduleSlot.create({ data: { courseId: cardio.id, groupId, weekday: wd, startTime: time, room: ROOMS[ri++ % ROOMS.length] } });
    }
  }

  // 3) Sikl davri — matritsa oralig'ini qamrasin (2 hafta ortga, bir necha oldinga).
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - 14);
  const end = new Date(now); end.setDate(now.getDate() + 21);
  await prisma.courseGroup.update({ where: { id: cg.id }, data: { cycleStart: start, cycleEnd: end } });

  // 4) O'tgan darslarga yo'qlama. Eski sessiya/attendance'ni tozalaymiz.
  const oldSessions = await prisma.lessonSession.findMany({ where: { courseId: cardio.id, groupId }, select: { id: true } });
  await prisma.attendance.deleteMany({ where: { sessionId: { in: oldSessions.map((s) => s.id) } } });
  await prisma.lessonSession.deleteMany({ where: { courseId: cardio.id, groupId } });

  const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
  let lessons = 0, marks = 0;
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const wd = mondayIdx(d);
    const times = WEEK[wd];
    if (!times) continue;
    const dk = dayKey(d);
    for (const time of times) {
      const when = atTime(dk, time);
      if (when > now) continue; // kelajakdagi dars — belgilanmaydi
      // Oxirgi kunni ataylab belgilanmagan qoldiramiz (aralash ko'rinishi uchun).
      if (dk === dayKey(now)) continue;
      const session = await prisma.lessonSession.create({ data: { courseId: cardio.id, groupId, date: when, createdById: teacher.id } });
      lessons++;
      for (const s of students) {
        const p = profile.get(s.id)!;
        const r = Math.random();
        let status: (typeof STATUSES)[number];
        if (r < p) status = "PRESENT";
        else if (r < p + 0.06) status = "LATE";
        else if (r < p + 0.1) status = "EXCUSED";
        else status = "ABSENT";
        await prisma.attendance.create({ data: { sessionId: session.id, studentId: s.id, status, markedById: teacher.id } });
        marks++;
      }
    }
  }

  const wdN = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
  console.log(`✅ Kardiologiya davomat mock:`);
  console.log(`   Talabalar: ${students.length}`);
  console.log(`   Haftalik jadval: ${Object.entries(WEEK).map(([w, ts]) => `${wdN[+w]} ${ts.join("/")}`).join(" · ")}`);
  console.log(`   Sikl: ${dayKey(start)} … ${dayKey(end)}`);
  console.log(`   Belgilangan darslar: ${lessons}, yozuvlar: ${marks}`);
  console.log(`   (bugungi darslar ataylab belgilanmagan — "—" katakchalar ko'rinsin)`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
