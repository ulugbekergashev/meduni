// PROPUSKNING HAYOT SIKLI — spravka va otrabotka (Davomat 2.0 · F3).
//
// ⚠️ NEGA (2026-09-08 auditi): "Sababli" o'qituvchi popoverda bosadigan status
// edi — na sabab, na hujjat, na tasdiqlovchi, na iz; talaba esa propuskni FAQAT
// KO'RARDI: na spravka topshira olardi, na otrabotka qila olardi. Ya'ni eng
// og'riqli joyda tizim boshi berk ko'cha edi.
//
// Endi propusk — FAKT emas, HOLAT:
//   Kelmadi → ariza (spravka) → dekanat tasdiqlaydi → Sababli
//   Kelmadi → otrabotka (mavzu+test yoki kafedrada) → o'qituvchi qabul qiladi
//
// Ikkalasi ham 25 % koridoriga ta'sir qiladi: sababli propusk sababsiz soatga
// KIRMAYDI; qabul qilingan otrabotka esa (siyosat `makeupClearsAbsence` bo'lsa)
// propuskni yopadi — tarixda qoladi, hisobdan chiqadi (HEMIS "nb yopildi" naqshi).
import type { AbsenceReason, MakeupKind } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, forbidden, notFound } from "../../lib/errors";
import { dayKey, parseDayEnd, parseDayStart } from "../../lib/time";
import { resolvePolicy } from "../policy/service";

const REASONS: AbsenceReason[] = ["ILLNESS", "FAMILY", "OFFICIAL", "COMPETITION", "OTHER"];

// ---------- OTRABOTKA ----------

/** Siyosat shu TURDAGI dars uchun otrabotka talab qiladimi. */
function needsMakeup(scope: "NONE" | "PRACTICE" | "ALL", lessonType: string): boolean {
  if (scope === "NONE") return false;
  if (scope === "ALL") return true;
  // PRACTICE — amaliy tabiatli mashg'ulotlar (ma'ruza odatda otrabotka qilinmaydi).
  return lessonType === "PRACTICE" || lessonType === "LAB" || lessonType === "CLINICAL";
}

/**
 * Talabaning SABABSIZ propusklari uchun otrabotka yozuvlarini yaratadi
 * (idempotent). Yaratish paytida emas, RO'YXAT o'qilganda chaqiriladi —
 * `ensureSession` bilan bir xil "lazy" naqsh.
 */
export async function ensureMakeups(studentId: number): Promise<void> {
  const rows = await prisma.attendance.findMany({
    where: { studentId, status: "ABSENT", makeup: { is: null }, session: { status: "HELD" } },
    select: {
      id: true,
      session: { select: { date: true, lessonType: true, topicId: true, course: { select: { departmentId: true } } } },
    },
    take: 200,
  });
  if (rows.length === 0) return;

  const policyByDept = new Map<number, Awaited<ReturnType<typeof resolvePolicy>>>();
  const data: { attendanceId: number; kind: MakeupKind; dueAt: Date }[] = [];
  for (const r of rows) {
    const deptId = r.session.course.departmentId;
    let policy = policyByDept.get(deptId);
    if (!policy) {
      policy = await resolvePolicy(deptId);
      policyByDept.set(deptId, policy);
    }
    if (!needsMakeup(policy.makeupRequiredFor, r.session.lessonType)) continue;
    // DIGITAL faqat mavzuga bog'langan NAZARIY darsda: klinik mashg'ulotni
    // platformada "o'qib" yopib bo'lmaydi — u faqat kafedrada.
    const kind: MakeupKind = r.session.topicId && r.session.lessonType !== "CLINICAL" ? "DIGITAL" : "IN_PERSON";
    const dueAt = new Date(r.session.date);
    dueAt.setDate(dueAt.getDate() + policy.makeupDeadlineDays);
    data.push({ attendanceId: r.id, kind, dueAt });
  }
  if (data.length) await prisma.makeup.createMany({ data, skipDuplicates: true });
}

export interface MakeupRow {
  id: number;
  attendanceId: number;
  kind: MakeupKind;
  status: string;
  dueAt: string;
  overdue: boolean;
  date: string;
  courseId: number;
  courseName: string;
  lessonType: string;
  hours: number;
  topicId: number | null;
  topicTitle: string | null;
  comment: string | null;
}

function toMakeupRow(m: {
  id: number;
  attendanceId: number;
  kind: MakeupKind;
  status: string;
  dueAt: Date;
  comment: string | null;
  attendance: {
    session: { date: Date; lessonType: string; hours: number; topicId: number | null; courseId: number; course: { name: string }; topic: { title: string } | null };
  };
}): MakeupRow {
  const s = m.attendance.session;
  return {
    id: m.id,
    attendanceId: m.attendanceId,
    kind: m.kind,
    status: m.status,
    dueAt: dayKey(m.dueAt),
    overdue: m.status === "REQUIRED" && m.dueAt < new Date(),
    date: dayKey(s.date),
    courseId: s.courseId,
    courseName: s.course.name,
    lessonType: s.lessonType,
    hours: s.hours,
    topicId: s.topicId,
    topicTitle: s.topic?.title ?? null,
    comment: m.comment,
  };
}

const makeupInclude = {
  attendance: {
    select: {
      session: {
        select: {
          date: true, lessonType: true, hours: true, topicId: true, courseId: true,
          course: { select: { name: true } },
          topic: { select: { title: true } },
        },
      },
    },
  },
} as const;

/** Talabaning otrabotkalari (qarzlar) — ochiq va yopilganlari. */
export async function myMakeups(studentId: number): Promise<MakeupRow[]> {
  await ensureMakeups(studentId);
  const rows = await prisma.makeup.findMany({
    where: { attendance: { studentId } },
    include: makeupInclude,
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
  return rows.map(toMakeupRow);
}

/**
 * Talaba otrabotkani TOPSHIRADI.
 * DIGITAL: mavzu testi o'tish ballidan yuqori topshirilgan bo'lishi SHART —
 * "o'qidim" degan so'z emas, natija bilan isbot.
 */
export async function submitMakeup(studentId: number, makeupId: number): Promise<{ ok: true }> {
  const m = await prisma.makeup.findUnique({
    where: { id: makeupId },
    include: {
      attendance: { select: { studentId: true, session: { select: { topicId: true } } } },
    },
  });
  if (!m) throw notFound("Otrabotka");
  if (m.attendance.studentId !== studentId) throw forbidden("Bu sizniki emas", "Это не ваша отработка");
  if (m.status === "ACCEPTED") return { ok: true };

  if (m.kind === "DIGITAL") {
    const topicId = m.attendance.session.topicId;
    const passed = topicId
      ? await prisma.quizAttempt.findFirst({
          where: { studentId, passed: true, finishedAt: { not: null }, quiz: { contentItem: { topicId } } },
          select: { id: true },
        })
      : null;
    if (!passed) {
      throw new ApiError(
        400,
        "makeup_quiz_required",
        "Avval shu mavzu testidan o'tish ballidan yuqori natija oling",
        "Сначала сдайте тест по теме на проходной балл"
      );
    }
    await prisma.makeup.update({ where: { id: makeupId }, data: { status: "SUBMITTED", submittedAt: new Date(), evidenceAttemptId: passed.id } });
  } else {
    // IN_PERSON/WRITTEN: talaba "topshirdim" deydi, o'qituvchi tasdiqlaydi.
    await prisma.makeup.update({ where: { id: makeupId }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  }
  return { ok: true };
}

/** O'qituvchi navbati — o'z kurslaridagi topshirilgan otrabotkalar. */
export async function teacherMakeupQueue(teacherId: number): Promise<(MakeupRow & { studentId: number; studentName: string })[]> {
  const rows = await prisma.makeup.findMany({
    where: { status: "SUBMITTED", attendance: { session: { course: { teacherId } } } },
    include: {
      ...makeupInclude,
      attendance: {
        select: {
          studentId: true,
          student: { select: { fullName: true } },
          session: makeupInclude.attendance.select.session,
        },
      },
    },
    orderBy: { submittedAt: "asc" },
  });
  return rows.map((m) => ({
    ...toMakeupRow(m as never),
    studentId: m.attendance.studentId,
    studentName: m.attendance.student.fullName,
  }));
}

/** O'qituvchi otrabotkani QABUL QILADI yoki rad etadi. */
export async function reviewMakeup(
  teacherId: number,
  makeupId: number,
  body: { accept: boolean; comment?: string }
): Promise<{ ok: true }> {
  const m = await prisma.makeup.findUnique({
    where: { id: makeupId },
    include: { attendance: { select: { id: true, studentId: true, session: { select: { course: { select: { teacherId: true } } } } } } },
  });
  if (!m) throw notFound("Otrabotka");
  if (m.attendance.session.course.teacherId !== teacherId) throw forbidden("Bu sizning kursingiz emas", "Это не ваш курс");

  await prisma.makeup.update({
    where: { id: makeupId },
    data: {
      status: body.accept ? "ACCEPTED" : "REJECTED",
      acceptedById: teacherId,
      acceptedAt: new Date(),
      comment: body.comment?.trim() || null,
    },
  });
  await prisma.auditLog
    .create({
      data: {
        actorId: teacherId,
        action: body.accept ? "ACCEPT_MAKEUP" : "REJECT_MAKEUP",
        entity: "Makeup",
        entityId: makeupId,
        detailsJson: { studentId: m.attendance.studentId, attendanceId: m.attendanceId, comment: body.comment ?? null },
      },
    })
    .catch(() => {});
  return { ok: true };
}

// ---------- SPRAVKA ARIZASI ----------

export interface ExcuseRow {
  id: number;
  fromDate: string;
  toDate: string;
  reason: AbsenceReason;
  note: string | null;
  documentUrl: string | null;
  status: string;
  reviewComment: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Ariza qamragan propusklar soni (tasdiqlangach — sababliga aylanganlari). */
  affected: number;
}

function toExcuseRow(r: {
  id: number; fromDate: Date; toDate: Date; reason: AbsenceReason; note: string | null;
  documentUrl: string | null; status: string; reviewComment: string | null; reviewedAt: Date | null;
  createdAt: Date; reviewedBy: { fullName: string } | null; _count: { applied: number };
}): ExcuseRow {
  return {
    id: r.id,
    fromDate: dayKey(r.fromDate),
    toDate: dayKey(r.toDate),
    reason: r.reason,
    note: r.note,
    documentUrl: r.documentUrl,
    status: r.status,
    reviewComment: r.reviewComment,
    reviewedByName: r.reviewedBy?.fullName ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    affected: r._count.applied,
  };
}

const excuseInclude = { reviewedBy: { select: { fullName: true } }, _count: { select: { applied: true } } } as const;

export async function myExcuses(studentId: number): Promise<ExcuseRow[]> {
  const rows = await prisma.excuseRequest.findMany({
    where: { studentId },
    include: excuseInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toExcuseRow);
}

/** Talaba spravka arizasini yuboradi. */
export async function createExcuse(
  studentId: number,
  body: { fromDate: string; toDate: string; reason: string; note?: string; documentUrl?: string }
): Promise<{ id: number; matched: number }> {
  const from = parseDayStart(body.fromDate ?? "");
  const to = parseDayEnd(body.toDate ?? "");
  if (isNaN(+from) || isNaN(+to)) throw badRequest("Sana notoʻgʻri", "Неверная дата");
  if (to < from) throw badRequest("Tugash sanasi boshidan keyin boʻlsin", "Дата конца должна быть после начала");
  const reason = (REASONS as string[]).includes(body.reason) ? (body.reason as AbsenceReason) : "OTHER";

  // Qamrab olinadigan propusklar — talabaga darrov ko'rsatiladi ("2 dars").
  const matched = await prisma.attendance.count({
    where: { studentId, status: "ABSENT", session: { status: "HELD", date: { gte: from, lte: to } } },
  });

  const row = await prisma.excuseRequest.create({
    data: {
      studentId,
      fromDate: from,
      toDate: to,
      reason,
      note: body.note?.trim() || null,
      documentUrl: body.documentUrl?.trim() || null,
    },
  });
  return { id: row.id, matched };
}

/** Dekanat navbati (yoki o'qituvchi — siyosat ruxsat bersa). */
export async function excuseQueue(opts: { status?: string; facultyId?: number } = {}): Promise<(ExcuseRow & { studentId: number; studentName: string; groupName: string | null })[]> {
  const rows = await prisma.excuseRequest.findMany({
    where: {
      ...(opts.status && opts.status !== "all" ? { status: opts.status as never } : {}),
      ...(opts.facultyId ? { student: { group: { facultyId: opts.facultyId } } } : {}),
    },
    include: { ...excuseInclude, student: { select: { id: true, fullName: true, group: { select: { name: true } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 200,
  });
  return rows.map((r) => ({
    ...toExcuseRow(r),
    studentId: r.student.id,
    studentName: r.student.fullName,
    groupName: r.student.group?.name ?? null,
  }));
}

/**
 * Arizani KO'RIB CHIQISH. Tasdiqlansa — oraliqdagi SABABSIZ propusklar
 * SABABLIga aylanadi (kim, qachon, qaysi ariza bo'yicha — yozib qo'yiladi),
 * har biriga o'zgarish jurnali yoziladi.
 */
export async function reviewExcuse(
  reviewerId: number,
  excuseId: number,
  body: { approve: boolean; comment?: string }
): Promise<{ ok: true; applied: number }> {
  const req = await prisma.excuseRequest.findUnique({ where: { id: excuseId } });
  if (!req) throw notFound("Ariza");
  if (req.status !== "PENDING") throw badRequest("Ariza allaqachon ko'rib chiqilgan", "Заявка уже рассмотрена");

  let applied = 0;
  if (body.approve) {
    const rows = await prisma.attendance.findMany({
      where: { studentId: req.studentId, status: "ABSENT", session: { status: "HELD", date: { gte: req.fromDate, lte: req.toDate } } },
      select: { id: true },
    });
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      await prisma.attendance.updateMany({
        where: { id: { in: ids } },
        data: {
          status: "EXCUSED",
          reason: req.reason,
          documentUrl: req.documentUrl,
          excusedById: reviewerId,
          excusedAt: new Date(),
          excuseRequestId: req.id,
        },
      });
      // O'zgarish jurnali — retro-tuzatishdan farqi ko'rinib tursin.
      await prisma.attendanceChange
        .createMany({ data: ids.map((id) => ({ attendanceId: id, prevStatus: "ABSENT" as const, newStatus: "EXCUSED" as const, byId: reviewerId, reason: `excuse#${req.id}` })) })
        .catch(() => {});
      applied = ids.length;
    }
  }

  await prisma.excuseRequest.update({
    where: { id: excuseId },
    data: {
      status: body.approve ? "APPROVED" : "REJECTED",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewComment: body.comment?.trim() || null,
    },
  });
  await prisma.auditLog
    .create({
      data: {
        actorId: reviewerId,
        action: body.approve ? "APPROVE_EXCUSE" : "REJECT_EXCUSE",
        entity: "ExcuseRequest",
        entityId: excuseId,
        detailsJson: { studentId: req.studentId, from: dayKey(req.fromDate), to: dayKey(req.toDate), applied, comment: body.comment ?? null },
      },
    })
    .catch(() => {});
  return { ok: true, applied };
}
