// Yo'qlama HISOBOTI va eksporti (xlsx).
//
// ⚠️ 2026-09-08 (Davomat 2.0, F0): bu fayldan "sessiya-markazli" eski qatlam
// OLIB TASHLANDI — `listSessions/createSession/updateSession/deleteSession/
// getRoster/markAttendance/getTeacherSessions/attendanceReport`. Ular 2026-07 da
// haftalik SLOT modeliga o'tilganda frontenddan uzilgan edi (JournalView/
// SessionsView/ReportView o'chirilgan), lekin route'lari ochiq qolgan edi.
// Xavf nazariy emas edi: `POST /courses/:id/sessions` ixtiyoriy vaqtli sessiya
// yaratardi, uni slot-asosli UI hech qachon ko'rsatmasdi va `findSession` topa
// olmasdi — ya'ni "yetim" sessiya va ikki marta sanalgan yo'qlama manbai.
// Yo'qlama belgilash endi FAQAT `timetable.ts::markByDate` orqali (kurs+guruh+
// sana+vaqt), o'zi ham audit yozadi.
//
// Bu yerda qolgani — faqat O'QISH: hisobot va uni xlsx ga aylantirish.
import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";
import { dateRangeFilter } from "../../lib/time";
import { type AttStatus, type AttTally, addMark, attendancePct, emptyTally } from "../attendance/facts";

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}

async function ownCourse(courseId: number, teacherId: number) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Kurs");
  if (course.teacherId !== teacherId) throw forbidden();
  return course;
}

async function activeStudents(courseId: number, groupId?: number) {
  const enr = await prisma.enrollment.findMany({
    where: { courseId, status: "ACTIVE", ...(groupId ? { student: { groupId } } : {}) },
    include: { student: true },
    orderBy: { student: { fullName: "asc" } },
  });
  return enr.map((e) => e.student);
}

// ---------- Report ----------

interface ReportCell {
  status: AttStatus;
  grade: number | null;
}

interface ReportStudent {
  id: number;
  fullName: string;
  cells: Record<number, ReportCell>; // sessionId -> {status, grade}
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePct: number | null;
  avgGrade: number | null;
}

// Access (o'qituvchi egaligi YOKI admin scope) chaqiruvchida tekshiriladi.
async function buildReport(courseId: number, opts: { from?: string; to?: string; groupId?: number }) {
  // ⚠️ Sana oynasi endi ikkala chekkada ham MAHALLIY kunga tayanadi (lib/time).
  // Ilgari `from` UTC yarim tun edi → UTC+5 da birinchi kunning erta darslari
  // hisobotdan tushib qolardi.
  const range = dateRangeFilter(opts.from, opts.to);
  const sessions = await prisma.lessonSession.findMany({
    where: { courseId, ...(range ? { date: range } : {}) },
    orderBy: { date: "asc" },
    include: { topic: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  const students = await activeStudents(courseId, opts.groupId);

  const marks = sessionIds.length
    ? await prisma.attendance.findMany({ where: { sessionId: { in: sessionIds }, studentId: { in: students.map((s) => s.id) } } })
    : [];
  const byStudent = new Map<number, Record<number, ReportCell>>();
  for (const m of marks) {
    if (!byStudent.has(m.studentId)) byStudent.set(m.studentId, {});
    byStudent.get(m.studentId)![m.sessionId] = { status: m.status as AttStatus, grade: m.grade };
  }

  const rows: ReportStudent[] = students.map((s) => {
    const cells = byStudent.get(s.id) ?? {};
    const tally: AttTally = emptyTally();
    const grades: number[] = [];
    for (const cell of Object.values(cells)) {
      addMark(tally, cell.status);
      if (cell.grade !== null) grades.push(cell.grade);
    }
    const avgGrade = grades.length === 0 ? null : Math.round(grades.reduce((a, b) => a + b, 0) / grades.length);
    return { id: s.id, fullName: s.fullName, cells, ...tally, attendancePct: attendancePct(tally), avgGrade };
  });

  return {
    sessions: sessions.map((s) => ({ id: s.id, date: s.date, title: s.title ?? s.topic?.title ?? null })),
    students: rows,
  };
}

const shortLabel: Record<AttStatus, string> = { PRESENT: "K", ABSENT: "KM", LATE: "KCH", EXCUSED: "S" };

type BuiltReport = Awaited<ReturnType<typeof buildReport>>;

/** Yo'qlama hisobotini xlsx workbook'ga aylantiradi (o'qituvchi va admin — bir xil). */
async function buildAttendanceWorkbook(report: BuiltReport, view: "matrix" | "list"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Yoqlama");
  const fmt = (d: Date) => new Date(d).toLocaleDateString("ru-RU");

  if (view === "matrix") {
    ws.addRow(["Talaba", ...report.sessions.map((s) => fmt(s.date)), "Kelmadi (jami)", "Oʻrtacha baho"]);
    for (const st of report.students) {
      ws.addRow([
        st.fullName,
        ...report.sessions.map((s) => {
          const cell = st.cells[s.id];
          if (!cell) return "—";
          return cell.grade !== null ? `${shortLabel[cell.status]}/${cell.grade}` : shortLabel[cell.status];
        }),
        st.absent,
        st.avgGrade ?? "—",
      ]);
    }
  } else {
    ws.addRow(["FISH", "Keldi", "Kelmadi", "Kechikdi", "Sababli", "Davomat %", "Oʻrtacha baho"]);
    for (const st of report.students) {
      ws.addRow([st.fullName, st.present, st.absent, st.late, st.excused, st.attendancePct ?? "—", st.avgGrade ?? "—"]);
    }
  }
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 16));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** Admin: kurs yo'qlama hisobotini eksport qiladi (egalik yo'q — scope chaqiruvchida). */
export async function exportAttendanceReport(courseId: number, view: "matrix" | "list", opts: { from?: string; to?: string; groupId?: number }): Promise<Buffer> {
  const report = await buildReport(courseId, opts);
  return buildAttendanceWorkbook(report, view);
}

/** O'qituvchi: o'z kursi yo'qlamasini eksport qiladi (F2 "Jurnal" sahifasi shu yerdan
 *  yuklab olishni beradi — hozircha faqat to'g'ridan-to'g'ri havola bilan ochiladi). */
export async function exportAttendance(courseId: number, teacherId: number, view: "matrix" | "list", opts: { from?: string; to?: string; groupId?: number }): Promise<Buffer> {
  await ownCourse(courseId, teacherId);
  const report = await buildReport(courseId, opts);
  return buildAttendanceWorkbook(report, view);
}
