// O'QUV KALENDARI — dekanat boshqaruvi (Davomat 2.0 · F1).
//
// Semestr sanalari va dars bo'lmaydigan kunlar. Sahifasi F5 da chiziladi; bu yerda
// xizmat + route'lar, chunki kalendarsiz F1 dvigateli ishlamaydi (darslar bayramda
// ham hosil bo'laveradi).
//
// Ruxsat: davr (semestr) — butun vuz ishi, faqat SUPERADMIN. Istisno (bayram/
// sessiya) — SUPER butun vuzga, fakultet-admin O'Z fakultetiga.
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { dayKey, parseDayStart } from "../../lib/time";
import { invalidateCalendarCache } from "../attendance/calendar";
import type { AdminScope } from "../../middleware/adminScope";

type ExceptionKind = "HOLIDAY" | "NON_TEACHING" | "EXAM_WEEK";
const KINDS: ExceptionKind[] = ["HOLIDAY", "NON_TEACHING", "EXAM_WEEK"];

function onlySuper(scope: AdminScope) {
  if (scope.level !== "SUPER") {
    throw new ApiError(403, "forbidden", "Faqat universitet admini", "Только администратор университета");
  }
}

// ---------- O'quv davrlari (semestr sanalari) ----------

export async function listTerms() {
  const rows = await prisma.academicTerm.findMany({ orderBy: [{ academicYear: "desc" }, { semester: "desc" }] });
  return rows.map((r) => ({
    id: r.id,
    academicYear: r.academicYear,
    semester: r.semester,
    startDate: dayKey(r.startDate),
    endDate: dayKey(r.endDate),
  }));
}

export async function upsertTerm(scope: AdminScope, body: Record<string, unknown>) {
  onlySuper(scope);
  const academicYear = String(body.academicYear ?? "").trim();
  const semester = Number(body.semester);
  if (!academicYear) throw badRequest("O'quv yili kerak", "Требуется учебный год");
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) throw badRequest("Semestr notoʻgʻri", "Неверный семестр");
  const startDate = parseDayStart(String(body.startDate ?? ""));
  const endDate = parseDayStart(String(body.endDate ?? ""));
  if (isNaN(+startDate) || isNaN(+endDate)) throw badRequest("Sana notoʻgʻri", "Неверная дата");
  if (endDate < startDate) throw badRequest("Tugash sanasi boshidan keyin boʻlsin", "Дата конца должна быть после начала");

  const row = await prisma.academicTerm.upsert({
    where: { academicYear_semester: { academicYear, semester } },
    create: { academicYear, semester, startDate, endDate },
    update: { startDate, endDate },
  });
  invalidateCalendarCache();
  return { id: row.id };
}

export async function deleteTerm(scope: AdminScope, id: number) {
  onlySuper(scope);
  await prisma.academicTerm.delete({ where: { id } }).catch(() => {
    throw notFound("Davr");
  });
  invalidateCalendarCache();
  return { ok: true };
}

// ---------- Dars bo'lmaydigan kunlar ----------

export async function listExceptions(scope: AdminScope, opts: { from?: string; to?: string }) {
  const where =
    scope.level === "FACULTY"
      ? { OR: [{ facultyId: null }, { facultyId: scope.facultyId! }] }
      : scope.level === "DEPT"
        ? { facultyId: null } // kafedra admini o'zgartira olmaydi, faqat umumiylarni ko'radi
        : {};
  const rows = await prisma.calendarException.findMany({
    where: {
      ...where,
      ...(opts.from || opts.to
        ? { date: { ...(opts.from ? { gte: parseDayStart(opts.from) } : {}), ...(opts.to ? { lte: parseDayStart(opts.to) } : {}) } }
        : {}),
    },
    include: { faculty: { select: { name: true } } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    date: dayKey(r.date),
    kind: r.kind,
    title: r.title,
    facultyId: r.facultyId,
    facultyName: r.faculty?.name ?? null,
  }));
}

export async function createException(scope: AdminScope, body: Record<string, unknown>) {
  const date = parseDayStart(String(body.date ?? ""));
  if (isNaN(+date)) throw badRequest("Sana notoʻgʻri", "Неверная дата");
  const kind = KINDS.includes(body.kind as ExceptionKind) ? (body.kind as ExceptionKind) : "HOLIDAY";
  let facultyId: number | null = body.facultyId == null ? null : Number(body.facultyId);
  if (facultyId != null && !Number.isInteger(facultyId)) facultyId = null;

  // Fakultet-admin faqat O'Z fakultetiga qo'sha oladi; butun vuz — SUPER ishi.
  if (scope.level === "FACULTY") {
    if (facultyId != null && facultyId !== scope.facultyId) {
      throw new ApiError(403, "forbidden", "Faqat oʻz fakultetingiz", "Только ваш факультет");
    }
    facultyId = scope.facultyId!;
  } else if (scope.level === "DEPT") {
    throw new ApiError(403, "forbidden", "Kafedra admini kalendarni oʻzgartira olmaydi", "Админ кафедры не меняет календарь");
  }

  const row = await prisma.calendarException.create({
    data: { date, kind, facultyId, title: String(body.title ?? "").trim() || null },
  });
  invalidateCalendarCache();
  return { id: row.id };
}

export async function deleteException(scope: AdminScope, id: number) {
  const row = await prisma.calendarException.findUnique({ where: { id } });
  if (!row) throw notFound("Kun");
  if (scope.level === "DEPT" || (scope.level === "FACULTY" && row.facultyId !== scope.facultyId)) {
    throw new ApiError(403, "forbidden", "Bu kunni oʻzgartira olmaysiz", "Вы не можете менять этот день");
  }
  await prisma.calendarException.delete({ where: { id } });
  invalidateCalendarCache();
  return { ok: true };
}
