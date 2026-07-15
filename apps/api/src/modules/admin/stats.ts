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

  const [students, teachers, courses, publishedTopics, publishedContent, casesToReview, contentToApprove, overQuota, aiAgg, recentContent, activeStudents] = await Promise.all([
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
  ]);

  return {
    counts: { students, teachers, courses, publishedTopics, publishedContent },
    attention: { casesToReview, contentToApprove, departmentsOverQuota: overQuota },
    aiThisMonth: {
      tokens: aiAgg._sum.totalTokens ?? 0,
      images: aiAgg._sum.images ?? 0,
      cost: Math.round((aiAgg._sum.costUsd ?? 0) * 1e4) / 1e4,
    },
    activity: { contentLast7Days: recentContent, activeStudentsLast7Days: activeStudents.length },
  };
}
