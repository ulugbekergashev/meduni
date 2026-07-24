import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import type { Role } from "../../lib/prisma";
import { buildMatrix } from "../courses/progress";
import { getTeacherLessons } from "../courses/timetable";
import { computeTopics, enrolledCourseIds, loadCourse, studentFactsMap } from "../me/service";

// An auto-derived task: computed live from existing data, disappears once resolved.
// The frontend maps `type` → icon + label; `link` is where the teacher/student acts.
export type TaskTone = "rose" | "amber" | "blue" | "brand" | "violet" | "emerald";

const TONE_RANK: Record<TaskTone, number> = { rose: 0, amber: 1, blue: 2, violet: 3, brand: 4, emerald: 5 };

/** Vazifaning aniq predmeti — "1 ta test" emas, QAYSI test, qaysi fandan. */
export interface AutoTaskItem {
  topicId: number;
  topicTitle: string;
  courseName: string;
  link: string;
  /** Ball/foiz (baholangan keys, past davomat) — bo'lsa. */
  value?: number | null;
}

export interface AutoTask {
  type: string;
  count: number;
  tone: TaskTone;
  link: string;
  /** Talaba tomonida konkret qatorlar; o'qituvchi tomonida hozircha bo'sh. */
  items?: AutoTaskItem[];
}

// ---------- Teacher: bitta ustuvorlik-navbat ----------
// Har qator KONKRET narsaga ishora qiladi (qaysi talaba, qaysi mavzu, qaysi dars) —
// "3 ta narsa" degan mavhum son emas. Avto-hisoblangan + kafedra tayinlagan
// vazifalar bitta navbatga birlashadi, muhimlik (tone) va eskilik bo'yicha saralanadi.

export type TeacherTaskKind =
  | "cases_review"
  | "material_missing"
  | "digest_approve"
  | "content_create"
  | "content_publish"
  | "factcheck"
  | "attendance_unmarked"
  | "students_behind"
  | "assigned";

export type TeacherQuickAction =
  | { type: "attendance"; courseId: number; date: string; startTime: string; groupId: number | null }
  | { type: "done"; taskId: number };

export interface TeacherTaskItem {
  id: string;
  kind: TeacherTaskKind;
  tone: TaskTone;
  title: string;
  subtitle: string;
  description?: string | null;
  /** Ish qachondan beri kutmoqda — saralash va "N kun oldin" ko'rsatish uchun. */
  sinceIso: string | null;
  dueIso?: string | null;
  link: string;
  quickAction?: TeacherQuickAction;
}

const ATTENDANCE_LOOKBACK_DAYS = 21;

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function computeTeacherTaskFeed(teacherId: number): Promise<TeacherTaskItem[]> {
  const items: TeacherTaskItem[] = [];

  // 1) Mavzu quvuri: material → konspekt → kontent → chop etish → faktcheck.
  const topics = await prisma.topic.findMany({
    where: { course: { teacherId } },
    select: {
      id: true,
      title: true,
      createdAt: true,
      course: { select: { name: true } },
      materials: { select: { parseStatus: true } },
      digest: { select: { approvedByTeacher: true, updatedAt: true } },
      contentItems: { select: { status: true, factcheckStatus: true } },
    },
    orderBy: { id: "asc" },
  });

  for (const t of topics) {
    const hasDoneMaterial = t.materials.some((m) => m.parseStatus === "DONE");
    const digestApproved = t.digest?.approvedByTeacher === true;
    const hasContent = t.contentItems.length > 0;
    if (!hasDoneMaterial) {
      items.push({ id: `material:${t.id}`, kind: "material_missing", tone: "brand", title: t.title, subtitle: t.course.name, sinceIso: t.createdAt.toISOString(), link: `/teach/topics/${t.id}?step=material` });
      continue;
    }
    if (!digestApproved) {
      items.push({ id: `digest:${t.id}`, kind: "digest_approve", tone: "amber", title: t.title, subtitle: t.course.name, sinceIso: (t.digest?.updatedAt ?? t.createdAt).toISOString(), link: `/teach/topics/${t.id}?step=digest` });
      continue;
    }
    if (!hasContent) {
      items.push({ id: `content:${t.id}`, kind: "content_create", tone: "violet", title: t.title, subtitle: t.course.name, sinceIso: t.createdAt.toISOString(), link: `/teach/topics/${t.id}?step=generate` });
      continue;
    }
    if (t.contentItems.some((c) => c.status === "DRAFT" || c.status === "REVIEW")) {
      items.push({ id: `publish:${t.id}`, kind: "content_publish", tone: "blue", title: t.title, subtitle: t.course.name, sinceIso: t.createdAt.toISOString(), link: `/teach/topics/${t.id}?step=publish` });
    }
    if (t.contentItems.some((c) => c.factcheckStatus === "FLAGGED")) {
      items.push({ id: `factcheck:${t.id}`, kind: "factcheck", tone: "amber", title: t.title, subtitle: t.course.name, sinceIso: t.createdAt.toISOString(), link: `/teach/topics/${t.id}?step=factcheck` });
    }
  }

  // 2) Keys javoblarini tekshirish — har talaba/keys alohida qator, "N ta" emas.
  const caseRows = await prisma.caseAttempt.findMany({
    where: { reviewedAt: null, clinicalCase: { contentItem: { topic: { course: { teacherId } } } } },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      submittedAt: true,
      student: { select: { fullName: true } },
      clinicalCase: { select: { contentItem: { select: { topic: { select: { title: true, course: { select: { name: true } } } } } } } },
    },
  });
  for (const r of caseRows) {
    const topic = r.clinicalCase.contentItem.topic;
    items.push({
      id: `case:${r.id}`,
      kind: "cases_review",
      tone: "rose",
      title: r.student.fullName,
      subtitle: `${topic.title} · ${topic.course.name}`,
      sinceIso: r.submittedAt.toISOString(),
      link: `/teach/cases/review?open=${r.id}`,
    });
  }

  // 3) Yo'qlama belgilanmagan darslar — slotlardan hosil bo'lgan HAQIQIY darslar
  // (LessonSession birinchi belgilashda lazy yaratiladi — shuning uchun eski
  // `lessonSession.findMany` bilan hisoblab bo'lmaydi, getTeacherLessons kerak).
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - ATTENDANCE_LOOKBACK_DAYS);
  const lessons = await getTeacherLessons(teacherId, { from: dayKeyOf(from), to: dayKeyOf(today) }).catch(() => []);
  for (const l of lessons) {
    if (l.status !== "UNMARKED" || new Date(l.date) >= today) continue;
    items.push({
      id: `attendance:${l.courseId}:${l.groupId ?? "x"}:${l.dayKey}`,
      kind: "attendance_unmarked",
      tone: "amber",
      title: l.courseName,
      subtitle: l.groupName ?? "",
      sinceIso: l.date,
      link: "/teach/schedule",
      quickAction: { type: "attendance", courseId: l.courseId, date: l.dayKey, startTime: l.startTime, groupId: l.groupId },
    });
  }

  // 4) Orqada qolgan talabalar — mavjud progress-matritsadan (ism bilan).
  const courses = await prisma.course.findMany({ where: { teacherId }, select: { id: true } });
  for (const c of courses) {
    const loaded = await loadCourse(c.id).catch(() => null);
    if (!loaded) continue;
    const { students } = await buildMatrix(loaded);
    for (const s of students.filter((x) => x.behind)) {
      items.push({
        id: `behind:${c.id}:${s.id}`,
        kind: "students_behind",
        tone: "rose",
        title: s.fullName,
        subtitle: loaded.name,
        sinceIso: s.lastActiveAt,
        link: `/teach/courses/${c.id}/progress`,
      });
    }
  }

  // 5) Kafedra/admin tayinlagan vazifalar — bitta navbatga qo'shiladi (ikkita
  // ajralgan blok o'rniga), muddati o'tgan/HIGH → rose.
  const assigned = await listAssigned(teacherId);
  const now = Date.now();
  for (const a of assigned) {
    const overdue = a.dueDate ? new Date(a.dueDate).getTime() < now : false;
    const tone: TaskTone = overdue || a.priority === "HIGH" ? "rose" : a.priority === "NORMAL" ? "amber" : "blue";
    items.push({
      id: `assigned:${a.id}`,
      kind: "assigned",
      tone,
      title: a.title,
      subtitle: a.createdByName,
      description: a.description,
      sinceIso: a.createdAt,
      dueIso: a.dueDate,
      link: a.linkUrl ?? "",
      quickAction: { type: "done", taskId: a.id },
    });
  }

  items.sort((a, b) => {
    const r = TONE_RANK[a.tone] - TONE_RANK[b.tone];
    if (r !== 0) return r;
    const at = a.sinceIso ? new Date(a.sinceIso).getTime() : Infinity;
    const bt = b.sinceIso ? new Date(b.sinceIso).getTime() : Infinity;
    return at - bt;
  });

  return items;
}

// ---------- Student ----------

export async function computeStudentAutoTasks(studentId: number): Promise<AutoTask[]> {
  const ids = await enrolledCourseIds(studentId);

  // Har tur uchun ANIQ ro'yxat yig'amiz (mavhum "1 ta test" emas).
  const study: AutoTaskItem[] = [];
  const quiz: AutoTaskItem[] = [];
  const cases: AutoTaskItem[] = [];

  for (const id of ids) {
    const course = await loadCourse(id).catch(() => null);
    if (!course) continue;
    const pm = await studentFactsMap(studentId, course);
    const topics = computeTopics(course, pm);
    const current = topics.find((t) => t.state === "IN_PROGRESS") ?? topics.find((t) => t.state === "AVAILABLE");
    if (!current) continue;
    const courseName = course.name;
    const base = { topicId: current.id, topicTitle: current.title, courseName };
    study.push({ ...base, link: `/app/topics/${current.id}` });
    if (current.elements.quiz.exists && current.elements.quiz.score === null) {
      quiz.push({ ...base, link: `/app/topics/${current.id}?tab=quiz` });
    }
    if (current.elements.case.exists && !current.elements.case.submitted) {
      cases.push({ ...base, link: `/app/topics/${current.id}?tab=case` });
    }
  }

  // Baholangan keyslar (izoh keldi) + past davomat.
  const [gradedRows, marks] = await Promise.all([
    prisma.caseAttempt.findMany({
      where: { studentId, reviewedAt: { not: null } },
      orderBy: { reviewedAt: "desc" },
      take: 5,
      select: {
        score: true,
        clinicalCase: {
          select: {
            contentItem: {
              select: { topicId: true, topic: { select: { title: true, course: { select: { name: true } } } } },
            },
          },
        },
      },
    }),
    prisma.attendance.groupBy({ by: ["status"], where: { studentId }, _count: true }),
  ]);

  let present = 0, late = 0, marked = 0;
  for (const m of marks) {
    marked += m._count;
    if (m.status === "PRESENT") present += m._count;
    else if (m.status === "LATE") late += m._count;
  }
  const attendancePct = marked === 0 ? 100 : Math.round(((present + late) / marked) * 100);

  const graded: AutoTaskItem[] = gradedRows.map((g) => {
    const ci = g.clinicalCase.contentItem;
    return {
      topicId: ci.topicId,
      topicTitle: ci.topic.title,
      courseName: ci.topic.course.name,
      link: `/app/topics/${ci.topicId}?tab=case`,
      value: g.score,
    };
  });

  const tasks: AutoTask[] = [];
  const push = (type: string, tone: TaskTone, items: AutoTaskItem[]) => {
    if (items.length > 0) tasks.push({ type, count: items.length, tone, link: items[0].link, items });
  };
  push("study", "brand", study);
  push("quiz_todo", "blue", quiz);
  push("case_todo", "rose", cases);
  push("case_graded", "emerald", graded);
  if (marked > 0 && attendancePct < 75) {
    tasks.push({ type: "attendance_low", count: attendancePct, tone: "amber", link: "/app/attendance", items: [] });
  }
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
  status: "OPEN" | "DONE" | "DISMISSED";
  doneAt: string | null;
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

/** Tasks assigned to me. Default — faqat OPEN ("inbox"); `includeDone` bilan
 *  bajarilganlar ham qaytadi (vazifalar sahifasidagi "Bajarilganlar" bo'limi). */
export async function listAssigned(userId: number, includeDone = false): Promise<AssignedTaskDto[]> {
  const rows = await prisma.task.findMany({
    where: { assignedToId: userId, ...(includeDone ? {} : { status: "OPEN" }) },
    include: { createdBy: { select: { fullName: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
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
    status: t.status,
    doneAt: t.completedAt?.toISOString() ?? null,
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

// ---------- Statistika: oxirgi oylarda bajarilgan vazifalar ----------
// Ikki oqim mustaqil: kafedradan MENGA kelgan (assignedToId=teacher) va MEN
// talabalarga bergan (createdById=teacher, Task modeli faqat shu ikki yo'nalishni
// biladi — @@ birlashtirish shart emas). Filtr talab qilinganda ("kafedradan"
// vs "talabalarga bergan") shu ikkisi ustida ishlaydi.

const TASK_HISTORY_MONTHS = 6;

export interface TaskHistoryBucket {
  key: string; // "YYYY-MM"
  count: number;
}

export interface CompletedTaskRow {
  id: number;
  title: string;
  completedAt: string;
  /** kafedra oqimida — kim tayinlagan; talabalar oqimida — kimga tayinlangan. */
  counterpart: string;
}

export interface TaskHistorySeries {
  total: number;
  months: TaskHistoryBucket[];
  recent: CompletedTaskRow[];
}

export interface TeacherTaskHistory {
  kafedra: TaskHistorySeries;
  toStudents: TaskHistorySeries;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function emptyMonthBuckets(now: Date): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = TASK_HISTORY_MONTHS - 1; i >= 0; i--) {
    m.set(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)), 0);
  }
  return m;
}

/** Oxirgi 6 oyda bajarilgan vazifalar — kafedradan kelgan va talabalarga
 *  berilgan ikki mustaqil qatorda, oylik son + so'nggi qatorlar bilan. */
export async function getTeacherTaskHistory(teacherId: number): Promise<TeacherTaskHistory> {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - (TASK_HISTORY_MONTHS - 1), 1);

  const [kafedraDone, toStudentsDone] = await Promise.all([
    prisma.task.findMany({
      where: { assignedToId: teacherId, status: "DONE", completedAt: { gte: since } },
      select: { id: true, title: true, completedAt: true, createdBy: { select: { fullName: true } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { createdById: teacherId, status: "DONE", completedAt: { gte: since } },
      select: { id: true, title: true, completedAt: true, assignedTo: { select: { fullName: true } } },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const toMonths = (rows: { completedAt: Date | null }[]): TaskHistoryBucket[] => {
    const buckets = emptyMonthBuckets(now);
    for (const r of rows) {
      if (!r.completedAt) continue;
      const k = monthKey(r.completedAt);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([key, count]) => ({ key, count }));
  };

  return {
    kafedra: {
      total: kafedraDone.length,
      months: toMonths(kafedraDone),
      recent: kafedraDone.slice(0, 8).map((r) => ({ id: r.id, title: r.title, completedAt: r.completedAt!.toISOString(), counterpart: r.createdBy.fullName })),
    },
    toStudents: {
      total: toStudentsDone.length,
      months: toMonths(toStudentsDone),
      recent: toStudentsDone.slice(0, 8).map((r) => ({ id: r.id, title: r.title, completedAt: r.completedAt!.toISOString(), counterpart: r.assignedTo.fullName })),
    },
  };
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
