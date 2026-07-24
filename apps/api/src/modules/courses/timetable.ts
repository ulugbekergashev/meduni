// Haftalik TAKRORIY jadval (ScheduleSlot) → darslar AVTOMATIK hosil bo'ladi.
// O'qituvchi jadvalni bir marta sozlaydi; har hafta darslar o'zi paydo bo'ladi.
// Yo'qlama (kurs, sana) bo'yicha belgilanadi — LessonSession lazy yaratiladi.
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
const STATUSES: Status[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}
async function ownCourse(courseId: number, teacherId: number) {
  const c = await prisma.course.findUnique({ where: { id: courseId } });
  if (!c) throw notFound("Kurs");
  if (c.teacherId !== teacherId) throw forbidden();
  return c;
}

/** 0=Dushanba .. 6=Yakshanba (JS getDay: 0=Yakshanba). */
function mondayIdx(d: Date): number {
  return (d.getDay() + 6) % 7;
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** "YYYY-MM-DD" + "HH:MM" → mahalliy Date. */
function atTime(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}
function dayBounds(dateKey: string): { gte: Date; lt: Date } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const gte = new Date(y, m - 1, d, 0, 0, 0, 0);
  const lt = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { gte, lt };
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
  return prisma.scheduleSlot.create({ data: { courseId, groupId, weekday: body.weekday, startTime: time, room: body.room?.trim() || null } });
}

export async function deleteSlot(slotId: number, teacherId: number) {
  const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId }, include: { course: true } });
  if (!slot) throw notFound("Jadval");
  if (slot.course.teacherId !== teacherId) throw forbidden();
  await prisma.scheduleSlot.delete({ where: { id: slotId } });
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
  room: string | null;
  sessionId: number | null; // materializatsiya qilingan bo'lsa
  markedCount: number;
  rosterSize: number;
  status: "UNMARKED" | "PARTIAL" | "FULL";
}

/** O'qituvchining barcha kurslari uchun [from..to] oraliqdagi darslar (slotlardan
 *  hosil qilinadi) + yo'qlama holati. Qidiruv kurs/guruh bo'yicha. */
export async function getTeacherLessons(teacherId: number, opts: { from: string; to: string; search?: string }): Promise<DerivedLesson[]> {
  const courses = await prisma.course.findMany({
    where: { teacherId },
    include: { scheduleSlots: true, courseGroups: { include: { group: true } } },
  });
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
    for (let d = new Date(fromB); d < toB; d.setDate(d.getDate() + 1)) {
      const wd = mondayIdx(d);
      const dk = dayKey(d);
      for (const slot of c.scheduleSlots) {
        if (slot.weekday !== wd) continue;
        // Slot qaysi guruh(lar)ga: ko'rsatilgan bo'lsa — o'sha; aks holda kursning barcha guruhlari.
        const targetGroups = slot.groupId != null ? [slot.groupId] : c.courseGroups.map((cg) => cg.groupId);
        for (const gid of targetGroups) {
          // Sikl davri: kurs shu guruhga faqat oraliqda o'tiladi — tashqarisida dars yo'q.
          const cg = c.courseGroups.find((x) => x.groupId === gid);
          if (cg?.cycleStart && cg?.cycleEnd && (dk < dayKey(cg.cycleStart) || dk > dayKey(cg.cycleEnd))) continue;
          const gName = groupName(c, gid);
          if (q && !(c.name.toLowerCase().includes(q) || (gName?.toLowerCase().includes(q) ?? false))) continue;
          const rosterSize = rosterByCG.get(`${c.id}:${gid}`) ?? 0;
          // Dars = sana+vaqt: avval aniq kalit; kunda bitta slot bo'lsagina legacy kun-kalit.
          const slotsToday = c.scheduleSlots.filter((s2) => s2.weekday === wd && (s2.groupId == null || s2.groupId === gid)).length;
          const mat =
            sessionByKey.get(`${c.id}:${gid}:${dk}|${slot.startTime}`) ??
            (slotsToday <= 1 ? sessionByKey.get(`${c.id}:${gid}:${dk}`) : undefined);
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
            room: slot.room,
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
  /** Talabaning shu darsdagi yo'qlama holati (belgilanmagan bo'lsa null). */
  myStatus: Status | null;
}

/** Talabaning [from..to] oralig'idagi darslari — haftalik SLOTLARDAN hosil qilinadi
 *  (o'qituvchi yo'qlama belgilamagan bo'lsa ham ko'rinadi). Talabaning O'Z guruhi
 *  bo'yicha, sikl oynasini hisobga oladi, yo'qlama holatini join qiladi.
 *  `getTeacherLessons` strukturasini ko'zgu qiladi, lekin bitta talabaga. */
export async function getStudentLessons(studentId: number, from: string, to: string): Promise<StudentLesson[]> {
  const me = await prisma.user.findUnique({ where: { id: studentId }, select: { groupId: true } });
  const myGroupId = me?.groupId ?? null;

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    include: { course: { include: { scheduleSlots: true, courseGroups: true } } },
  });
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
    for (let d = new Date(fromB); d < toB; d.setDate(d.getDate() + 1)) {
      const wd = mondayIdx(d);
      const dk = dayKey(d);
      // Sikl davri: kurs shu guruhga faqat oraliqda o'tiladi.
      if (cg?.cycleStart && cg?.cycleEnd && (dk < dayKey(cg.cycleStart) || dk > dayKey(cg.cycleEnd))) continue;
      const daySlots = c.scheduleSlots.filter((s) => s.weekday === wd && (s.groupId == null || s.groupId === myGroupId));
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
  const cgs = await prisma.courseGroup.findMany({
    where: { groupId },
    include: { course: { include: { scheduleSlots: true } } },
  });
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
    for (let d = new Date(fromB); d < toB; d.setDate(d.getDate() + 1)) {
      const wd = mondayIdx(d);
      const dk = dayKey(d);
      if (cg.cycleStart && cg.cycleEnd && (dk < dayKey(cg.cycleStart) || dk > dayKey(cg.cycleEnd))) continue;
      const daySlots = c.scheduleSlots.filter((s) => s.weekday === wd && (s.groupId == null || s.groupId === groupId));
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
          groupName: null,
          slotId: slot.id,
          date: atTime(dk, slot.startTime).toISOString(),
          dayKey: dk,
          weekday: slot.weekday,
          startTime: slot.startTime,
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
  body: { cycleStart: string; cycleEnd: string; days: { weekday: number; startTime: string; room?: string }[] }
) {
  await ownCourse(courseId, teacherId);
  const cg = await prisma.courseGroup.findFirst({ where: { courseId, groupId } });
  if (!cg) throw badRequest("Guruh bu kursga biriktirilmagan", "Группа не привязана к курсу");
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

  // Sikl davrini o'rnatamiz + shu kurs+guruh slotlarini qayta yaratamiz.
  await prisma.courseGroup.update({ where: { id: cg.id }, data: { cycleStart: start, cycleEnd: end } });
  await prisma.scheduleSlot.deleteMany({ where: { courseId, groupId } });
  for (const d of days) {
    await prisma.scheduleSlot.create({ data: { courseId, groupId, weekday: d.weekday, startTime: norm(d.startTime), room: d.room?.trim() || null } });
  }
  return { ok: true, days: days.length };
}

// ---------- Yo'qlama (kurs, sana, VAQT) bo'yicha — sessiya lazy yaratiladi ----------
// ⚠️ Universitetda bir kunda bitta kurs bir necha marta o'tilishi mumkin (09:00 va
// 14:00) — shuning uchun sessiya atomi KUN emas, DARS (sana+vaqt). Legacy (vaqtsiz
// yozilgan) sessiyalar uchun: kunda bitta slot bo'lsa kun-darajali fallback ishlaydi.

/** "HH:MM" (mahalliy) — sessiya sanasidan. */
function timeOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Shu kurs+guruh o'sha kuni nechta slotda o'tiladi (haftalik jadvaldan). */
async function slotCountThatDay(courseId: number, groupId: number | null, dateKey: string): Promise<number> {
  const wd = mondayIdx(dayBounds(dateKey).gte);
  return prisma.scheduleSlot.count({
    where: { courseId, weekday: wd, OR: [{ groupId: null }, { groupId: groupId ?? undefined }] },
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

async function ensureSession(courseId: number, groupId: number | null, dateKey: string, startTime: string, teacherId: number): Promise<number> {
  const existing = await findSession(courseId, groupId, dateKey, startTime);
  if (existing) return existing.id;
  const created = await prisma.lessonSession.create({
    data: { courseId, groupId, date: atTime(dateKey, startTime), createdById: teacherId },
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
  const marks = new Map((session?.attendance ?? []).map((a) => [a.studentId, { status: a.status as Status, grade: a.grade }]));
  return {
    date: dateKey,
    students: enr.map((e) => ({
      id: e.student.id,
      fullName: e.student.fullName,
      status: marks.get(e.student.id)?.status ?? null,
      grade: marks.get(e.student.id)?.grade ?? null,
    })),
  };
}

export async function markByDate(
  teacherId: number,
  body: { courseId: number; date: string; startTime?: string; groupId?: number | null; marks: { studentId: number; status: Status; grade?: number | null }[] }
) {
  await ownCourse(body.courseId, teacherId);
  const clean = (body.marks ?? []).filter((m) => STATUSES.includes(m.status) && Number.isInteger(m.studentId));
  const sessionId = await ensureSession(body.courseId, body.groupId ?? null, body.date, body.startTime || "09:00", teacherId);
  for (const m of clean) {
    await prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId: m.studentId } },
      create: { sessionId, studentId: m.studentId, status: m.status, grade: m.grade ?? null, markedById: teacherId },
      update: { status: m.status, grade: m.grade ?? null, markedById: teacherId },
    });
  }
  await prisma.auditLog.create({
    data: { actorId: teacherId, action: "MARK_ATTENDANCE", entity: "LessonSession", entityId: sessionId, detailsJson: { count: clean.length, byDate: body.date } },
  }).catch(() => {});
  return { ok: true, sessionId, marked: clean.length };
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
    let present = 0, marked = 0;
    for (const c of columns) {
      const st = byCol.get(c.key)?.get(e.student.id);
      if (st) {
        cells[c.key] = st;
        marked++;
        if (st === "PRESENT" || st === "LATE") present++;
      }
    }
    return { id: e.student.id, fullName: e.student.fullName, pct: marked ? Math.round((present / marked) * 100) : null, cells };
  });

  return { columns, todayKey: dayKey(new Date()), students };
}
