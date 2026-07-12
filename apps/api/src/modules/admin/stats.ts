import { prisma } from "../../lib/prisma";
import { departmentsOverQuota } from "./monitoring";

export async function adminStats() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [students, teachers, courses, publishedTopics, publishedContent, casesToReview, contentToApprove, overQuota, aiAgg, recentContent, activeStudents] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", isActive: true } }),
    prisma.user.count({ where: { role: "TEACHER", isActive: true } }),
    prisma.course.count(),
    prisma.topic.count({ where: { contentItems: { some: { status: "PUBLISHED" } } } }),
    prisma.contentItem.count({ where: { status: "PUBLISHED" } }),
    prisma.caseAttempt.count({ where: { reviewedAt: null } }),
    prisma.contentItem.count({ where: { status: { in: ["DRAFT", "REVIEW"] } } }),
    departmentsOverQuota(),
    prisma.aiUsage.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { totalTokens: true, images: true, costUsd: true } }),
    prisma.contentItem.count({ where: { status: "PUBLISHED", approvedAt: { gte: weekAgo } } }),
    prisma.progress.findMany({ where: { updatedAt: { gte: weekAgo } }, select: { studentId: true }, distinct: ["studentId"] }),
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
