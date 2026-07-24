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

export async function addSlot(courseId: number, teacherId: number, body: { weekday: number; startTime: string; room?: string }) {
  await ownCourse(courseId, teacherId);
  if (!Number.isInteger(body.weekday) || body.weekday < 0 || body.weekday > 6) throw badRequest("Hafta kuni notoʻgʻri", "Неверный день недели");
  if (!/^\d{1,2}:\d{2}$/.test(body.startTime ?? "")) throw badRequest("Vaqt HH:MM formatida", "Время в формате HH:MM");
  const [hh, mm] = body.startTime.split(":").map(Number);
  if (hh > 23 || mm > 59) throw badRequest("Vaqt notoʻgʻri", "Неверное время");
  const time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  // Dublikatni oldini olamiz (bir kun+vaqt bir marta)
  const dup = await prisma.scheduleSlot.findFirst({ where: { courseId, weekday: body.weekday, startTime: time } });
  if (dup) throw badRequest("Bu kun va vaqt allaqachon bor", "Этот день и время уже есть");
  return prisma.scheduleSlot.create({ data: { courseId, weekday: body.weekday, startTime: time, room: body.room?.trim() || null } });
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

  // Materializatsiya qilingan sessiyalar (oraliqda) — yo'qlama holati uchun
  const courseIds = courses.map((c) => c.id);
  const rosterByCourse = new Map<number, number>();
  const sessionByKey = new Map<string, { id: number; marked: number }>();
  if (courseIds.length) {
    const counts = await prisma.enrollment.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, status: "ACTIVE" }, _count: true });
    for (const c of counts) rosterByCourse.set(c.courseId, c._count);
    const sessions = await prisma.lessonSession.findMany({
      where: { courseId: { in: courseIds }, date: { gte: fromB, lt: toB } },
      include: { _count: { select: { attendance: true } } },
    });
    for (const s of sessions) sessionByKey.set(`${s.courseId}:${dayKey(s.date)}`, { id: s.id, marked: s._count.attendance });
  }

  const out: DerivedLesson[] = [];
  for (const c of courses) {
    if (c.scheduleSlots.length === 0) continue;
    const group = c.courseGroups[0]?.group ?? null;
    if (q && !(c.name.toLowerCase().includes(q) || (group?.name.toLowerCase().includes(q) ?? false))) continue;
    const rosterSize = rosterByCourse.get(c.id) ?? 0;
    // oraliqdagi har kun uchun mos slotlar
    for (let d = new Date(fromB); d < toB; d.setDate(d.getDate() + 1)) {
      const wd = mondayIdx(d);
      const dk = dayKey(d);
      for (const slot of c.scheduleSlots) {
        if (slot.weekday !== wd) continue;
        const mat = sessionByKey.get(`${c.id}:${dk}`);
        const marked = mat?.marked ?? 0;
        const status = marked === 0 ? "UNMARKED" : marked >= rosterSize ? "FULL" : "PARTIAL";
        out.push({
          courseId: c.id,
          courseName: c.name,
          groupId: group?.id ?? null,
          groupName: group?.name ?? null,
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
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startTime.localeCompare(b.startTime)));
  return out;
}

/** Guruh profilida ko'rsatiladigan haftalik jadval: shu guruhga o'qituvchi
 *  o'qitadigan kurslarning slotlari, kun bo'yicha. */
export async function getGroupTimetable(groupId: number, teacherId: number) {
  const cgs = await prisma.courseGroup.findMany({
    where: { groupId, course: { teacherId } },
    include: { course: { include: { scheduleSlots: true } } },
  });
  const slots: { slotId: number; courseId: number; courseName: string; weekday: number; startTime: string; room: string | null }[] = [];
  for (const cg of cgs) {
    for (const s of cg.course.scheduleSlots) {
      slots.push({ slotId: s.id, courseId: cg.course.id, courseName: cg.course.name, weekday: s.weekday, startTime: s.startTime, room: s.room });
    }
  }
  slots.sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  return { slots };
}

// ---------- Yo'qlama (kurs, sana) bo'yicha — sessiya lazy yaratiladi ----------

async function ensureSession(courseId: number, dateKey: string, startTime: string, teacherId: number): Promise<number> {
  const { gte, lt } = dayBounds(dateKey);
  const existing = await prisma.lessonSession.findFirst({ where: { courseId, date: { gte, lt } } });
  if (existing) return existing.id;
  const created = await prisma.lessonSession.create({
    data: { courseId, date: atTime(dateKey, startTime), createdById: teacherId },
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
  const session = await prisma.lessonSession.findFirst({ where: { courseId, date: { gte, lt } }, include: { attendance: true } });
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
  body: { courseId: number; date: string; startTime?: string; marks: { studentId: number; status: Status; grade?: number | null }[] }
) {
  await ownCourse(body.courseId, teacherId);
  const clean = (body.marks ?? []).filter((m) => STATUSES.includes(m.status) && Number.isInteger(m.studentId));
  const sessionId = await ensureSession(body.courseId, body.date, body.startTime || "09:00", teacherId);
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
