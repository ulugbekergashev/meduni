// Haftalik TAKRORIY jadval (ScheduleSlot) → darslar AVTOMATIK hosil bo'ladi.
// O'qituvchi jadvalni bir marta sozlaydi; har hafta darslar o'zi paydo bo'ladi.
// Yo'qlama (kurs, sana) bo'yicha belgilanadi — LessonSession lazy yaratiladi.
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import type { LessonType } from "@prisma/client";
import { atTime, dayBounds, dayKey, mondayIdx, timeOf } from "../../lib/time";
import { type AttStatus as Status, ATT_STATUSES as STATUSES, attendancePct, emptyTally, addMark, isAttStatus } from "../attendance/facts";
import { isNonTeaching, loadExceptions } from "../attendance/calendar";

const LESSON_TYPES: LessonType[] = ["LECTURE", "PRACTICE", "SEMINAR", "LAB", "CLINICAL"];

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}
async function ownCourse(courseId: number, teacherId: number) {
  const c = await prisma.course.findUnique({ where: { id: courseId } });
  if (!c) throw notFound("Kurs");
  if (c.teacherId !== teacherId) throw forbidden();
  return c;
}

// ---------- Slot CRUD (haftalik jadval sozlash) ----------

export async function listSlots(courseId: number, teacherId: number) {
  await ownCourse(courseId, teacherId);
  return prisma.scheduleSlot.findMany({ where: { courseId }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
}

export async function addSlot(courseId: number, teacherId: number, body: { weekday: number; startTime: string; room?: string; groupId?: number | null }) {
  await ownCourse(courseId, teacherId);
  if (!Number.isInteger(body.weekday) || body.weekday < 0 || body.weekday > 6) throw badRequest("Hafta kuni notoʻgʻri", "Неверный день недели");
  if (!/^\d{1,2}:\d{2}$/.test(body.startTime ?? "")) throw badRequest("Vaqt HH:MM formatida", "Время в формате HH:MM");
  const [hh, mm] = body.startTime.split(":").map(Number);
  if (hh > 23 || mm > 59) throw badRequest("Vaqt notoʻgʻri", "Неверное время");
  const time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  // Guruh ko'rsatilsa — u shu kursga biriktirilgan bo'lishi shart.
  let groupId: number | null = null;
  if (body.groupId != null) {
    const cg = await prisma.courseGroup.findFirst({ where: { courseId, groupId: body.groupId } });
    if (!cg) throw badRequest("Guruh bu kursga biriktirilmagan", "Группа не привязана к курсу");
    groupId = body.groupId;
  }
  // Dublikat: bir (guruh, kun, vaqt) bir marta.
  const dup = await prisma.scheduleSlot.findFirst({ where: { courseId, groupId, weekday: body.weekday, startTime: time } });
  if (dup) throw badRequest("Bu guruh uchun shu kun va vaqt allaqachon bor", "Для этой группы этот день и время уже есть");
  const slot = await prisma.scheduleSlot.create({ data: { courseId, groupId, weekday: body.weekday, startTime: time, room: body.room?.trim() || null } });
  // Jadval o'zgarishi davomat maxrajiga ta'sir qiladi → izi qolsin.
  await prisma.auditLog
    .create({ data: { actorId: teacherId, action: "ADD_SLOT", entity: "ScheduleSlot", entityId: slot.id, detailsJson: { courseId, groupId, weekday: body.weekday, startTime: time } } })
    .catch(() => {});
  return slot;
}

export async function deleteSlot(slotId: number, teacherId: number) {
  const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId }, include: { course: true } });
  if (!slot) throw notFound("Jadval");
  if (slot.course.teacherId !== teacherId) throw forbidden();
  await prisma.scheduleSlot.delete({ where: { id: slotId } });
  await prisma.auditLog
    .create({
      data: {
        actorId: teacherId,
        action: "DELETE_SLOT",
        entity: "ScheduleSlot",
        entityId: slotId,
        detailsJson: { courseId: slot.courseId, groupId: slot.groupId, weekday: slot.weekday, startTime: slot.startTime },
      },
    })
    .catch(() => {});
  return { ok: true };
}

// ---------- Darslarni SLOTLARDAN hosil qilish (avtomatik) ----------

export interface DerivedLesson {
  courseId: number;
  courseName: string;
  groupId: number | null;
  groupName: string | null;
  slotId: number;
  date: string; // ISO
  dayKey: string;
  weekday: number;
  startTime: string;
  endTime: string | null;
  room: string | null;
  /** Mashg'ulot turi va akademik soat — davomat limiti shularga tayanadi (F1). */
  lessonType: LessonType;
  hours: number;
  /** Qaysi siklga tegishli (semestr jadvali bo'lsa null). */
  cycleId: number | null;
  sessionId: number | null; // materializatsiya qilingan bo'lsa
  markedCount: number;
  rosterSize: number;
  status: "UNMARKED" | "PARTIAL" | "FULL";
}

// ---------- Sikl oynasi va slot tanlash (F1) ----------
// ⚠️ Sikl endi ALOHIDA jadval (`CourseCycle`): bir (kurs, guruh) juftligi uchun
// bir NECHTA sikl bo'lishi mumkin (takroriy blok, mehmon guruh, keyingi yil).
// Eski `CourseGroup.cycleStart/End` — LEGACY fallback (sikl qatori yo'q bo'lsa).

interface CycleWindow {
  id: number;
  startKey: string;
  endKey: string;
}

type CycleRow = { id: number; groupId: number; startDate: Date; endDate: Date; status: string };

/** Shu (kurs, guruh) uchun BEKOR QILINMAGAN sikl oynalari. */
function cycleWindowsOf(cycles: CycleRow[], groupId: number | null): CycleWindow[] {
  if (groupId == null) return [];
  return cycles
    .filter((c) => c.groupId === groupId && c.status !== "CANCELLED")
    .map((c) => ({ id: c.id, startKey: dayKey(c.startDate), endKey: dayKey(c.endDate) }));
}

/** Legacy oyna — `CourseGroup.cycleStart/End` (sikl qatorlari bo'lmaganda). */
function legacyWindow(cg?: { cycleStart: Date | null; cycleEnd: Date | null } | null): CycleWindow | null {
  if (!cg?.cycleStart || !cg?.cycleEnd) return null;
  return { id: 0, startKey: dayKey(cg.cycleStart), endKey: dayKey(cg.cycleEnd) };
}

type SlotRow = {
  id: number;
  groupId: number | null;
  weekday: number;
  startTime: string;
  endTime: string | null;
  room: string | null;
  lessonType: LessonType;
  hours: number;
  cycleId: number | null;
};

/**
 * Shu kunda shu (kurs, guruh) uchun o'tiladigan slotlar.
 * Qoida: siklga bog'langan slot FAQAT o'z sikli oynasida; bog'lanmagan slot —
 * umumiy jadval (legacy oyna bo'lsa, uning ichida).
 */
function slotsOnDay(
  slots: SlotRow[],
  groupId: number | null,
  weekday: number,
  key: string,
  windows: CycleWindow[],
  legacy: CycleWindow | null
): SlotRow[] {
  const openCycleIds = new Set(windows.filter((w) => key >= w.startKey && key <= w.endKey).map((w) => w.id));
  const legacyOpen = !legacy || (key >= legacy.startKey && key <= legacy.endKey);
  return slots.filter((s) => {
    if (s.weekday !== weekday) return false;
    if (s.groupId != null && s.groupId !== groupId) return false;
    if (s.cycleId != null) return openCycleIds.has(s.cycleId);
    // Sikl qatorlari bor, lekin bu slot ularga bog'lanmagan — umumiy jadval:
    // legacy oyna qoidasiga bo'ysunadi (yo'q bo'lsa — har doim).
    return legacyOpen;
  });
}

/** Slot bog'langan (yoki o'sha kunda ochiq) sikl — sessiyaga yozish uchun. */
function cycleIdFor(slot: SlotRow, key: string, windows: CycleWindow[]): number | null {
  if (slot.cycleId != null) return slot.cycleId;
  const open = windows.find((w) => key >= w.startKey && key <= w.endKey);
  return open && open.id > 0 ? open.id : null;
}

/** O'qituvchining barcha kurslari uchun [from..to] oraliqdagi darslar (slotlardan
 *  hosil qilinadi) + yo'qlama holati. Qidiruv kurs/guruh bo'yicha. */
export async function getTeacherLessons(teacherId: number, opts: { from: string; to: string; search?: string }): Promise<DerivedLesson[]> {
  const [courses, exceptions] = await Promise.all([
    prisma.course.findMany({
      where: { teacherId },
      include: { scheduleSlots: true, courseGroups: { include: { group: true } }, cycles: true },
    }),
    // ⚠️ Bayram/sessiya kunlarida dars hosil qilinmaydi (F1). Kalendar bo'sh
    // bo'lsa hech narsa filtrlanmaydi — eski xatti-harakat saqlanadi.
    loadExceptions(opts.from, opts.to),
  ]);
  const q = opts.search?.trim().toLowerCase();

  const fromB = dayBounds(opts.from).gte;
  const toB = dayBounds(opts.to).lt;
  const courseIds = courses.map((c) => c.id);

  // Roster (kurs, guruh) bo'yicha — talaba o'z groupId'siga tegishli.
  const rosterByCG = new Map<string, number>(); // `${courseId}:${groupId}` -> son
  const sessionByKey = new Map<string, { id: number; marked: number }>(); // `${courseId}:${groupId}:${dayKey}`
  if (courseIds.length) {
    const enrs = await prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, status: "ACTIVE" },
      include: { student: { select: { groupId: true } } },
    });
    for (const e of enrs) {
      if (e.student.groupId == null) continue;
      const k = `${e.courseId}:${e.student.groupId}`;
      rosterByCG.set(k, (rosterByCG.get(k) ?? 0) + 1);
    }
    const sessions = await prisma.lessonSession.findMany({
      where: { courseId: { in: courseIds }, date: { gte: fromB, lt: toB } },
      include: { _count: { select: { attendance: true } } },
      orderBy: { date: "asc" },
    });
    for (const s of sessions) {
      const dk = dayKey(s.date);
      // Aniq kalit: dars = sana+vaqt. Kun-darajali kalit — legacy fallback (birinchisi).
      sessionByKey.set(`${s.courseId}:${s.groupId ?? "x"}:${dk}|${timeOf(s.date)}`, { id: s.id, marked: s._count.attendance });
      const dayK = `${s.courseId}:${s.groupId ?? "x"}:${dk}`;
      if (!sessionByKey.has(dayK)) sessionByKey.set(dayK, { id: s.id, marked: s._count.attendance });
    }
  }

  const groupName = (c: (typeof courses)[number], gid: number) => c.courseGroups.find((cg) => cg.groupId === gid)?.group.name ?? null;

  const out: DerivedLesson[] = [];
  for (const c of courses) {
    if (c.scheduleSlots.length === 0) continue;
    // Kurs guruhlari: slot guruhga bog'lanmagan bo'lsa hammasiga tegishli.
    const groupIds = [...new Set(c.courseGroups.map((cg) => cg.groupId))];
    for (const gid of groupIds) {
      const cg = c.courseGroups.find((x) => x.groupId === gid);
      const facultyId = cg?.group.facultyId ?? null;
      const gName = groupName(c, gid);
      if (q && !(c.name.toLowerCase().includes(q) || (gName?.toLowerCase().includes(q) ?? false))) continue;
      const windows = cycleWindowsOf(c.cycles, gid);
      const legacy = windows.length === 0 ? legacyWindow(cg) : null;
      const rosterSize = rosterByCG.get(`${c.id}:${gid}`) ?? 0;

      for (let d = new Date(fromB); d < toB; d.setDate(d.getDate() + 1)) {
        const wd = mondayIdx(d);
        const dk = dayKey(d);
        if (isNonTeaching(exceptions, dk, facultyId)) continue;
        const daySlots = slotsOnDay(c.scheduleSlots, gid, wd, dk, windows, legacy);
        for (const slot of daySlots) {
          // Dars = sana+vaqt: avval aniq kalit; kunda bitta slot bo'lsagina legacy kun-kalit.
          const mat =
            sessionByKey.get(`${c.id}:${gid}:${dk}|${slot.startTime}`) ??
            (daySlots.length <= 1 ? sessionByKey.get(`${c.id}:${gid}:${dk}`) : undefined);
          const marked = mat?.marked ?? 0;
          const status = marked === 0 ? "UNMARKED" : marked >= rosterSize ? "FULL" : "PARTIAL";
          out.push({
            courseId: c.id,
            courseName: c.name,
            groupId: gid,
            groupName: gName,
            slotId: slot.id,
            date: atTime(dk, slot.startTime).toISOString(),
            dayKey: dk,
            weekday: slot.weekday,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room,
            lessonType: slot.lessonType,
            hours: slot.hours,
            cycleId: cycleIdFor(slot, dk, windows),
            sessionId: mat?.id ?? null,
            markedCount: marked,
            rosterSize,
            status,
          });
        }
      }
    }
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startTime.localeCompare(b.startTime)));
  return out;
}

// ---------- Talaba darslari: SLOTLARDAN hosil qilinadi (o'qituvchinikiga o'xshash) ----------

export interface StudentLesson {
  /** Barqaror React kaliti — dars materializatsiya qilinmagan bo'lsa ham noyob. */
  key: string;
  /** Materializatsiya qilingan bo'lsa LessonSession id, aks holda null. */
  sessionId: number | null;
  date: string; // ISO (sana+vaqt)
  room: string | null;
  courseId: number;
  courseName: string;
  groupId: number | null;
  title: string | null;
  isPast: boolean;
  /** Mashg'ulot turi va akademik soat (F1) — talaba ham ko'radi. */
  lessonType: LessonType;
  hours: number;
  endTime: string | null;
  /** Talabaning shu darsdagi yo'qlama holati (belgilanmagan bo'lsa null). */
  myStatus: Status | null;
}

/** Talabaning [from..to] oralig'idagi darslari — haftalik SLOTLARDAN hosil qilinadi
 *  (o'qituvchi yo'qlama belgilamagan bo'lsa ham ko'rinadi). Talabaning O'Z guruhi
 *  bo'yicha, sikl oynasini hisobga oladi, yo'qlama holatini join qiladi.
 *  `getTeacherLessons` strukturasini ko'zgu qiladi, lekin bitta talabaga. */
export async function getStudentLessons(studentId: number, from: string, to: string): Promise<StudentLesson[]> {
  const me = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true, group: { select: { facultyId: true } } },
  });
  const myGroupId = me?.groupId ?? null;
  const myFacultyId = me?.group?.facultyId ?? null;

  const [enrollments, exceptions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId, status: "ACTIVE" },
      include: { course: { include: { scheduleSlots: true, courseGroups: true, cycles: true } } },
    }),
    loadExceptions(from, to),
  ]);
  const courses = enrollments.map((e) => e.course);
  const courseIds = courses.map((c) => c.id);

  const fromB = dayBounds(from).gte;
  const toB = dayBounds(to).lt;

  // Talabaning shu oraliqdagi yo'qlama belgilari + materializatsiya qilingan sessiyalar.
  const sessionByKey = new Map<string, { id: number; status: Status | null }>();
  if (courseIds.length) {
    const sessions = await prisma.lessonSession.findMany({
      where: { courseId: { in: courseIds }, date: { gte: fromB, lt: toB } },
      select: { id: true, courseId: true, groupId: true, date: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    const marks = sessionIds.length
      ? await prisma.attendance.findMany({ where: { studentId, sessionId: { in: sessionIds } }, select: { sessionId: true, status: true } })
      : [];
    const statusBySession = new Map(marks.map((m) => [m.sessionId, m.status as Status]));
    for (const s of sessions) {
      const dk = dayKey(s.date);
      const entry = { id: s.id, status: statusBySession.get(s.id) ?? null };
      // Aniq kalit: dars = sana+vaqt; kun-darajali — legacy fallback (birinchisi).
      sessionByKey.set(`${s.courseId}:${s.groupId ?? "x"}:${dk}|${timeOf(s.date)}`, entry);
      const dayK = `${s.courseId}:${s.groupId ?? "x"}:${dk}`;
      if (!sessionByKey.has(dayK)) sessionByKey.set(dayK, entry);
    }
  }

  const now = new Date();
  const out: StudentLesson[] = [];
  for (const c of courses) {
    if (c.scheduleSlots.length === 0) continue;
    // Talaba shu kursda faqat O'Z guruhi bilan qatnashadi; slot.groupId==null (legacy)
    // bo'lsa ham talabaning guruhiga tegishli. Sikl oynasi shu (kurs, guruh) bo'yicha.
    const cg = c.courseGroups.find((x) => x.groupId === myGroupId);
    const windows = cycleWindowsOf(c.cycles, myGroupId);
    const legacy = windows.length === 0 ? legacyWindow(cg) : null;
    for (let d = new Date(fromB); d < toB; d.setDate(d.getDate() + 1)) {
      const wd = mondayIdx(d);
      const dk = dayKey(d);
      if (isNonTeaching(exceptions, dk, myFacultyId)) continue;
      const daySlots = slotsOnDay(c.scheduleSlots, myGroupId, wd, dk, windows, legacy);
      for (const slot of daySlots) {
        const dt = atTime(dk, slot.startTime);
        const mat =
          sessionByKey.get(`${c.id}:${myGroupId ?? "x"}:${dk}|${slot.startTime}`) ??
          (daySlots.length <= 1 ? sessionByKey.get(`${c.id}:${myGroupId ?? "x"}:${dk}`) : undefined);
        out.push({
          key: `${c.id}-${myGroupId ?? "x"}-${dk}-${slot.startTime}`,
          sessionId: mat?.id ?? null,
          date: dt.toISOString(),
          room: slot.room,
          courseId: c.id,
          courseName: c.name,
          groupId: myGroupId,
          title: null,
          isPast: dt < now,
          lessonType: slot.lessonType,
          hours: slot.hours,
          endTime: slot.endTime,
          myStatus: mat?.status ?? null,
        });
      }
    }
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/** Guruhning [from..to] oralig'idagi darslari — guruhning BARCHA kurslari slotlaridan
 *  hosil qilinadi (admin nazorati uchun; o'qituvchidan qat'i nazar). Yo'qlama holati
 *  (markedCount/rosterSize) bilan. `getTeacherLessons` naqshini ko'zgu qiladi, lekin
 *  bitta guruhga va o'qituvchi filtri yo'q. */
export async function getGroupLessons(groupId: number, from: string, to: string): Promise<DerivedLesson[]> {
  const [cgs, group, exceptions] = await Promise.all([
    prisma.courseGroup.findMany({
      where: { groupId },
      include: { course: { include: { scheduleSlots: true, cycles: true } } },
    }),
    prisma.studentGroup.findUnique({ where: { id: groupId }, select: { name: true, facultyId: true } }),
    loadExceptions(from, to),
  ]);
  if (cgs.length === 0) return [];

  const fromB = dayBounds(from).gte;
  const toB = dayBounds(to).lt;
  const courseIds = cgs.map((cg) => cg.course.id);

  const rosterByCourse = new Map<number, number>();
  for (const cid of courseIds) {
    rosterByCourse.set(cid, await prisma.enrollment.count({ where: { courseId: cid, status: "ACTIVE", student: { groupId } } }));
  }

  const sessions = await prisma.lessonSession.findMany({
    where: { courseId: { in: courseIds }, groupId, date: { gte: fromB, lt: toB } },
    include: { _count: { select: { attendance: true } } },
  });
  const sessionByKey = new Map<string, { id: number; marked: number }>();
  for (const s of sessions) {
    const dk = dayKey(s.date);
    sessionByKey.set(`${s.courseId}:${dk}|${timeOf(s.date)}`, { id: s.id, marked: s._count.attendance });
    const dayK = `${s.courseId}:${dk}`;
    if (!sessionByKey.has(dayK)) sessionByKey.set(dayK, { id: s.id, marked: s._count.attendance });
  }

  const out: DerivedLesson[] = [];
  for (const cg of cgs) {
    const c = cg.course;
    if (c.scheduleSlots.length === 0) continue;
    const roster = rosterByCourse.get(c.id) ?? 0;
    const windows = cycleWindowsOf(c.cycles, groupId);
    const legacy = windows.length === 0 ? legacyWindow(cg) : null;
    for (let d = new Date(fromB); d < toB; d.setDate(d.getDate() + 1)) {
      const wd = mondayIdx(d);
      const dk = dayKey(d);
      if (isNonTeaching(exceptions, dk, group?.facultyId ?? null)) continue;
      const daySlots = slotsOnDay(c.scheduleSlots, groupId, wd, dk, windows, legacy);
      for (const slot of daySlots) {
        const mat =
          sessionByKey.get(`${c.id}:${dk}|${slot.startTime}`) ??
          (daySlots.length <= 1 ? sessionByKey.get(`${c.id}:${dk}`) : undefined);
        const marked = mat?.marked ?? 0;
        const status = marked === 0 ? "UNMARKED" : marked >= roster ? "FULL" : "PARTIAL";
        out.push({
          courseId: c.id,
          courseName: c.name,
          groupId,
          // ⚠️ Ilgari qattiq `null` edi — admin jadvalida guruh nomi ko'rinmasdi.
          groupName: group?.name ?? null,
          slotId: slot.id,
          date: atTime(dk, slot.startTime).toISOString(),
          dayKey: dk,
          weekday: slot.weekday,
          startTime: slot.startTime,
          endTime: slot.endTime,
          lessonType: slot.lessonType,
          hours: slot.hours,
          cycleId: cycleIdFor(slot, dk, windows),
          room: slot.room,
          sessionId: mat?.id ?? null,
          markedCount: marked,
          rosterSize: roster,
          status,
        });
      }
    }
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startTime.localeCompare(b.startTime)));
  return out;
}

/** Guruh profilida ko'rsatiladigan haftalik jadval: shu guruhga o'qituvchi
 *  o'qitadigan kurslarning slotlari, kun bo'yicha. */
/** Guruh jadvali — kurslar bo'yicha: har kurs uchun sikl davri + kunlar/vaqtlar. */
export async function getGroupTimetable(groupId: number, teacherId: number) {
  const cgs = await prisma.courseGroup.findMany({
    where: { groupId, course: { teacherId } },
    include: { course: { include: { scheduleSlots: true } } },
  });
  const courses = cgs.map((cg) => ({
    courseId: cg.course.id,
    courseName: cg.course.name,
    cycleStart: cg.cycleStart ? dayKey(cg.cycleStart) : null,
    cycleEnd: cg.cycleEnd ? dayKey(cg.cycleEnd) : null,
    slots: cg.course.scheduleSlots
      .filter((s) => s.groupId == null || s.groupId === groupId)
      .map((s) => ({ slotId: s.id, weekday: s.weekday, startTime: s.startTime, room: s.room }))
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)),
  }));
  return { courses };
}

/** Sikl MASTERI: bir marta sana oralig'i + har kun (o'z vaqti/xonasi) → butun sikl
 *  jadvali yaratiladi. Kurs+guruh uchun eski slotlar almashtiriladi. */
export async function setupCycle(
  courseId: number,
  groupId: number,
  teacherId: number,
  body: {
    cycleStart: string;
    cycleEnd: string;
    days: { weekday: number; startTime: string; room?: string; lessonType?: LessonType; hours?: number }[];
  }
) {
  const course = await ownCourse(courseId, teacherId);
  const cg = await prisma.courseGroup.findFirst({ where: { courseId, groupId }, include: { group: { select: { facultyId: true } } } });
  if (!cg) throw badRequest("Guruh bu kursga biriktirilmagan", "Группа не привязана к курсу");
  // Mehmon sikli: guruh kurs kafedrasining fakultetidan emas.
  const dept = await prisma.department.findUnique({ where: { id: course.departmentId }, select: { facultyId: true } });
  const guest = cg.group.facultyId !== dept?.facultyId;
  const start = new Date(body.cycleStart);
  const end = new Date(body.cycleEnd);
  if (isNaN(+start) || isNaN(+end)) throw badRequest("Sana notoʻgʻri", "Неверная дата");
  if (end < start) throw badRequest("Tugash sanasi boshidan keyin boʻlsin", "Дата конца должна быть после начала");

  const norm = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
    if (!m) throw badRequest("Vaqt HH:MM formatida", "Время в формате HH:MM");
    const hh = Number(m[1]), mm = Number(m[2]);
    if (hh > 23 || mm > 59) throw badRequest("Vaqt notoʻgʻri", "Неверное время");
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  const days = (body.days ?? []).filter((d) => Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6);
  if (days.length === 0) throw badRequest("Kamida bitta kun tanlang", "Выберите хотя бы один день");

  // Vaqtlarni AVVAL tekshiramiz — validatsiya xatosi bazani o'zgartirmasin.
  const normalized = days.map((d) => ({
    weekday: d.weekday,
    startTime: norm(d.startTime),
    room: d.room?.trim() || null,
    lessonType: (d.lessonType && LESSON_TYPES.includes(d.lessonType) ? d.lessonType : "PRACTICE") as LessonType,
    hours: Number.isInteger(d.hours) && d.hours! > 0 && d.hours! <= 12 ? d.hours! : 2,
  }));

  // ⚠️ TRANZAKSIYA (2026-09-08): bu amal guruhning BUTUN jadvalini o'chirib qayta
  // yozadi. Ilgari uch alohida so'rov edi — o'rtada uzilsa guruh jadvalsiz qolardi.
  const prev = await prisma.scheduleSlot.findMany({
    where: { courseId, groupId },
    select: { weekday: true, startTime: true, room: true },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
  // ⚠️ F1: sikl endi ALOHIDA qator (`CourseCycle`) — takroriy sikl mumkin.
  // `CourseGroup.cycleStart/End` legacy uchun yangilanib turadi (eski o'quvchilar).
  // Ayni oynadagi sikl bo'lsa — yangilanadi, aks holda YANGI sikl ochiladi.
  const existingCycle = await prisma.courseCycle.findFirst({
    where: { courseId, groupId, status: { not: "CANCELLED" }, startDate: start },
  });
  const cycle = existingCycle
    ? await prisma.courseCycle.update({ where: { id: existingCycle.id }, data: { endDate: end } })
    : await prisma.courseCycle.create({
        data: { courseId, groupId, startDate: start, endDate: end, isGuest: guest, createdById: teacherId },
      });

  // ⚠️ FAQAT SHU SIKL slotlari almashtiriladi (+ siklga bog'lanmagan legacy
  // slotlar, ular bo'lmasa ikki marta dars hosil bo'lardi). Ilgari bu yerda
  // `deleteMany({ courseId, groupId })` edi — ikkinchi siklni sozlash BIRINCHI
  // siklning jadvalini ham o'chirib yuborardi (F1 smoke shuni ko'rsatdi).
  await prisma.$transaction([
    prisma.courseGroup.update({ where: { id: cg.id }, data: { cycleStart: start, cycleEnd: end } }),
    prisma.scheduleSlot.deleteMany({ where: { courseId, groupId, OR: [{ cycleId: cycle.id }, { cycleId: null }] } }),
    prisma.scheduleSlot.createMany({ data: normalized.map((r) => ({ ...r, courseId, groupId, cycleId: cycle.id })) }),
  ]);

  // ⚠️ AUDIT: jadvalni qayta yozish — izsiz bo'lmasligi kerak (ilgari hech qanday
  // yozuv qolmasdi, holbuki bu talabaning davomat maxrajini o'zgartiradi).
  await prisma.auditLog
    .create({
      data: {
        actorId: teacherId,
        action: "SETUP_CYCLE",
        entity: "CourseGroup",
        entityId: cg.id,
        detailsJson: {
          courseId,
          groupId,
          cycleStart: body.cycleStart,
          cycleEnd: body.cycleEnd,
          before: prev,
          cycleId: cycle.id,
          after: normalized.map((r) => ({ weekday: r.weekday, startTime: r.startTime, room: r.room, lessonType: r.lessonType, hours: r.hours })),
        },
      },
    })
    .catch(() => {});
  return { ok: true, days: days.length };
}

// ---------- Yo'qlama (kurs, sana, VAQT) bo'yicha — sessiya lazy yaratiladi ----------
// ⚠️ Universitetda bir kunda bitta kurs bir necha marta o'tilishi mumkin (09:00 va
// 14:00) — shuning uchun sessiya atomi KUN emas, DARS (sana+vaqt). Legacy (vaqtsiz
// yozilgan) sessiyalar uchun: kunda bitta slot bo'lsa kun-darajali fallback ishlaydi.

/** Shu kurs+guruh o'sha kuni nechta slotda o'tiladi (haftalik jadvaldan).
 *  ⚠️ BUG (2026-09-08 da tuzatildi): filtr `OR: [{groupId: null}, {groupId: groupId ?? undefined}]`
 *  edi — Prisma'da `undefined` shartni BUTUNLAY olib tashlaydi, ya'ni groupId=null
 *  bo'lganda OR "har qanday guruh"ga aylanib, sonni oshirib yuborardi va legacy
 *  kun-darajali fallback'ni asossiz o'chirardi. */
async function slotCountThatDay(courseId: number, groupId: number | null, dateKey: string): Promise<number> {
  const wd = mondayIdx(dayBounds(dateKey).gte);
  return prisma.scheduleSlot.count({
    where: { courseId, weekday: wd, ...(groupId == null ? { groupId: null } : { OR: [{ groupId: null }, { groupId }] }) },
  });
}

/** Sessiyani topish: avval aniq (sana+vaqt), topilmasa — kunda bitta dars bo'lgandagina
 *  kun-darajali legacy sessiya. Ko'p-darsli kunda noto'g'ri sessiyaga yozilmaydi. */
async function findSession(courseId: number, groupId: number | null, dateKey: string, time?: string) {
  if (time) {
    const exact = await prisma.lessonSession.findFirst({ where: { courseId, groupId, date: atTime(dateKey, time) } });
    if (exact) return exact;
  }
  const { gte, lt } = dayBounds(dateKey);
  const daySessions = await prisma.lessonSession.findMany({ where: { courseId, groupId, date: { gte, lt } }, orderBy: { date: "asc" } });
  if (daySessions.length === 0) return null;
  if (!time) return daySessions[0];
  // Vaqt berilgan, aniq mos kelmadi: faqat bir-darsli kunda legacy fallback.
  const slots = await slotCountThatDay(courseId, groupId, dateKey);
  return slots <= 1 && daySessions.length === 1 ? daySessions[0] : null;
}

/** Shu (kurs, guruh, kun, vaqt) uchun haftalik slot — dars turi/soati manbai. */
async function slotFor(courseId: number, groupId: number | null, dateKey: string, startTime: string) {
  const wd = mondayIdx(dayBounds(dateKey).gte);
  return prisma.scheduleSlot.findFirst({
    where: {
      courseId,
      weekday: wd,
      startTime,
      ...(groupId == null ? { groupId: null } : { OR: [{ groupId }, { groupId: null }] }),
    },
    // Guruhga aniq bog'langan slot ustun.
    orderBy: { groupId: "desc" },
  });
}

export async function ensureSession(courseId: number, groupId: number | null, dateKey: string, startTime: string, teacherId: number): Promise<number> {
  const existing = await findSession(courseId, groupId, dateKey, startTime);
  if (existing) return existing.id;
  // ⚠️ F1: dars TUR va SOATni slotdan MEROS qilib oladi va o'zida saqlaydi —
  // keyin jadval o'zgarsa, o'tgan darsning soati o'zgarmaydi (davomat maxraji
  // tarixiy bo'lib qoladi).
  const slot = await slotFor(courseId, groupId, dateKey, startTime);
  const created = await prisma.lessonSession.create({
    data: {
      courseId,
      groupId,
      date: atTime(dateKey, startTime),
      createdById: teacherId,
      ...(slot ? { lessonType: slot.lessonType, hours: slot.hours, slotId: slot.id, cycleId: slot.cycleId } : {}),
    },
  });
  return created.id;
}

export async function rosterByDate(teacherId: number, courseId: number, dateKey: string, groupId?: number, time?: string) {
  await ownCourse(courseId, teacherId);
  const enr = await prisma.enrollment.findMany({
    where: { courseId, status: "ACTIVE", ...(groupId ? { student: { groupId } } : {}) },
    include: { student: true },
    orderBy: { student: { fullName: "asc" } },
  });
  const found = await findSession(courseId, groupId ?? null, dateKey, time);
  const session = found ? await prisma.lessonSession.findUnique({ where: { id: found.id }, include: { attendance: true } }) : null;
  const marks = new Map(
    (session?.attendance ?? []).map((a) => [
      a.studentId,
      { status: a.status as Status, grade: a.grade, selfMarked: a.selfMarked, markedAt: a.markedAt },
    ])
  );
  return {
    date: dateKey,
    students: enr.map((e) => {
      const m = marks.get(e.student.id);
      return {
        id: e.student.id,
        fullName: e.student.fullName,
        status: m?.status ?? null,
        grade: m?.grade ?? null,
        // Talaba o'zi FaceID bilan belgiladimi + qachon (o'qituvchi UI belgisi uchun).
        selfMarked: m?.selfMarked ?? false,
        markedAt: m ? m.markedAt.toISOString() : null,
      };
    }),
  };
}

export async function markByDate(
  teacherId: number,
  body: { courseId: number; date: string; startTime?: string; groupId?: number | null; marks: { studentId: number; status: Status; grade?: number | null }[] }
) {
  await ownCourse(body.courseId, teacherId);
  const groupId = body.groupId ?? null;
  const clean = (body.marks ?? []).filter((m) => isAttStatus(m.status) && Number.isInteger(m.studentId));

  // ⚠️ BAHO VALIDATSIYASI (2026-09-08): jonli yo'lda umuman yo'q edi — 0-100 dan
  // tashqaridagi qiymat ham, kasr son ham bazaga tushardi (o'lik `markAttendance`
  // da tekshiruv bor edi, lekin uni hech kim chaqirmasdi).
  for (const m of clean) {
    if (m.grade === null || m.grade === undefined) continue;
    if (!Number.isFinite(m.grade) || m.grade < 0 || m.grade > 100) {
      throw badRequest("Baho 0-100 oraligʻida boʻlsin", "Балл должен быть 0-100");
    }
  }

  // ⚠️ RUXSAT (2026-09-08): ilgari faqat kurs EGALIGI tekshirilardi — ya'ni FK ga
  // mos har qanday studentId ni o'qituvchining istalgan kursiga belgilash mumkin edi
  // (begona fakultet talabasini ham). Endi faqat shu kursga ACTIVE yozilganlar, va
  // guruh ko'rsatilgan bo'lsa — o'sha guruhdagilar.
  const ids = clean.map((m) => m.studentId);
  const enrolled = ids.length
    ? await prisma.enrollment.findMany({
        where: { courseId: body.courseId, status: "ACTIVE", studentId: { in: ids }, ...(groupId ? { student: { groupId } } : {}) },
        select: { studentId: true },
      })
    : [];
  const allowed = new Set(enrolled.map((e) => e.studentId));
  const marks = clean.filter((m) => allowed.has(m.studentId));
  const skipped = clean.length - marks.length;

  const sessionId = await ensureSession(body.courseId, groupId, body.date, body.startTime || "09:00", teacherId);

  // Oldingi holat — o'zgarish jurnali uchun (edi → bo'ldi).
  const before = marks.length
    ? await prisma.attendance.findMany({
        where: { sessionId, studentId: { in: marks.map((m) => m.studentId) } },
        select: { id: true, studentId: true, status: true },
      })
    : [];
  const prevBy = new Map(before.map((b) => [b.studentId, b]));

  // Bitta yo'qlama — bitta tranzaksiya (yarim belgilangan dars qolmasin).
  await prisma.$transaction(
    marks.map((m) =>
      prisma.attendance.upsert({
        where: { sessionId_studentId: { sessionId, studentId: m.studentId } },
        // O'qituvchi qo'lda belgilaganda selfMarked=false (talabaning avto-belgisini bekor qiladi).
        create: { sessionId, studentId: m.studentId, status: m.status, grade: m.grade ?? null, markedById: teacherId, selfMarked: false },
        // ⚠️ Baho: undefined — TEGILMAYDI, null — tozalanadi. Ilgari `grade: m.grade ?? null`
        // edi, ya'ni yo'qlamani qayta belgilash jurnal bahosini JIMGINA o'chirardi.
        update: { status: m.status, markedById: teacherId, selfMarked: false, ...(m.grade !== undefined ? { grade: m.grade } : {}) },
      })
    )
  );

  // ⚠️ O'ZGARISH JURNALI: retro-tuzatish — universitetdagi klassik suiiste'mol
  // vektori. Ilgari AuditLog'da faqat `{count}` qolardi, ya'ni kimning belgisi
  // qachon va nimadan nimaga o'zgargani tiklanmasdi.
  const after = marks.length
    ? await prisma.attendance.findMany({ where: { sessionId, studentId: { in: marks.map((m) => m.studentId) } }, select: { id: true, studentId: true } })
    : [];
  const idBy = new Map(after.map((a) => [a.studentId, a.id]));
  const changes = marks
    .filter((m) => prevBy.get(m.studentId)?.status !== m.status)
    .map((m) => ({
      attendanceId: idBy.get(m.studentId)!,
      prevStatus: prevBy.get(m.studentId)?.status ?? null,
      newStatus: m.status,
      byId: teacherId,
    }))
    .filter((c) => c.attendanceId != null);
  if (changes.length) await prisma.attendanceChange.createMany({ data: changes }).catch(() => {});

  await prisma.auditLog
    .create({
      data: {
        actorId: teacherId,
        action: "MARK_ATTENDANCE",
        entity: "LessonSession",
        entityId: sessionId,
        detailsJson: { count: marks.length, changed: changes.length, skipped, byDate: body.date, startTime: body.startTime ?? null, groupId },
      },
    })
    .catch(() => {});
  return { ok: true, sessionId, marked: marks.length, skipped };
}

// ---------- Davomat matritsasi (talaba × DARS) ----------
// Ustun = alohida DARS (sana+vaqt), kun emas! Universitetda bitta kurs bir kunda
// bir necha marta o'tilishi mumkin — har dars o'z ustuni va o'z yo'qlamasi bilan.
export interface MatrixColumn {
  key: string;   // "YYYY-MM-DD|HH:MM"
  date: string;  // YYYY-MM-DD
  time: string;  // HH:MM
  room: string | null;
}
export interface AttendanceMatrixOut {
  columns: MatrixColumn[]; // darslar, xronologik tartibda
  todayKey: string;
  students: { id: number; fullName: string; pct: number | null; cells: Record<string, Status> }[];
}

export async function getAttendanceMatrix(
  teacherId: number,
  courseId: number,
  groupId: number,
  from: string,
  to: string
): Promise<AttendanceMatrixOut> {
  await ownCourse(courseId, teacherId);
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { scheduleSlots: true, courseGroups: { where: { groupId } } },
  });
  if (!course) throw notFound("Kurs");
  const cg = course.courseGroups[0];
  const slots = course.scheduleSlots.filter((s) => s.groupId == null || s.groupId === groupId);

  const fromB = dayBounds(from).gte;
  const toB = dayBounds(to).lt;

  // Ustunlar — haftalik slotlardan (har slot = alohida dars), sikl davri ichida.
  const columns: MatrixColumn[] = [];
  for (let d = new Date(fromB); d < toB; d.setDate(d.getDate() + 1)) {
    const wd = mondayIdx(d);
    const dk = dayKey(d);
    if (cg?.cycleStart && cg?.cycleEnd && (dk < dayKey(cg.cycleStart) || dk > dayKey(cg.cycleEnd))) continue;
    for (const s of slots.filter((x) => x.weekday === wd).sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      columns.push({ key: `${dk}|${s.startTime}`, date: dk, time: s.startTime, room: s.room });
    }
  }

  const [enr, sessions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, status: "ACTIVE", student: { groupId } },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.lessonSession.findMany({
      where: { courseId, groupId, date: { gte: fromB, lt: toB } },
      include: { attendance: { select: { studentId: true, status: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Sessiya → ustun: aniq (sana+vaqt); topilmasa — o'sha kunda bitta ustun bo'lsa unga (legacy).
  const colKeys = new Set(columns.map((c) => c.key));
  const colsPerDay = new Map<string, number>();
  for (const c of columns) colsPerDay.set(c.date, (colsPerDay.get(c.date) ?? 0) + 1);

  const byCol = new Map<string, Map<number, Status>>();
  const put = (key: string, atts: { studentId: number; status: string }[]) => {
    let m = byCol.get(key);
    if (!m) { m = new Map(); byCol.set(key, m); }
    for (const a of atts) m.set(a.studentId, a.status as Status);
  };
  for (const s of sessions) {
    const dk = dayKey(s.date);
    const exact = `${dk}|${timeOf(s.date)}`;
    if (colKeys.has(exact)) put(exact, s.attendance);
    else if (colsPerDay.get(dk) === 1) {
      const only = columns.find((c) => c.date === dk)!;
      put(only.key, s.attendance);
    }
    // Ko'p-darsli kunda vaqti noma'lum legacy sessiya — hech qaysi ustunga taxmin qilinmaydi.
  }

  const students = enr.map((e) => {
    const cells: Record<string, Status> = {};
    // Foiz — umumiy formula (`attendance/facts.ts`). Ilgari bu yerda o'z nusxasi
    // bor edi; frontend matritsasi esa yana boshqa chegaradan (80/60) rang berardi.
    const tally = emptyTally();
    for (const c of columns) {
      const st = byCol.get(c.key)?.get(e.student.id);
      if (st) {
        cells[c.key] = st;
        addMark(tally, st);
      }
    }
    return { id: e.student.id, fullName: e.student.fullName, pct: attendancePct(tally), cells };
  });

  return { columns, todayKey: dayKey(new Date()), students };
}
