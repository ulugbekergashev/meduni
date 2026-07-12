import argon2 from "argon2";
import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

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

/** Attendance % = came (present + late) out of sessions actually marked for the
 *  student. Same formula the teacher's report uses, so the numbers match. */
function attendancePct(present: number, absent: number, late: number, excused: number): number | null {
  const marked = present + absent + late + excused;
  return marked === 0 ? null : Math.round(((present + late) / marked) * 100);
}

export async function getMyAttendance(studentId: number, opts: { courseId?: number; from?: string; to?: string }) {
  const range = dateRange(opts.from, opts.to);
  const rows = await prisma.attendance.findMany({
    where: {
      studentId, // only my own records — no cross-student leak possible
      session: { ...(opts.courseId ? { courseId: opts.courseId } : {}), ...(range ? { date: range } : {}) },
    },
    include: { session: { include: { course: { include: { subject: true } }, topic: true } } },
    orderBy: { session: { date: "desc" } },
  });

  let present = 0, absent = 0, late = 0, excused = 0;
  for (const r of rows) {
    if (r.status === "PRESENT") present++;
    else if (r.status === "ABSENT") absent++;
    else if (r.status === "LATE") late++;
    else if (r.status === "EXCUSED") excused++;
  }

  return {
    stats: { present, absent, late, excused, pct: attendancePct(present, absent, late, excused) },
    sessions: rows.map((r) => ({
      id: r.session.id,
      date: r.session.date,
      courseNameUz: r.session.course.subject.nameUz,
      courseNameRu: r.session.course.subject.nameRu,
      titleUz: r.session.title ?? r.session.topic?.titleUz ?? null,
      titleRu: r.session.title ?? r.session.topic?.titleRu ?? null,
      status: r.status as Status,
    })),
  };
}

export async function getMyProfile(studentId: number) {
  const user = await prisma.user.findUnique({ where: { id: studentId }, include: { group: true } });
  if (!user) throw notFound("Foydalanuvchi");

  const [coursesCount, completedTopics, attendance] = await Promise.all([
    prisma.enrollment.count({ where: { studentId, status: "ACTIVE" } }),
    prisma.progress.count({ where: { studentId, state: "COMPLETED" } }),
    prisma.attendance.groupBy({ by: ["status"], where: { studentId }, _count: true }),
  ]);

  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<Status, number>;
  for (const a of attendance) counts[a.status as Status] = a._count;

  return {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    groupName: user.group?.name ?? null,
    locale: user.locale,
    coursesCount,
    completedTopics,
    attendancePct: attendancePct(counts.PRESENT, counts.ABSENT, counts.LATE, counts.EXCUSED),
  };
}

export async function setLocale(studentId: number, locale: unknown) {
  if (locale !== "uz" && locale !== "ru") throw badRequest("Til notoʻgʻri", "Неверный язык");
  await prisma.user.update({ where: { id: studentId }, data: { locale } });
  return { ok: true, locale };
}

export async function changePassword(studentId: number, oldPassword: unknown, newPassword: unknown) {
  if (typeof oldPassword !== "string" || typeof newPassword !== "string") throw badRequest("Maʼlumot notoʻgʻri", "Неверные данные");
  if (newPassword.length < 6) {
    throw new ApiError(400, "password_too_short", "Kamida 6 belgi", "Минимум 6 символов");
  }
  const user = await prisma.user.findUnique({ where: { id: studentId } });
  if (!user) throw notFound("Foydalanuvchi");
  const valid = await argon2.verify(user.passwordHash, oldPassword);
  if (!valid) {
    throw new ApiError(400, "wrong_old_password", "Eski parol xato", "Старый пароль неверный");
  }
  await prisma.user.update({ where: { id: studentId }, data: { passwordHash: await argon2.hash(newPassword) } });
  return { ok: true };
}
