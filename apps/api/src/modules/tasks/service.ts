import { prisma } from "../../lib/prisma";
import { buildMatrix } from "../courses/progress";
import { computeTopics, enrolledCourseIds, loadCourse, studentFactsMap } from "../me/service";

// An auto-derived task: computed live from existing data, disappears once resolved.
// The frontend maps `type` → icon + label; `link` is where the teacher/student acts.
export type TaskTone = "rose" | "amber" | "blue" | "brand" | "violet" | "emerald";

export interface AutoTask {
  type: string;
  count: number;
  tone: TaskTone;
  link: string;
}

// ---------- Teacher ----------

export async function computeTeacherAutoTasks(teacherId: number): Promise<AutoTask[]> {
  const topics = await prisma.topic.findMany({
    where: { course: { teacherId } },
    select: {
      id: true,
      materials: { select: { parseStatus: true } },
      digest: { select: { approvedByTeacher: true } },
      contentItems: { select: { status: true, factcheckStatus: true } },
    },
    orderBy: { id: "asc" },
  });

  const materialMissing: number[] = [];
  const digestApprove: number[] = [];
  const contentCreate: number[] = [];
  const contentPublish: number[] = [];
  const factcheck: number[] = [];
  for (const t of topics) {
    const hasDoneMaterial = t.materials.some((m) => m.parseStatus === "DONE");
    const digestApproved = t.digest?.approvedByTeacher === true;
    const hasContent = t.contentItems.length > 0;
    if (!hasDoneMaterial) { materialMissing.push(t.id); continue; }
    if (!digestApproved) { digestApprove.push(t.id); continue; }
    if (!hasContent) { contentCreate.push(t.id); continue; }
    if (t.contentItems.some((c) => c.status === "DRAFT" || c.status === "REVIEW")) contentPublish.push(t.id);
    if (t.contentItems.some((c) => c.factcheckStatus === "FLAGGED")) factcheck.push(t.id);
  }

  const [casesToReview, pastSessions, courses] = await Promise.all([
    prisma.caseAttempt.count({ where: { reviewedAt: null, clinicalCase: { contentItem: { topic: { course: { teacherId } } } } } }),
    prisma.lessonSession.findMany({
      where: { course: { teacherId }, date: { lt: new Date() } },
      select: { id: true, _count: { select: { attendance: true } }, course: { select: { courseGroups: { select: { groupId: true }, take: 1 } } } },
      orderBy: { date: "asc" },
    }),
    prisma.course.findMany({ where: { teacherId }, select: { id: true }, orderBy: { id: "asc" } }),
  ]);

  const unmarked = pastSessions.filter((s) => s._count.attendance === 0);

  // Students behind (reuses the same matrix the progress heatmap builds).
  let behind = 0;
  let behindCourseId: number | null = null;
  for (const c of courses) {
    const loaded = await loadCourse(c.id).catch(() => null);
    if (!loaded) continue;
    const { students } = await buildMatrix(loaded);
    const b = students.filter((s) => s.behind).length;
    if (b > 0 && behindCourseId === null) behindCourseId = c.id;
    behind += b;
  }

  const tasks: AutoTask[] = [];
  if (casesToReview) tasks.push({ type: "cases_review", count: casesToReview, tone: "rose", link: "/teach/cases/review" });
  if (materialMissing.length) tasks.push({ type: "material_missing", count: materialMissing.length, tone: "brand", link: `/teach/topics/${materialMissing[0]}?step=material` });
  if (digestApprove.length) tasks.push({ type: "digest_approve", count: digestApprove.length, tone: "amber", link: `/teach/topics/${digestApprove[0]}?step=digest` });
  if (contentCreate.length) tasks.push({ type: "content_create", count: contentCreate.length, tone: "violet", link: `/teach/topics/${contentCreate[0]}?step=generate` });
  if (contentPublish.length) tasks.push({ type: "content_publish", count: contentPublish.length, tone: "blue", link: `/teach/topics/${contentPublish[0]}?step=publish` });
  if (factcheck.length) tasks.push({ type: "factcheck", count: factcheck.length, tone: "amber", link: `/teach/topics/${factcheck[0]}?step=factcheck` });
  if (unmarked.length) {
    const gid = unmarked[0].course.courseGroups[0]?.groupId;
    tasks.push({ type: "attendance_unmarked", count: unmarked.length, tone: "amber", link: gid ? `/teach/groups/${gid}?tab=sessions` : "/teach/groups" });
  }
  if (behind) tasks.push({ type: "students_behind", count: behind, tone: "rose", link: behindCourseId ? `/teach/courses/${behindCourseId}/progress` : "/teach/courses" });
  return tasks;
}

// ---------- Student ----------

export async function computeStudentAutoTasks(studentId: number): Promise<AutoTask[]> {
  const ids = await enrolledCourseIds(studentId);

  let studyTopic: number | null = null; // resume or next-available
  let studyCount = 0;
  let quizCount = 0, quizTopic: number | null = null;
  let caseCount = 0, caseTopic: number | null = null;

  for (const id of ids) {
    const course = await loadCourse(id).catch(() => null);
    if (!course) continue;
    const pm = await studentFactsMap(studentId, course);
    const topics = computeTopics(course, pm);
    const current = topics.find((t) => t.state === "IN_PROGRESS") ?? topics.find((t) => t.state === "AVAILABLE");
    if (current) {
      studyCount++;
      if (studyTopic === null) studyTopic = current.id;
      if (current.elements.quiz.exists && current.elements.quiz.score === null) { quizCount++; if (quizTopic === null) quizTopic = current.id; }
      if (current.elements.case.exists && !current.elements.case.submitted) { caseCount++; if (caseTopic === null) caseTopic = current.id; }
    }
  }

  // Case graded (feedback ready) + low attendance.
  const [graded, marks] = await Promise.all([
    prisma.caseAttempt.findFirst({
      where: { studentId, reviewedAt: { not: null } },
      orderBy: { reviewedAt: "desc" },
      select: { clinicalCase: { select: { contentItem: { select: { topicId: true } } } } },
    }),
    prisma.attendance.groupBy({ by: ["status"], where: { studentId }, _count: true }),
  ]);
  const gradedCount = await prisma.caseAttempt.count({ where: { studentId, reviewedAt: { not: null } } });

  let present = 0, late = 0, marked = 0;
  for (const m of marks) {
    marked += m._count;
    if (m.status === "PRESENT") present += m._count;
    else if (m.status === "LATE") late += m._count;
  }
  const attendancePct = marked === 0 ? 100 : Math.round(((present + late) / marked) * 100);

  const tasks: AutoTask[] = [];
  if (studyCount && studyTopic) tasks.push({ type: "study", count: studyCount, tone: "brand", link: `/app/topics/${studyTopic}` });
  if (quizCount && quizTopic) tasks.push({ type: "quiz_todo", count: quizCount, tone: "blue", link: `/app/topics/${quizTopic}?tab=quiz` });
  if (caseCount && caseTopic) tasks.push({ type: "case_todo", count: caseCount, tone: "rose", link: `/app/topics/${caseTopic}?tab=case` });
  if (gradedCount && graded) tasks.push({ type: "case_graded", count: gradedCount, tone: "emerald", link: `/app/topics/${graded.clinicalCase.contentItem.topicId}?tab=case` });
  if (marked > 0 && attendancePct < 75) tasks.push({ type: "attendance_low", count: attendancePct, tone: "amber", link: "/app/attendance" });
  return tasks;
}
