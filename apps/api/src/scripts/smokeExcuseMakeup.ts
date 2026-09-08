// DAVOMAT 2.0 · F3 — PROPUSK HAYOT SIKLI (spravka + otrabotka).
//
// Tekshiriladi: propusk endi boshi berk ko'cha emas.
//   1. Amaliy darsni qoldirsa — OTRABOTKA avtomatik paydo bo'ladi (siyosat bo'yicha).
//   2. Ma'ruza uchun otrabotka YARATILMAYDI (siyosat PRACTICE).
//   3. Talaba topshiradi → o'qituvchi navbatida ko'radi → qabul qiladi.
//   4. Qabul qilingan otrabotka sababsiz soatni YOPADI (koridor bo'shashadi).
//   5. Spravka arizasi tasdiqlansa — propusklar SABABLIga aylanadi + o'zgarish jurnali.
//
// ⚠️ Test o'z ma'lumotini yaratadi va OXIRIDA O'CHIRADI (jonli baza).
//   npx tsx src/scripts/smokeExcuseMakeup.ts
import { prisma } from "../lib/prisma";
import { dayKey } from "../lib/time";
import { attendanceLimits } from "../modules/attendance/facts";
import { createExcuse, ensureMakeups, excuseQueue, myMakeups, reviewExcuse, reviewMakeup, submitMakeup, teacherMakeupQueue } from "../modules/attendance/excuse";

const TAG = "ZZ-F3-SMOKE";
let ok = 0;
let fail = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) {
    ok++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? ` — got: ${JSON.stringify(got)}` : ""}`);
  }
}

const created = { facultyId: 0, groupId: 0, studentId: 0, courseId: 0 };

async function main() {
  console.log("\nDAVOMAT F3 — spravka va otrabotka\n");

  const teacher = await prisma.user.findFirstOrThrow({
    where: { role: "TEACHER", teacherProfile: { isNot: null } },
    include: { teacherProfile: true },
  });
  const faculty = await prisma.faculty.create({ data: { name: `${TAG} fakultet` } });
  created.facultyId = faculty.id;
  const group = await prisma.studentGroup.create({ data: { facultyId: faculty.id, name: `${TAG}-501`, yearOfStudy: 5 } });
  created.groupId = group.id;
  const student = await prisma.user.create({
    data: { fullName: `${TAG} Talaba`, email: `${TAG.toLowerCase()}@test.local`, passwordHash: "x", role: "STUDENT", groupId: group.id },
  });
  created.studentId = student.id;
  const course = await prisma.course.create({
    data: {
      name: `${TAG} kurs`,
      departmentId: teacher.teacherProfile!.departmentId,
      teacherId: teacher.id,
      semester: 1,
      academicYear: "2026/2027",
      format: "CYCLE",
      plannedHours: 40,
      courseGroups: { create: { groupId: group.id } },
      enrollments: { create: { studentId: student.id, status: "ACTIVE" } },
    },
  });
  created.courseId = course.id;

  // Ikki dars: AMALIY (otrabotka kerak) va MA'RUZA (kerak emas).
  const d1 = new Date();
  d1.setDate(d1.getDate() - 5);
  d1.setHours(9, 0, 0, 0);
  const d2 = new Date();
  d2.setDate(d2.getDate() - 4);
  d2.setHours(11, 0, 0, 0);
  const practice = await prisma.lessonSession.create({
    data: { courseId: course.id, groupId: group.id, date: d1, createdById: teacher.id, lessonType: "PRACTICE", hours: 2, status: "HELD" },
  });
  const lecture = await prisma.lessonSession.create({
    data: { courseId: course.id, groupId: group.id, date: d2, createdById: teacher.id, lessonType: "LECTURE", hours: 2, status: "HELD" },
  });
  await prisma.attendance.createMany({
    data: [
      { sessionId: practice.id, studentId: student.id, status: "ABSENT", markedById: teacher.id },
      { sessionId: lecture.id, studentId: student.id, status: "ABSENT", markedById: teacher.id },
    ],
  });

  const corridor = { maxUnexcusedPct: 25, warnUnexcusedPct: 10, makeupClearsAbsence: true };
  const limitsOf = async () => (await attendanceLimits({ studentIds: [student.id], courseId: course.id, groupId: group.id, plannedHours: 40, corridor })).get(student.id)!;

  // ---------- 1. Otrabotka avtomatik ----------
  console.log("1) Otrabotka — siyosat bo'yicha faqat amaliyga");
  await ensureMakeups(student.id);
  const mine = (await myMakeups(student.id)).filter((m) => m.courseId === course.id);
  check("bitta otrabotka yaratildi", mine.length === 1, mine.map((m) => `${m.lessonType}/${m.kind}/${m.status}`));
  check("u AMALIY dars uchun", mine[0]?.lessonType === "PRACTICE", mine[0]?.lessonType);
  check("ma'ruzaga otrabotka yo'q", !mine.some((m) => m.lessonType === "LECTURE"));
  check("muddat qo'yilgan", !!mine[0]?.dueAt, mine[0]?.dueAt);
  check("mavzusiz dars → IN_PERSON", mine[0]?.kind === "IN_PERSON", mine[0]?.kind);

  const before = await limitsOf();
  check("boshida sababsiz 4 soat", before.unexcusedHours === 4, before.unexcusedHours);
  check("limit 10 soat (40 ning 25 %)", before.limitHours === 10, before.limitHours);

  // ---------- 2. Topshirish → navbat → qabul ----------
  console.log("\n2) Topshirish → o'qituvchi navbati → qabul");
  await submitMakeup(student.id, mine[0]!.id);
  const queue = (await teacherMakeupQueue(teacher.id)).filter((m) => m.courseId === course.id);
  check("o'qituvchi navbatida ko'rindi", queue.length === 1, queue.length);
  check("talaba ismi bilan", queue[0]?.studentName.includes(TAG), queue[0]?.studentName);

  await reviewMakeup(teacher.id, mine[0]!.id, { accept: true, comment: "qabul" });
  const after = await limitsOf();
  check("qabul qilingach sababsiz 2 soat qoldi", after.unexcusedHours === 2, after.unexcusedHours);
  check("yopilgan soat ko'rinadi", after.makeupClosedHours === 2, after.makeupClosedHours);
  check("qolgan soat oshdi", after.remainingHours === 8, { before: before.remainingHours, after: after.remainingHours });

  // ---------- 3. Spravka arizasi ----------
  console.log("\n3) Spravka arizasi → dekanat tasdiqlaydi");
  const req = await createExcuse(student.id, {
    fromDate: dayKey(d2),
    toDate: dayKey(d2),
    reason: "ILLNESS",
    note: "095 forma",
  });
  check("ariza qamragan propusk soni ko'rsatildi", req.matched === 1, req.matched);
  const q = (await excuseQueue({ status: "PENDING" })).filter((r) => r.id === req.id);
  check("dekanat navbatida ko'rindi", q.length === 1, q.length);
  check("talaba va guruh ko'rinadi", q[0]?.studentName.includes(TAG) && q[0]?.groupName?.includes(TAG), { s: q[0]?.studentName, g: q[0]?.groupName });

  const res = await reviewExcuse(teacher.id, req.id, { approve: true, comment: "spravka qabul qilindi" });
  check("bitta propusk sababliga aylandi", res.applied === 1, res.applied);
  const row = await prisma.attendance.findFirstOrThrow({ where: { studentId: student.id, sessionId: lecture.id } });
  check("status EXCUSED", row.status === "EXCUSED", row.status);
  check("sabab va tasdiqlovchi yozildi", row.reason === "ILLNESS" && row.excusedById === teacher.id && row.excuseRequestId === req.id, {
    reason: row.reason,
    by: row.excusedById,
    req: row.excuseRequestId,
  });
  const changes = await prisma.attendanceChange.count({ where: { attendanceId: row.id, newStatus: "EXCUSED" } });
  check("o'zgarish jurnaliga tushdi", changes === 1, changes);

  const final = await limitsOf();
  check("sababli propusk sababsiz soatga kirmaydi", final.unexcusedHours === 0, final.unexcusedHours);
  check("sababli soat alohida ko'rinadi", final.excusedHours === 2, final.excusedHours);

  // ---------- 4. Takroriy ko'rib chiqish rad etiladi ----------
  console.log("\n4) Himoya");
  let twice: string | null = null;
  try {
    await reviewExcuse(teacher.id, req.id, { approve: false });
  } catch (e) {
    twice = (e as { code?: string }).code ?? "error";
  }
  check("bir arizani ikki marta ko'rib bo'lmaydi", twice !== null, twice);

  let alien: string | null = null;
  try {
    await submitMakeup(teacher.id, mine[0]!.id);
  } catch (e) {
    alien = (e as { code?: string }).code ?? "error";
  }
  check("begona otrabotkani topshirib bo'lmaydi", alien !== null, alien);

  console.log(`\n${fail === 0 ? "HAMMASI O'TDI" : "XATO BOR"} — ${ok} ✓ / ${fail} ✗\n`);
}

async function cleanup() {
  const { facultyId, groupId, studentId, courseId } = created;
  if (studentId) {
    await prisma.makeup.deleteMany({ where: { attendance: { studentId } } });
    await prisma.attendanceChange.deleteMany({ where: { attendance: { studentId } } });
    await prisma.attendance.deleteMany({ where: { studentId } });
    await prisma.excuseRequest.deleteMany({ where: { studentId } });
  }
  if (courseId) {
    await prisma.lessonSession.deleteMany({ where: { courseId } });
    await prisma.enrollment.deleteMany({ where: { courseId } });
    await prisma.courseGroup.deleteMany({ where: { courseId } });
    await prisma.courseCycle.deleteMany({ where: { courseId } });
    await prisma.scheduleSlot.deleteMany({ where: { courseId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
  }
  if (studentId) await prisma.user.deleteMany({ where: { id: studentId } });
  if (groupId) await prisma.studentGroup.deleteMany({ where: { id: groupId } });
  if (facultyId) await prisma.faculty.deleteMany({ where: { id: facultyId } });
  console.log("smoke ma'lumoti tozalandi");
}

main()
  .catch((e) => {
    console.error("SMOKE ERROR:", e);
    fail++;
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error("CLEANUP ERROR:", e));
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
  });
