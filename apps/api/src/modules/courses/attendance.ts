import ExcelJS from "exceljs";
import { Prisma, prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
const STATUSES: Status[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}

async function ownCourse(courseId: number, teacherId: number) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { subject: true } });
  if (!course) throw notFound("Kurs");
  if (course.teacherId !== teacherId) throw forbidden();
  return course;
}

async function ownSession(sessionId: number, teacherId: number) {
  const session = await prisma.lessonSession.findUnique({ where: { id: sessionId }, include: { course: true } });
  if (!session) throw notFound("Dars");
  if (session.course.teacherId !== teacherId) throw forbidden();
  return session;
}

async function activeStudents(courseId: number) {
  const enr = await prisma.enrollment.findMany({
    where: { courseId, status: "ACTIVE" },
    include: { student: true },
    orderBy: { student: { fullName: "asc" } },
  });
  return enr.map((e) => e.student);
}

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const f: Prisma.DateTimeFilter = {};
  if (from) f.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    f.lte = end;
  }
  return from || to ? f : undefined;
}

// ---------- Sessions ----------

export async function listSessions(courseId: number, teacherId: number, opts: { from?: string; to?: string; search?: string }) {
  await ownCourse(courseId, teacherId);
  const rosterSize = (await activeStudents(courseId)).length;
  const range = dateRange(opts.from, opts.to);

  const sessions = await prisma.lessonSession.findMany({
    where: {
      courseId,
      ...(range ? { date: range } : {}),
      ...(opts.search?.trim() ? { title: { contains: opts.search.trim(), mode: "insensitive" } } : {}),
    },
    include: { topic: true, _count: { select: { attendance: true } } },
    orderBy: { date: "desc" },
  });

  return sessions.map((s) => {
    const marked = s._count.attendance;
    const status = marked === 0 ? "UNMARKED" : marked >= rosterSize ? "FULL" : "PARTIAL";
    return {
      id: s.id,
      date: s.date,
      title: s.title ?? (s.topic ? s.topic.titleUz : null),
      titleUz: s.title ?? s.topic?.titleUz ?? null,
      titleRu: s.title ?? s.topic?.titleRu ?? null,
      topicId: s.topicId,
      room: s.room,
      markedCount: marked,
      rosterSize,
      status,
    };
  });
}

export async function createSession(courseId: number, teacherId: number, body: { date?: string; title?: string; topicId?: number | null; room?: string }) {
  await ownCourse(courseId, teacherId);
  if (!body.date) throw badRequest("Sana kiriting", "Введите дату");
  if (body.topicId) {
    const topic = await prisma.topic.findUnique({ where: { id: body.topicId } });
    if (!topic || topic.courseId !== courseId) throw notFound("Mavzu");
  }
  const s = await prisma.lessonSession.create({
    data: { courseId, date: new Date(body.date), title: body.title?.trim() || null, topicId: body.topicId || null, room: body.room?.trim() || null, createdById: teacherId },
  });
  return { id: s.id };
}

export async function updateSession(sessionId: number, teacherId: number, body: { date?: string; title?: string; topicId?: number | null; room?: string }) {
  const session = await ownSession(sessionId, teacherId);
  if (body.topicId) {
    const topic = await prisma.topic.findUnique({ where: { id: body.topicId } });
    if (!topic || topic.courseId !== session.courseId) throw notFound("Mavzu");
  }
  await prisma.lessonSession.update({
    where: { id: sessionId },
    data: {
      ...(body.date ? { date: new Date(body.date) } : {}),
      ...(body.title !== undefined ? { title: body.title?.trim() || null } : {}),
      ...(body.topicId !== undefined ? { topicId: body.topicId || null } : {}),
      ...(body.room !== undefined ? { room: body.room?.trim() || null } : {}),
    },
  });
  return { ok: true };
}

export async function deleteSession(sessionId: number, teacherId: number) {
  await ownSession(sessionId, teacherId);
  // Deleting a session removes its attendance too.
  await prisma.attendance.deleteMany({ where: { sessionId } });
  await prisma.lessonSession.delete({ where: { id: sessionId } });
  return { ok: true };
}

// ---------- Roster + marking ----------

export async function getRoster(sessionId: number, teacherId: number) {
  const session = await ownSession(sessionId, teacherId);
  const [students, marks, group] = await Promise.all([
    activeStudents(session.courseId),
    prisma.attendance.findMany({ where: { sessionId } }),
    prisma.course.findUnique({ where: { id: session.courseId }, include: { courseGroups: { include: { group: true } } } }),
  ]);
  const byStudent = new Map(marks.map((m) => [m.studentId, m.status]));
  return {
    session: {
      id: session.id,
      date: session.date,
      title: session.title,
      topicId: session.topicId,
      room: session.room,
      groupName: group?.courseGroups[0]?.group.name ?? null,
    },
    students: students.map((s) => ({ id: s.id, fullName: s.fullName, status: byStudent.get(s.id) ?? null })),
  };
}

export async function markAttendance(sessionId: number, teacherId: number, marks: { studentId: number; status: Status }[]) {
  const session = await ownSession(sessionId, teacherId);
  if (!Array.isArray(marks)) throw badRequest("Notoʻgʻri maʼlumot", "Неверные данные");

  const enrolledIds = new Set((await activeStudents(session.courseId)).map((s) => s.id));
  const now = new Date();
  for (const m of marks) {
    if (!enrolledIds.has(m.studentId) || !STATUSES.includes(m.status)) continue;
    await prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId: m.studentId } },
      create: { sessionId, studentId: m.studentId, status: m.status, markedById: teacherId },
      update: { status: m.status, markedById: teacherId },
    });
  }
  await prisma.auditLog.create({
    data: { actorId: teacherId, action: "MARK_ATTENDANCE", entity: "LessonSession", entityId: sessionId, detailsJson: { count: marks.length, at: now.toISOString() } },
  });
  return { ok: true };
}

// ---------- Report ----------

interface ReportStudent {
  id: number;
  fullName: string;
  cells: Record<number, Status>; // sessionId -> status
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePct: number | null;
}

async function buildReport(courseId: number, teacherId: number, opts: { from?: string; to?: string }) {
  await ownCourse(courseId, teacherId);
  const range = dateRange(opts.from, opts.to);
  const sessions = await prisma.lessonSession.findMany({
    where: { courseId, ...(range ? { date: range } : {}) },
    orderBy: { date: "asc" },
    include: { topic: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  const students = await activeStudents(courseId);

  const marks = sessionIds.length
    ? await prisma.attendance.findMany({ where: { sessionId: { in: sessionIds }, studentId: { in: students.map((s) => s.id) } } })
    : [];
  const byStudent = new Map<number, Record<number, Status>>();
  for (const m of marks) {
    if (!byStudent.has(m.studentId)) byStudent.set(m.studentId, {});
    byStudent.get(m.studentId)![m.sessionId] = m.status as Status;
  }

  const rows: ReportStudent[] = students.map((s) => {
    const cells = byStudent.get(s.id) ?? {};
    let present = 0, absent = 0, late = 0, excused = 0;
    for (const st of Object.values(cells)) {
      if (st === "PRESENT") present++;
      else if (st === "ABSENT") absent++;
      else if (st === "LATE") late++;
      else if (st === "EXCUSED") excused++;
    }
    const marked = present + absent + late + excused;
    // Attendance % = came (present + late) out of sessions actually marked for them.
    const attendancePct = marked === 0 ? null : Math.round(((present + late) / marked) * 100);
    return { id: s.id, fullName: s.fullName, cells, present, absent, late, excused, attendancePct };
  });

  return {
    sessions: sessions.map((s) => ({ id: s.id, date: s.date, title: s.title ?? s.topic?.titleUz ?? null, titleUz: s.title ?? s.topic?.titleUz ?? null, titleRu: s.title ?? s.topic?.titleRu ?? null })),
    students: rows,
  };
}

export async function attendanceReport(courseId: number, teacherId: number, opts: { from?: string; to?: string; search?: string }) {
  const report = await buildReport(courseId, teacherId, opts);
  let students = report.students;
  if (opts.search?.trim()) students = students.filter((s) => s.fullName.toLowerCase().includes(opts.search!.trim().toLowerCase()));
  return { sessions: report.sessions, students };
}

const shortLabel: Record<Status, string> = { PRESENT: "K", ABSENT: "KM", LATE: "KCH", EXCUSED: "S" };

export async function exportAttendance(courseId: number, teacherId: number, view: "matrix" | "list", opts: { from?: string; to?: string }): Promise<Buffer> {
  const course = await ownCourse(courseId, teacherId);
  const report = await buildReport(courseId, teacherId, opts);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Yoqlama");
  const fmt = (d: Date) => new Date(d).toLocaleDateString("ru-RU");

  if (view === "matrix") {
    ws.addRow(["Talaba", ...report.sessions.map((s) => fmt(s.date)), "Kelmadi (jami)"]);
    for (const st of report.students) {
      ws.addRow([st.fullName, ...report.sessions.map((s) => (st.cells[s.id] ? shortLabel[st.cells[s.id]] : "—")), st.absent]);
    }
  } else {
    ws.addRow(["FISH", "Keldi", "Kelmadi", "Kechikdi", "Sababli", "Davomat %"]);
    for (const st of report.students) {
      ws.addRow([st.fullName, st.present, st.absent, st.late, st.excused, st.attendancePct ?? "—"]);
    }
  }
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 16));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
