// ЭКРАН КОНТРОЛЯ ДЛЯ РУКОВОДСТВА (2026-08-11).
//
// Показывает не средние баллы, а ОТКЛОНЕНИЯ: где требования ослаблены, где
// студентов пропустили решением преподавателя, где тема опубликована вообще
// без оценивания. Это то, что читается за минуту и требует действия.
//
// Область видимости — как во всём админ-контуре: SUPERADMIN видит университет,
// декан свой факультет, заведующий кафедрой свою кафедру.
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/errors";
import type { Request } from "express";
import { adminScope, type AdminScope } from "../../middleware/adminScope";
import { invalidatePolicyCache, resolvePolicy, type ResolvedPolicy } from "./service";

/** Курсы, попадающие в область видимости администратора. */
async function scopedCourseFilter(scope: AdminScope) {
  if (scope.level === "SUPER") return {};
  if (scope.level === "FACULTY" && scope.facultyId) {
    return { department: { facultyId: scope.facultyId } };
  }
  if (scope.level === "DEPT" && scope.departmentId) {
    return { departmentId: scope.departmentId };
  }
  throw new ApiError(403, "forbidden", "Ruxsat yoʻq", "Нет доступа");
}

export interface ControlReport {
  policy: ResolvedPolicy;
  totals: {
    courses: number;
    topicsPublished: number;
    /** Опубликованные темы без единого оценивания — самый дешёвый обход. */
    topicsWithoutAssessment: number;
    /** Темы, закрытые решением преподавателя, а не знанием. */
    manualUnlocks: number;
    manualUnlocksLast30d: number;
    /** Курсы, где правила слабее коридора (наследие до внедрения политики). */
    coursesBelowPolicy: number;
    /** Курсы с выключенной последовательностью. */
    coursesSequentialOff: number;
  };
  /** Ручные допуски по преподавателям — по убыванию. */
  byTeacher: {
    teacherId: number;
    teacherName: string;
    departmentName: string;
    manualUnlocks: number;
    topicsWithoutAssessment: number;
    coursesBelowPolicy: number;
  }[];
  /** Темы без оценивания — конкретно, чтобы можно было поручить исправить. */
  topicsWithoutAssessment: {
    topicId: number;
    title: string;
    courseId: number;
    courseName: string;
    teacherName: string;
  }[];
  /** Последние ручные допуски с мотивом. */
  recentUnlocks: {
    at: string;
    teacherName: string;
    studentName: string;
    topicTitle: string;
    reason: string | null;
    note: string | null;
  }[];
}

export async function getControlReport(req: Request): Promise<ControlReport> {
  const scope = await adminScope(req);
  const courseWhere = await scopedCourseFilter(scope);

  const courses = await prisma.course.findMany({
    where: courseWhere,
    select: {
      id: true,
      name: true,
      departmentId: true,
      sequentialUnlock: true,
      defaultUnlockRuleJson: true,
      teacher: { select: { id: true, fullName: true } },
      department: { select: { name: true } },
      topics: {
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, contentItems: { where: { status: "PUBLISHED" }, select: { kind: true } } },
      },
    },
  });

  // Политика разрешается по кафедрам (их немного) — по одному разу на кафедру.
  const deptIds = [...new Set(courses.map((c) => c.departmentId))];
  const policies = new Map<number, ResolvedPolicy>();
  await Promise.all(deptIds.map(async (d) => policies.set(d, await resolvePolicy(d))));
  const basePolicy = await resolvePolicy(scope.level === "DEPT" ? scope.departmentId ?? null : null);

  const perTeacher = new Map<
    number,
    { teacherId: number; teacherName: string; departmentName: string; manualUnlocks: number; topicsWithoutAssessment: number; coursesBelowPolicy: number }
  >();
  const bare: ControlReport["topicsWithoutAssessment"] = [];
  let topicsPublished = 0;
  let coursesBelowPolicy = 0;
  let coursesSequentialOff = 0;

  for (const c of courses) {
    const pol = policies.get(c.departmentId)!;
    const row =
      perTeacher.get(c.teacher.id) ??
      perTeacher
        .set(c.teacher.id, {
          teacherId: c.teacher.id,
          teacherName: c.teacher.fullName,
          departmentName: c.department.name,
          manualUnlocks: 0,
          topicsWithoutAssessment: 0,
          coursesBelowPolicy: 0,
        })
        .get(c.teacher.id)!;

    const raw = (c.defaultUnlockRuleJson ?? null) as { quizPassedPct?: number; caseRequired?: boolean; logic?: string } | null;
    const below =
      (typeof raw?.quizPassedPct === "number" && raw.quizPassedPct < pol.minQuizPassedPct) ||
      (raw?.caseRequired === false && pol.requireCase) ||
      (raw?.logic === "OR" && pol.requireAssessment);
    if (below) {
      coursesBelowPolicy++;
      row.coursesBelowPolicy++;
    }
    if (!c.sequentialUnlock && pol.requireSequential) coursesSequentialOff++;

    for (const t of c.topics) {
      topicsPublished++;
      const kinds = new Set(t.contentItems.map((i) => i.kind));
      if (!kinds.has("QUIZ") && !kinds.has("CASE")) {
        row.topicsWithoutAssessment++;
        if (bare.length < 50) {
          bare.push({ topicId: t.id, title: t.title, courseId: c.id, courseName: c.name, teacherName: c.teacher.fullName });
        }
      }
    }
  }

  // Ручные допуски — по темам курсов в области видимости.
  const topicIds = courses.flatMap((c) => c.topics.map((t) => t.id));
  const overrides = topicIds.length
    ? await prisma.progress.findMany({
        where: { topicId: { in: topicIds }, overriddenAt: { not: null } },
        select: {
          overriddenAt: true,
          overrideReason: true,
          overrideNote: true,
          overriddenById: true,
          student: { select: { fullName: true } },
          topic: { select: { title: true } },
          overriddenBy: { select: { id: true, fullName: true } },
        },
        orderBy: { overriddenAt: "desc" },
      })
    : [];

  const cutoff = Date.now() - 30 * 86_400_000;
  let manualUnlocksLast30d = 0;
  for (const o of overrides) {
    if ((o.overriddenAt?.getTime() ?? 0) >= cutoff) manualUnlocksLast30d++;
    const tid = o.overriddenBy?.id;
    if (tid && perTeacher.has(tid)) perTeacher.get(tid)!.manualUnlocks++;
  }

  return {
    policy: basePolicy,
    totals: {
      courses: courses.length,
      topicsPublished,
      topicsWithoutAssessment: bare.length,
      manualUnlocks: overrides.length,
      manualUnlocksLast30d,
      coursesBelowPolicy,
      coursesSequentialOff,
    },
    byTeacher: [...perTeacher.values()]
      .filter((t) => t.manualUnlocks > 0 || t.topicsWithoutAssessment > 0 || t.coursesBelowPolicy > 0)
      .sort((a, b) => b.manualUnlocks - a.manualUnlocks || b.topicsWithoutAssessment - a.topicsWithoutAssessment),
    topicsWithoutAssessment: bare,
    recentUnlocks: overrides.slice(0, 25).map((o) => ({
      at: o.overriddenAt!.toISOString(),
      teacherName: o.overriddenBy?.fullName ?? "—",
      studentName: o.student.fullName,
      topicTitle: o.topic.title,
      reason: o.overrideReason,
      note: o.overrideNote,
    })),
  };
}

// ---------- Редактирование политики ----------

const NUM_FIELDS = [
  "minQuizPassedPct",
  "minVideoWatchedPct",
  "minQuizAttempts",
  "maxQuizAttempts",
  "minAttemptGapHours",
  "minMinutesPerQuestion",
] as const;
const BOOL_FIELDS = [
  "requireAssessment",
  "requireSequential",
  "requireCase",
  "requireCaseReviewed",
  "requireRemediation",
  "allowManualUnlock",
] as const;

/** Кто вправе править какой уровень: вуз — только ректорат, факультет — декан. */
function assertCanEdit(scope: AdminScope, level: "UNIVERSITY" | "FACULTY" | "DEPARTMENT", scopeId: number | null) {
  if (scope.level === "SUPER") return;
  if (scope.level === "FACULTY" && level === "FACULTY" && scopeId === scope.facultyId) return;
  if (scope.level === "DEPT" && level === "DEPARTMENT" && scopeId === scope.departmentId) return;
  throw new ApiError(403, "forbidden", "Bu darajani oʻzgartira olmaysiz", "Вы не можете менять этот уровень");
}

export async function listPolicies(req: Request) {
  const scope = await adminScope(req);
  const rows = await prisma.learningPolicy.findMany({
    include: { updatedBy: { select: { fullName: true } } },
    orderBy: [{ level: "asc" }, { scopeId: "asc" }],
  });
  const [faculties, departments] = await Promise.all([
    prisma.faculty.findMany({ select: { id: true, name: true } }),
    prisma.department.findMany({ select: { id: true, name: true, facultyId: true } }),
  ]);
  const fname = new Map(faculties.map((f) => [f.id, f.name]));
  const dname = new Map(departments.map((d) => [d.id, d.name]));
  return {
    canEditUniversity: scope.level === "SUPER",
    faculties,
    departments,
    policies: rows.map((r) => ({
      id: r.id,
      level: r.level,
      scopeId: r.scopeId,
      scopeName:
        r.level === "UNIVERSITY" ? null : r.level === "FACULTY" ? fname.get(r.scopeId ?? 0) ?? null : dname.get(r.scopeId ?? 0) ?? null,
      minQuizPassedPct: r.minQuizPassedPct,
      minVideoWatchedPct: r.minVideoWatchedPct,
      requireAssessment: r.requireAssessment,
      requireSequential: r.requireSequential,
      requireCase: r.requireCase,
      requireCaseReviewed: r.requireCaseReviewed,
      minQuizAttempts: r.minQuizAttempts,
      maxQuizAttempts: r.maxQuizAttempts,
      minAttemptGapHours: r.minAttemptGapHours,
      requireRemediation: r.requireRemediation,
      minMinutesPerQuestion: r.minMinutesPerQuestion,
      allowManualUnlock: r.allowManualUnlock,
      updatedBy: r.updatedBy?.fullName ?? null,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function upsertPolicy(req: Request, body: Record<string, unknown>) {
  const scope = await adminScope(req);
  const userId = req.user!.id;
  const level = String(body.level ?? "") as "UNIVERSITY" | "FACULTY" | "DEPARTMENT";
  if (!["UNIVERSITY", "FACULTY", "DEPARTMENT"].includes(level)) {
    throw new ApiError(400, "bad_level", "Notoʻgʻri daraja", "Неверный уровень");
  }
  const scopeId = level === "UNIVERSITY" ? null : Number(body.scopeId);
  if (level !== "UNIVERSITY" && !Number.isInteger(scopeId)) {
    throw new ApiError(400, "bad_scope", "Notoʻgʻri boʻlim", "Неверное подразделение");
  }
  assertCanEdit(scope, level, scopeId);

  const data: Record<string, number | boolean> = {};
  for (const f of NUM_FIELDS) {
    const v = body[f];
    if (typeof v === "number" && Number.isFinite(v)) data[f] = Math.max(0, Math.min(100, Math.round(v)));
  }
  // Часы паузы могут быть больше 100 — отдельный предел.
  if (typeof body.minAttemptGapHours === "number") {
    data.minAttemptGapHours = Math.max(0, Math.min(720, Math.round(body.minAttemptGapHours)));
  }
  for (const f of BOOL_FIELDS) if (typeof body[f] === "boolean") data[f] = body[f] as boolean;

  // Prisma composite-unique bilan nullable scopeId: qidiruvni qo'lda qilamiz.
  const before = await prisma.learningPolicy.findFirst({ where: { level, scopeId } });
  const row = before
    ? await prisma.learningPolicy.update({ where: { id: before.id }, data: { ...data, updatedById: userId } })
    : await prisma.learningPolicy.create({ data: { level, scopeId, ...data, updatedById: userId } });
  invalidatePolicyCache();

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: "UPDATE_LEARNING_POLICY",
      entity: "LearningPolicy",
      entityId: row.id,
      detailsJson: { level, scopeId, before: before ?? null, after: data } as object,
    },
  });
  return { ok: true };
}
