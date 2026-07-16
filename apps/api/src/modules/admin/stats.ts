import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { departmentsOverQuota } from "./monitoring";
import type { AdminScope } from "../../middleware/adminScope";

/** Course filter fragment for the caller's scope (faculty/department pin). */
function courseScope(scope?: AdminScope): Prisma.CourseWhereInput {
  if (!scope || scope.level === "SUPER") return {};
  if (scope.level === "FACULTY") return { subject: { department: { facultyId: scope.facultyId! } } };
  return { subject: { departmentId: scope.departmentId! } };
}

export async function adminStats(scope?: AdminScope) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const scoped = scope && scope.level !== "SUPER";
  const course = courseScope(scope);
  const topicWhere = scoped ? { course } : {};
  const aiDeptWhere: Prisma.AiUsageWhereInput = !scoped
    ? {}
    : scope!.level === "FACULTY"
      ? { department: { facultyId: scope!.facultyId! } }
      : { departmentId: scope!.departmentId! };

  const studentWhere: Prisma.UserWhereInput = !scoped
    ? { role: "STUDENT", isActive: true }
    : scope!.level === "FACULTY"
      ? { role: "STUDENT", isActive: true, group: { facultyId: scope!.facultyId! } }
      : { role: "STUDENT", isActive: true, enrollments: { some: { status: "ACTIVE", course } } };
  const teacherWhere: Prisma.UserWhereInput = !scoped
    ? { role: "TEACHER", isActive: true }
    : {
        role: "TEACHER",
        isActive: true,
        teacherProfile:
          scope!.level === "FACULTY"
            ? { department: { facultyId: scope!.facultyId! } }
            : { departmentId: scope!.departmentId! },
      };

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setHours(0, 0, 0, 0);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);

  const [students, teachers, courses, publishedTopics, publishedContent, casesToReview, contentToApprove, overQuota, aiAgg, recentContent, activeStudents, progressRows, publishedRows] = await Promise.all([
    prisma.user.count({ where: studentWhere }),
    prisma.user.count({ where: teacherWhere }),
    prisma.course.count({ where: course }),
    prisma.topic.count({ where: { ...topicWhere, contentItems: { some: { status: "PUBLISHED" } } } }),
    prisma.contentItem.count({ where: { status: "PUBLISHED", ...(scoped ? { topic: { course } } : {}) } }),
    prisma.caseAttempt.count({ where: { reviewedAt: null, ...(scoped ? { clinicalCase: { contentItem: { topic: { course } } } } : {}) } }),
    prisma.contentItem.count({ where: { status: { in: ["DRAFT", "REVIEW"] }, ...(scoped ? { topic: { course } } : {}) } }),
    departmentsOverQuota(scope),
    prisma.aiUsage.aggregate({ where: { createdAt: { gte: monthStart }, ...aiDeptWhere }, _sum: { totalTokens: true, images: true, costUsd: true } }),
    prisma.contentItem.count({ where: { status: "PUBLISHED", approvedAt: { gte: weekAgo }, ...(scoped ? { topic: { course } } : {}) } }),
    prisma.progress.findMany({ where: { updatedAt: { gte: weekAgo }, ...(scoped ? { topic: { course } } : {}) }, select: { studentId: true }, distinct: ["studentId"] }),
    // 14-day activity series inputs (small at pilot scale; aggregated in JS by day).
    prisma.progress.findMany({
      where: { updatedAt: { gte: twoWeeksAgo }, ...(scoped ? { topic: { course } } : {}) },
      select: { studentId: true, updatedAt: true },
    }),
    prisma.contentItem.findMany({
      where: { status: "PUBLISHED", approvedAt: { gte: twoWeeksAgo }, ...(scoped ? { topic: { course } } : {}) },
      select: { approvedAt: true },
    }),
  ]);

  // Build the per-day series: active (distinct) students + published content.
  // Local-time day key (toISOString would shift days across the UTC boundary).
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const activeByDay = new Map<string, Set<number>>();
  for (const r of progressRows) {
    const k = dayKey(r.updatedAt);
    if (!activeByDay.has(k)) activeByDay.set(k, new Set());
    activeByDay.get(k)!.add(r.studentId);
  }
  const publishedByDay = new Map<string, number>();
  for (const r of publishedRows) {
    if (!r.approvedAt) continue;
    const k = dayKey(r.approvedAt);
    publishedByDay.set(k, (publishedByDay.get(k) ?? 0) + 1);
  }
  const activitySeries: { day: string; activeStudents: number; contentPublished: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(twoWeeksAgo);
    d.setDate(d.getDate() + i);
    const k = dayKey(d);
    activitySeries.push({
      day: k,
      activeStudents: activeByDay.get(k)?.size ?? 0,
      contentPublished: publishedByDay.get(k) ?? 0,
    });
  }

  return {
    counts: { students, teachers, courses, publishedTopics, publishedContent },
    attention: { casesToReview, contentToApprove, departmentsOverQuota: overQuota },
    aiThisMonth: {
      tokens: aiAgg._sum.totalTokens ?? 0,
      images: aiAgg._sum.images ?? 0,
      cost: Math.round((aiAgg._sum.costUsd ?? 0) * 1e4) / 1e4,
    },
    activity: { contentLast7Days: recentContent, activeStudentsLast7Days: activeStudents.length },
    activitySeries,
  };
}
