import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import type { Role } from "../../lib/prisma";
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

// ---------- Explicit (manually assigned) tasks ----------

export interface AssignedTaskDto {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: "LOW" | "NORMAL" | "HIGH";
  createdByName: string;
  createdAt: string;
  linkUrl: string | null;
}

export interface CreatedTaskGroup {
  key: string; // batchId, or `id:<n>` for a single assignment
  title: string;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  total: number;
  done: number;
  assignees: string[];
  taskIds: number[];
}

/** OPEN tasks assigned to me (the "inbox"). */
export async function listAssigned(userId: number): Promise<AssignedTaskDto[]> {
  const rows = await prisma.task.findMany({
    where: { assignedToId: userId, status: "OPEN" },
    include: { createdBy: { select: { fullName: true } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    dueDate: t.dueDate?.toISOString() ?? null,
    priority: t.priority,
    createdByName: t.createdBy.fullName,
    createdAt: t.createdAt.toISOString(),
    linkUrl: t.linkUrl,
  }));
}

/** Tasks I created, grouped by batch, with completion counts. */
export async function listCreated(userId: number): Promise<CreatedTaskGroup[]> {
  const rows = await prisma.task.findMany({
    where: { createdById: userId },
    include: { assignedTo: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const groups = new Map<string, CreatedTaskGroup>();
  for (const t of rows) {
    const key = t.batchId ?? `id:${t.id}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, title: t.title, description: t.description, dueDate: t.dueDate?.toISOString() ?? null, createdAt: t.createdAt.toISOString(), total: 0, done: 0, assignees: [], taskIds: [] };
      groups.set(key, g);
    }
    g.total++;
    if (t.status === "DONE") g.done++;
    g.assignees.push(t.assignedTo.fullName);
    g.taskIds.push(t.id);
  }
  return [...groups.values()];
}

export interface CreateTaskInput {
  title?: string;
  description?: string;
  dueDate?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH";
  teacherId?: number; // ADMIN → one teacher
  departmentId?: number; // ADMIN → all teachers in a department
  studentId?: number; // TEACHER → one student
  groupId?: number; // TEACHER → a whole group
  courseId?: number;
  topicId?: number;
  linkUrl?: string;
}

/** Create a task. Direction is validated by the creator's role. */
export async function createTask(creator: { id: number; role: Role }, input: CreateTaskInput) {
  const title = input.title?.trim();
  if (!title) throw badRequest("Sarlavha kiriting", "Введите заголовок");

  let recipients: number[] = [];
  let departmentId: number | null = null;
  let groupId: number | null = null;

  const isAdminTier = creator.role === "SUPERADMIN" || creator.role === "FACULTY_ADMIN" || creator.role === "DEPT_ADMIN";
  if (isAdminTier) {
    // Resolve the admin's own faculty/department pin (SUPER has none).
    let scopeFacultyId: number | null = null;
    let scopeDeptId: number | null = null;
    if (creator.role === "FACULTY_ADMIN" || creator.role === "DEPT_ADMIN") {
      const me = await prisma.user.findUnique({
        where: { id: creator.id },
        select: { facultyId: true, adminDepartmentId: true, adminDepartment: { select: { facultyId: true } } },
      });
      scopeFacultyId = me?.facultyId ?? me?.adminDepartment?.facultyId ?? null;
      scopeDeptId = me?.adminDepartmentId ?? null;
      if (creator.role === "FACULTY_ADMIN" && !scopeFacultyId) throw forbidden();
      if (creator.role === "DEPT_ADMIN" && !scopeDeptId) throw forbidden();
    }

    if (input.teacherId) {
      const u = await prisma.user.findUnique({
        where: { id: input.teacherId },
        select: { role: true, teacherProfile: { select: { departmentId: true, department: { select: { facultyId: true } } } } },
      });
      if (u?.role !== "TEACHER") throw badRequest("Faqat oʻqituvchiga tayinlanadi", "Можно назначить только преподавателю");
      if (scopeDeptId && u.teacherProfile?.departmentId !== scopeDeptId) throw forbidden();
      if (!scopeDeptId && scopeFacultyId && u.teacherProfile?.department.facultyId !== scopeFacultyId) throw forbidden();
      recipients = [input.teacherId];
    } else if (input.departmentId) {
      if (scopeDeptId && input.departmentId !== scopeDeptId) throw forbidden();
      if (!scopeDeptId && scopeFacultyId) {
        const dept = await prisma.department.findUnique({ where: { id: input.departmentId }, select: { facultyId: true } });
        if (dept?.facultyId !== scopeFacultyId) throw forbidden();
      }
      const teachers = await prisma.teacherProfile.findMany({ where: { departmentId: input.departmentId }, select: { userId: true } });
      recipients = teachers.map((t) => t.userId);
      departmentId = input.departmentId;
    } else {
      throw badRequest("Kimga tayinlash koʻrsatilmagan", "Не указан получатель");
    }
  } else if (creator.role === "TEACHER") {
    if (input.studentId) {
      const enrolled = await prisma.enrollment.findFirst({
        where: { studentId: input.studentId, status: "ACTIVE", course: { teacherId: creator.id } },
      });
      if (!enrolled) throw forbidden();
      recipients = [input.studentId];
    } else if (input.groupId) {
      const teaches = await prisma.courseGroup.findFirst({ where: { groupId: input.groupId, course: { teacherId: creator.id } } });
      if (!teaches) throw forbidden();
      const students = await prisma.user.findMany({ where: { groupId: input.groupId, role: "STUDENT", isActive: true }, select: { id: true } });
      recipients = students.map((s) => s.id);
      groupId = input.groupId;
    } else {
      throw badRequest("Kimga tayinlash koʻrsatilmagan", "Не указан получатель");
    }
  } else {
    throw forbidden();
  }

  if (recipients.length === 0) throw badRequest("Qabul qiluvchilar topilmadi", "Получатели не найдены");

  const batchId = recipients.length > 1 ? randomUUID() : null;
  const due = input.dueDate ? new Date(input.dueDate) : null;
  await prisma.task.createMany({
    data: recipients.map((rid) => ({
      title,
      description: input.description?.trim() || null,
      priority: input.priority ?? "NORMAL",
      dueDate: due,
      createdById: creator.id,
      assignedToId: rid,
      departmentId,
      groupId,
      courseId: input.courseId ?? null,
      topicId: input.topicId ?? null,
      linkUrl: input.linkUrl?.trim() || null,
      batchId,
    })),
  });
  return { count: recipients.length };
}

/** Assignee marks their task done (or reopens it). */
export async function setTaskDone(id: number, userId: number, done: boolean) {
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) throw notFound("Vazifa");
  if (t.assignedToId !== userId) throw forbidden();
  return prisma.task.update({ where: { id }, data: { status: done ? "DONE" : "OPEN", completedAt: done ? new Date() : null } });
}

/** Creator deletes a task (whole batch if it was a group/department assignment). */
export async function deleteTask(id: number, userId: number) {
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) throw notFound("Vazifa");
  if (t.createdById !== userId) throw forbidden();
  if (t.batchId) await prisma.task.deleteMany({ where: { batchId: t.batchId, createdById: userId } });
  else await prisma.task.delete({ where: { id } });
  return { ok: true };
}
