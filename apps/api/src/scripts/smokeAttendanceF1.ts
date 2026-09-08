// DAVOMAT 2.0 · F1 — QABUL TESTI (model: kalendar, soat, tur, SIKL).
//
// Tekshiriladi:
//   1. MEHMON SIKLI — boshqa fakultet guruhi SIKL kursiga biriktiriladi,
//      SEMESTR kursiga esa YO'Q (buyurtmachining asosiy stsenariysi).
//   2. TAKRORIY SIKL — bir (kurs, guruh) uchun ikkinchi sikl ochiladi
//      (ilgari `CourseGroup` unique'i buni umuman imkonsiz qilardi).
//   3. KALENDAR — bayram kuni dars hosil BO'LMAYDI.
//   4. SOAT — limit rejadagi soatdan hisoblanadi, zona to'g'ri.
//   5. "Dars bo'lmadi" (CANCELLED) maxrajdan chiqadi.
//   6. Dars slotdan TUR va SOATni meros qiladi.
//
// ⚠️ Test o'z ma'lumotini yaratadi va OXIRIDA O'CHIRADI (jonli bazada ishlaydi).
//   npx tsx src/scripts/smokeAttendanceF1.ts
import { prisma } from "../lib/prisma";
import { dayKey } from "../lib/time";
import { attendanceLimits, zoneOf } from "../modules/attendance/facts";
import { invalidateCalendarCache } from "../modules/attendance/calendar";
import { getTeacherLessons, setupCycle, ensureSession } from "../modules/courses/timetable";
import { teacherAttachGroup, teacherCreateCourse } from "../modules/courses/service";

const TAG = "ZZ-F1-SMOKE";
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
async function threw(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "error";
  }
}

const created = {
  facultyId: 0,
  groupId: 0,
  studentId: 0,
  cycleCourseId: 0,
  semesterCourseId: 0,
  exceptionIds: [] as number[],
};

/** Berilgan hafta kunidagi keyingi sanani qaytaradi (0=Du). */
function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(from);
  for (let i = 0; i < 14; i++) {
    if ((d.getDay() + 6) % 7 === weekday) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

async function main() {
  console.log("\nDAVOMAT F1 — model qabul testi\n");

  // Mavjud demo o'qituvchisi (kafedrasi bor) — kurs shu kafedrada ochiladi.
  const teacher = await prisma.user.findFirst({
    where: { role: "TEACHER", teacherProfile: { isNot: null } },
    include: { teacherProfile: { include: { department: true } } },
  });
  if (!teacher?.teacherProfile) throw new Error("Kafedrali o'qituvchi topilmadi");
  const homeFacultyId = teacher.teacherProfile.department.facultyId;

  // BOSHQA fakultet + undagi guruh (mehmon).
  const faculty = await prisma.faculty.create({ data: { name: `${TAG} fakultet` } });
  created.facultyId = faculty.id;
  const group = await prisma.studentGroup.create({ data: { facultyId: faculty.id, name: `${TAG}-401`, yearOfStudy: 4 } });
  created.groupId = group.id;
  const student = await prisma.user.create({
    data: { fullName: `${TAG} Talaba`, email: `${TAG.toLowerCase()}@test.local`, passwordHash: "x", role: "STUDENT", groupId: group.id },
  });
  created.studentId = student.id;
  check("boshqa fakultet guruhi tayyor", faculty.id !== homeFacultyId);

  // ---------- 1. Mehmon sikli ----------
  console.log("1) Mehmon guruh — sikl kursiga ha, semestr kursiga yo'q");
  const semErr = await threw(() =>
    teacherCreateCourse(teacher.id, { name: `${TAG} semestr`, groupIds: [group.id], format: "SEMESTER" })
  );
  check("SEMESTR kursiga begona guruh → xato", semErr !== null, semErr);

  const cycleCourse = (await teacherCreateCourse(teacher.id, {
    name: `${TAG} sikl`,
    groupIds: [group.id],
    format: "CYCLE",
  })) as { id: number };
  created.cycleCourseId = cycleCourse.id;
  check("SIKL kursiga mehmon guruh biriktirildi", !!cycleCourse.id);
  const attached = await prisma.courseGroup.count({ where: { courseId: cycleCourse.id, groupId: group.id } });
  check("guruh kursga bog'landi", attached === 1);
  const enrolled = await prisma.enrollment.count({ where: { courseId: cycleCourse.id, studentId: student.id, status: "ACTIVE" } });
  check("mehmon talaba avtomatik yozildi", enrolled === 1, enrolled);

  // Semestr kursi — mehmon guruhni biriktirib bo'lmasligi (attach yo'li).
  const semCourse = await prisma.course.create({
    data: {
      name: `${TAG} semestr-2`,
      departmentId: teacher.teacherProfile.departmentId,
      teacherId: teacher.id,
      semester: 1,
      academicYear: "2026/2027",
      format: "SEMESTER",
    },
  });
  created.semesterCourseId = semCourse.id;
  const attachErr = await threw(() => teacherAttachGroup(semCourse.id, teacher.id, group.id));
  check("SEMESTR kursiga keyin biriktirish ham rad etildi", attachErr !== null, attachErr);

  // ---------- 2. Takroriy sikl ----------
  console.log("\n2) Takroriy sikl — bir (kurs, guruh) uchun ikkita davr");
  const today = new Date();
  const mon = nextWeekday(today, 0);
  const c1Start = dayKey(mon);
  const c1End = dayKey(new Date(mon.getTime() + 11 * 86_400_000));
  const c2Start = dayKey(new Date(mon.getTime() + 30 * 86_400_000));
  const c2End = dayKey(new Date(mon.getTime() + 41 * 86_400_000));

  await setupCycle(cycleCourse.id, group.id, teacher.id, {
    cycleStart: c1Start,
    cycleEnd: c1End,
    days: [{ weekday: 0, startTime: "09:00", room: "101", lessonType: "CLINICAL", hours: 6 }],
  });
  await setupCycle(cycleCourse.id, group.id, teacher.id, {
    cycleStart: c2Start,
    cycleEnd: c2End,
    days: [{ weekday: 0, startTime: "09:00", room: "101", lessonType: "CLINICAL", hours: 6 }],
  });
  const cycles = await prisma.courseCycle.findMany({ where: { courseId: cycleCourse.id, groupId: group.id }, orderBy: { startDate: "asc" } });
  check("ikkita sikl saqlandi", cycles.length === 2, cycles.map((c) => dayKey(c.startDate)));
  check("mehmon bayrog'i qo'yildi", cycles.every((c) => c.isGuest), cycles.map((c) => c.isGuest));

  // ---------- 3. Kalendar ----------
  console.log("\n3) Kalendar — bayram kuni dars hosil bo'lmaydi");
  const before = await getTeacherLessons(teacher.id, { from: c1Start, to: c1End });
  const mine = before.filter((l) => l.courseId === cycleCourse.id);
  check("sikl oynasida dars hosil bo'ldi", mine.length > 0, mine.length);
  check("dars turi va soati slotdan keldi", mine[0]?.lessonType === "CLINICAL" && mine[0]?.hours === 6, {
    type: mine[0]?.lessonType,
    hours: mine[0]?.hours,
  });
  check("ikkinchi sikl oynasidan tashqarida dars yo'q", !mine.some((l) => l.dayKey > c1End));

  const holidayKey = mine[0]!.dayKey;
  const exc = await prisma.calendarException.create({
    data: { date: new Date(`${holidayKey}T00:00:00`), kind: "HOLIDAY", title: `${TAG} bayram` },
  });
  created.exceptionIds.push(exc.id);
  invalidateCalendarCache();
  const after = (await getTeacherLessons(teacher.id, { from: c1Start, to: c1End })).filter((l) => l.courseId === cycleCourse.id);
  check("bayram kuni dars yo'qoldi", !after.some((l) => l.dayKey === holidayKey), after.map((l) => l.dayKey));
  check("qolgan kunlar joyida", after.length === mine.length - 1, { before: mine.length, after: after.length });

  // Fakultetga xos istisno — BOSHQA fakultetga ta'sir qilmaydi.
  const otherExc = await prisma.calendarException.create({
    data: { date: new Date(`${after[0]!.dayKey}T00:00:00`), kind: "HOLIDAY", facultyId: homeFacultyId, title: `${TAG} uy-fakultet` },
  });
  created.exceptionIds.push(otherExc.id);
  invalidateCalendarCache();
  const after2 = (await getTeacherLessons(teacher.id, { from: c1Start, to: c1End })).filter((l) => l.courseId === cycleCourse.id);
  check("begona fakultet bayrami mehmon guruhga ta'sir qilmadi", after2.length === after.length, { a: after.length, b: after2.length });

  // ---------- 4. Soat va limit ----------
  console.log("\n4) Soat bo'yicha limit (VM №824 — 25 %)");
  const lesson = after2[0]!;
  const sessionId = await ensureSession(cycleCourse.id, group.id, lesson.dayKey, lesson.startTime, teacher.id);
  const ses = await prisma.lessonSession.findUniqueOrThrow({ where: { id: sessionId } });
  check("dars slotdan tur/soat meros qildi", ses.lessonType === "CLINICAL" && ses.hours === 6, { t: ses.lessonType, h: ses.hours });
  check("dars siklga bog'landi", ses.cycleId === cycles[0]!.id || ses.cycleId === cycles[1]!.id, ses.cycleId);

  await prisma.attendance.create({
    data: { sessionId, studentId: student.id, status: "ABSENT", markedById: teacher.id },
  });
  // Reja: 48 soat → limit 25 % = 12 soat. 6 soat sababsiz = 12.5 % → WARN zonasi.
  await prisma.course.update({ where: { id: cycleCourse.id }, data: { plannedHours: 48 } });
  const lim = await attendanceLimits({
    studentIds: [student.id],
    courseId: cycleCourse.id,
    groupId: group.id,
    plannedHours: 48,
    corridor: { maxUnexcusedPct: 25, warnUnexcusedPct: 10 },
  });
  const row = lim.get(student.id)!;
  check("sababsiz soat = 6", row.unexcusedHours === 6, row.unexcusedHours);
  check("limit = 12 soat (48 ning 25 %)", row.limitHours === 12, row.limitHours);
  check("qolgan = 6 soat", row.remainingHours === 6, row.remainingHours);
  check("ulush = 13 %", row.unexcusedPct === 13, row.unexcusedPct);
  check("zona = WARN", row.zone === "WARN", row.zone);
  check("zona chegarasi: 25 % → BLOCKED", zoneOf(12, 12, 25, { maxUnexcusedPct: 25, warnUnexcusedPct: 10 }) === "BLOCKED");
  check("zona: bitta darsdan kam qolsa → DANGER", zoneOf(11, 12, 22, { maxUnexcusedPct: 25, warnUnexcusedPct: 10 }) === "DANGER");

  // ---------- 5. "Dars bo'lmadi" ----------
  console.log("\n5) 'Dars bo'lmadi' — maxrajdan chiqadi");
  const heldBefore = row.heldHours;
  await prisma.lessonSession.update({ where: { id: sessionId }, data: { status: "CANCELLED", cancelReason: "test" } });
  const lim2 = await attendanceLimits({
    studentIds: [student.id],
    courseId: cycleCourse.id,
    groupId: group.id,
    plannedHours: 48,
    corridor: { maxUnexcusedPct: 25, warnUnexcusedPct: 10 },
  });
  const row2 = lim2.get(student.id)!;
  check("bekor qilingan dars soatlari sanoqdan chiqdi", row2.unexcusedHours === 0, row2.unexcusedHours);
  check("o'tkazilgan soat kamaydi", row2.heldHours === heldBefore - 6, { before: heldBefore, after: row2.heldHours });

  console.log(`\n${fail === 0 ? "HAMMASI O'TDI" : "XATO BOR"} — ${ok} ✓ / ${fail} ✗\n`);
}

async function cleanup() {
  const { facultyId, groupId, studentId, cycleCourseId, semesterCourseId, exceptionIds } = created;
  const courseIds = [cycleCourseId, semesterCourseId].filter(Boolean);
  if (exceptionIds.length) await prisma.calendarException.deleteMany({ where: { id: { in: exceptionIds } } });
  if (courseIds.length) {
    const sessions = await prisma.lessonSession.findMany({ where: { courseId: { in: courseIds } }, select: { id: true } });
    const sids = sessions.map((s) => s.id);
    if (sids.length) {
      await prisma.attendanceChange.deleteMany({ where: { attendance: { sessionId: { in: sids } } } });
      await prisma.attendance.deleteMany({ where: { sessionId: { in: sids } } });
      await prisma.lessonSession.deleteMany({ where: { id: { in: sids } } });
    }
    await prisma.scheduleSlot.deleteMany({ where: { courseId: { in: courseIds } } });
    await prisma.courseCycle.deleteMany({ where: { courseId: { in: courseIds } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: courseIds } } });
    await prisma.courseGroup.deleteMany({ where: { courseId: { in: courseIds } } });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
  }
  if (studentId) await prisma.user.deleteMany({ where: { id: studentId } });
  if (groupId) await prisma.studentGroup.deleteMany({ where: { id: groupId } });
  if (facultyId) await prisma.faculty.deleteMany({ where: { id: facultyId } });
  invalidateCalendarCache();
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
