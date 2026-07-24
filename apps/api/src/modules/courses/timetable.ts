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
    });
    for (const s of sessions) sessionByKey.set(`${s.courseId}:${s.groupId ?? "x"}:${dayKey(s.date)}`, { id: s.id, marked: s._count.attendance });
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
          const mat = sessionByKey.get(`${c.id}:${gid}:${dk}`);
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

// ---------- Yo'qlama (kurs, sana) bo'yicha — sessiya lazy yaratiladi ----------

async function ensureSession(courseId: number, groupId: number | null, dateKey: string, startTime: string, teacherId: number): Promise<number> {
  const { gte, lt } = dayBounds(dateKey);
  // Yo'qlama sessiyasi (kurs, guruh, sana) bo'yicha ajratiladi.
  const existing = await prisma.lessonSession.findFirst({ where: { courseId, groupId, date: { gte, lt } } });
  if (existing) return existing.id;
  const created = await prisma.lessonSession.create({
    data: { courseId, groupId, date: atTime(dateKey, startTime), createdById: teacherId },
  });
  return created.id;
}

export async function rosterByDate(teacherId: number, courseId: number, dateKey: string, groupId?: number) {
  await ownCourse(courseId, teacherId);
  const enr = await prisma.enrollment.findMany({
    where: { courseId, status: "ACTIVE", ...(groupId ? { student: { groupId } } : {}) },
    include: { student: true },
    orderBy: { student: { fullName: "asc" } },
  });
  const { gte, lt } = dayBounds(dateKey);
  const session = await prisma.lessonSession.findFirst({ where: { courseId, groupId: groupId ?? null, date: { gte, lt } }, include: { attendance: true } });
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
