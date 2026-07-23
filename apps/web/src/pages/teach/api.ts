import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "../../lib/api";
import type { UnlockRule } from "./topics/api";

export { API_URL };

export interface TeachCourse {
  id: number;
  subjectName: string;
  departmentName: string;
  teacherName: string;
  semester: number;
  academicYear: string;
  groups: { id: number; name: string }[];
  studentCount: number;
  defaultUnlockRuleJson?: UnlockRule | null;
}

export function useTeachCourses() {
  return useQuery({
    queryKey: ["teach-courses"],
    queryFn: () => api<TeachCourse[]>("/api/v1/teach/courses"),
  });
}

export interface GroupStudent {
  id: number;
  fullName: string;
  email: string;
  overallPct: number;
  avgQuizScore: number | null;
  attendancePct: number | null;
  lastActiveAt: string | null;
  behind: boolean;
  /** Guruh ichidagi o'rin (progress, teng bo'lsa test balli bo'yicha). */
  rank: number;
}
export interface TeachGroup {
  id: number;
  name: string;
  yearOfStudy: number;
  facultyName: string;
  courses: { id: number; name: string }[];
  students: GroupStudent[];
  studentCount: number;
  avgProgress: number;
  avgAttendance: number | null;
  behindCount: number;
}

export function useTeachGroups() {
  return useQuery({ queryKey: ["teach-groups"], queryFn: () => api<TeachGroup[]>("/api/v1/teach/groups") });
}

export function useTeachGroup(groupId: number) {
  return useQuery({ queryKey: ["teach-group", groupId], queryFn: () => api<TeachGroup>(`/api/v1/teach/groups/${groupId}`), retry: false });
}

export interface CourseGroupStat {
  groupId: number;
  name: string;
  yearOfStudy: number;
  facultyName: string;
  studentCount: number;
  avgProgress: number;
}

export function useCourseGroupsStats(courseId: number) {
  return useQuery({ queryKey: ["course-groups", courseId], queryFn: () => api<CourseGroupStat[]>(`/api/v1/teach/courses/${courseId}/groups`) });
}

export interface StudentDetailTopic {
  id: number;
  title: string;
  state: CellState;
  pct: number;
  hasQuiz: boolean;
  quizScore: number | null;
  hasCase: boolean;
  caseSubmitted: boolean;
  caseReviewed: boolean;
  caseScore: number | null;
  caseFeedback: string | null;
  caseAttemptId: number | null;
}
export interface StudentDetailCourse {
  courseId: number;
  subjectName: string;
  topicsTotal: number;
  completedCount: number;
  overallPct: number;
  attendance: { present: number; absent: number; late: number; excused: number; pct: number | null; avgGrade: number | null };
  topics: StudentDetailTopic[];
}
export interface StudentDetail {
  student: { id: number; fullName: string; email: string; groupId: number | null; groupName: string | null };
  courses: StudentDetailCourse[];
}

export function useStudentDetail(studentId: number) {
  return useQuery({ queryKey: ["student-detail", studentId], queryFn: () => api<StudentDetail>(`/api/v1/teach/students/${studentId}`), retry: false });
}

export interface SyllabusTopic {
  id: number;
  title: string;
  orderIndex: number;
  hours: number;
  note: string;
}
export interface Syllabus {
  courseId: number;
  subjectName: string;
  description: string;
  objectives: string[];
  literature: string[];
  topics: SyllabusTopic[];
  totalHours: number;
}
export interface SyllabusSave {
  description: string;
  objectives: string[];
  literature: string[];
  topics: { id: number; hours: number; note: string }[];
}

export function useSyllabus(courseId: number) {
  return useQuery({ queryKey: ["syllabus", courseId], queryFn: () => api<Syllabus>(`/api/v1/teach/courses/${courseId}/syllabus`), retry: false });
}
export function useSaveSyllabus(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SyllabusSave) => api(`/api/v1/teach/courses/${courseId}/syllabus`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["syllabus", courseId] }),
  });
}

/** Lightweight metadata for the course shell — keyed by id so it stays cached across tab switches. */
export function useTeachCourseMeta(id: number) {
  return useQuery({
    queryKey: ["teach-course", id],
    queryFn: () => api<TeachCourse>(`/api/v1/teach/courses/${id}`),
    retry: false,
  });
}

// ---- Kurs guruh chati (Modul 25) — o'qituvchi tomoni ----

export interface ChatMessage {
  id: number;
  text: string;
  authorId: number;
  authorName: string;
  role: "teacher" | "student";
  mine: boolean;
  createdAt: string;
}

export function useCourseChat(courseId: number) {
  return useQuery({
    queryKey: ["teach-course-chat", courseId],
    queryFn: () => api<{ messages: ChatMessage[] }>(`/api/v1/teach/courses/${courseId}/chat`),
    refetchInterval: 5000,
  });
}

export function useCourseChatMeta(courseId: number) {
  return useQuery({
    queryKey: ["teach-course-chat-meta", courseId],
    queryFn: () => api<{ courseId: number; name: string; teacherName: string; memberCount: number }>(
      `/api/v1/teach/courses/${courseId}/chat/meta`
    ),
  });
}

export function useSendCourseChat(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api<ChatMessage>(`/api/v1/teach/courses/${courseId}/chat`, { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: (msg) => {
      qc.setQueryData<{ messages: ChatMessage[] }>(["teach-course-chat", courseId], (old) => {
        const list = old?.messages ?? [];
        if (list.some((m) => m.id === msg.id)) return old!;
        return { messages: [...list, msg] };
      });
    },
  });
}

export function useUpdateCourseSettings(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (defaultUnlockRuleJson: UnlockRule) =>
      api(`/api/v1/teach/courses/${courseId}/settings`, { method: "PUT", body: JSON.stringify({ defaultUnlockRuleJson }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teach-course", courseId] }),
  });
}

// ---------------- Progress + dashboard (Module 13) ----------------

export type CellState = "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";

export interface ProgressElements {
  video: { exists: boolean; watchedPct: number };
  slides: { exists: boolean; viewed: boolean };
  quiz: { exists: boolean; score: number | null };
  case: { exists: boolean; submitted: boolean; reviewed: boolean };
}

export interface ProgressCell {
  topicId: number;
  state: CellState;
  pct: number;
  elements: ProgressElements;
}

export interface ProgressStudent {
  id: number;
  fullName: string;
  overallPct: number;
  completedCount: number;
  lastActiveAt: string | null;
  avgQuizScore: number | null;
  behind: boolean;
  cells: ProgressCell[];
}

export interface ProgressTopic {
  id: number;
  title: string;
  orderIndex: number;
}

export interface CourseProgress {
  courseId: number;
  stats: { total: number; active: number; behind: number; avgProgress: number; completed: number };
  topics: ProgressTopic[];
  students: ProgressStudent[];
}

export function useCourseProgress(courseId: number) {
  return useQuery({
    queryKey: ["course-progress", courseId],
    queryFn: () => api<CourseProgress>(`/api/v1/teach/courses/${courseId}/progress`),
    retry: false,
  });
}

export function useManualUnlock(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { studentId: number; topicId: number }) =>
      api(`/api/v1/teach/courses/${courseId}/unlock`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-progress", courseId] }),
  });
}

export interface RankedStudent {
  id: number;
  fullName: string;
  overallPct: number;
  behind: boolean;
  lastActiveAt: string | null;
}

export interface TeachDashboard {
  courses: {
    id: number;
    subjectName: string;
    groupName: string | null;
    semester: number;
    studentCount: number;
    avgProgress: number;
  }[];
  tasks: { casesToReview: number; contentToApprove: number; studentsBehind: number };
  stats: {
    students: number;
    courses: number;
    groups: string[];
    publishedTopics: number;
    totalTopics: number;
    publishedContent: number;
    casesReviewed: number;
    avgProgress: number;
    avgAttendance: number | null;
    groupList: { id: number; name: string }[];
  };
  ranking: { top: RankedStudent[]; behind: RankedStudent[] };
  upcomingSessions: {
    id: number;
    courseId: number;
    groupId: number | null;
    date: string;
    subjectName: string;
    title: string | null;
    room: string | null;
  }[];
}

export function useTeachDashboard() {
  return useQuery({ queryKey: ["teach-dashboard"], queryFn: () => api<TeachDashboard>("/api/v1/teach/dashboard") });
}

// ---------------- My Tasks hub ----------------

export type TaskTone = "rose" | "amber" | "blue" | "brand" | "violet" | "emerald";
export interface AutoTask {
  type: string;
  count: number;
  tone: TaskTone;
  link: string;
}
export interface AssignedTask {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: "LOW" | "NORMAL" | "HIGH";
  createdByName: string;
  createdAt: string;
  linkUrl: string | null;
}
export interface TasksInbox {
  auto: AutoTask[];
  assigned: AssignedTask[];
}

export function useTeachTasks() {
  return useQuery({ queryKey: ["teach-tasks"], queryFn: () => api<TasksInbox>("/api/v1/teach/tasks") });
}

export function useSetTaskDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: true }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teach-tasks"] }),
  });
}

// Assignments the teacher created for students/groups.
export interface CreatedTaskGroup {
  key: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  total: number;
  done: number;
  assignees: string[];
  taskIds: number[];
}
export function useMyCreatedTasks() {
  return useQuery({ queryKey: ["teach-created-tasks"], queryFn: () => api<CreatedTaskGroup[]>("/api/v1/tasks/created") });
}

export interface AssignTaskBody {
  title: string;
  description?: string;
  dueDate?: string | null;
  studentId?: number;
  groupId?: number;
}
export function useAssignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignTaskBody) => api<{ count: number }>("/api/v1/tasks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teach-created-tasks"] }),
  });
}
export function useDeleteMyTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teach-created-tasks"] }),
  });
}

// ---------------- Case review queue (Module 14) ----------------

export type ReviewStatus = "PENDING" | "REVIEWED";

export interface QueueItem {
  id: number;
  studentName: string;
  courseId: number;
  subjectName: string;
  topicId: number;
  topic: string;
  submittedAt: string;
  reviewedAt: string | null;
  score: number | null;
  status: ReviewStatus;
}

export interface ReviewFilters {
  courses: { id: number; name: string }[];
  topics: { id: number; courseId: number; title: string }[];
}

export interface CaseReviewDetail {
  id: number;
  studentId: number;
  studentName: string;
  courseId: number;
  subjectName: string;
  topic: string;
  blocks: { complaints: string; anamnesis: string; objectiveStatus: string; labData: string };
  questions: string[];
  referenceAnswer: string[];
  answers: string[];
  submittedAt: string;
  score: number | null;
  feedback: string | null;
  reviewedAt: string | null;
  status: ReviewStatus;
}

export interface QueueQuery {
  courseId?: number;
  topicId?: number;
  status: "PENDING" | "REVIEWED" | "all";
  search: string;
  sort: "oldest" | "newest";
}

export function useReviewQueue(q: QueueQuery) {
  const params = new URLSearchParams();
  if (q.courseId) params.set("courseId", String(q.courseId));
  if (q.topicId) params.set("topicId", String(q.topicId));
  params.set("status", q.status);
  if (q.search.trim()) params.set("search", q.search.trim());
  params.set("sort", q.sort);
  return useQuery({
    queryKey: ["review-queue", q],
    queryFn: () => api<QueueItem[]>(`/api/v1/teach/cases/review?${params.toString()}`),
  });
}

export function useReviewFilters() {
  return useQuery({ queryKey: ["review-filters"], queryFn: () => api<ReviewFilters>("/api/v1/teach/cases/filters") });
}

export function useCaseReviewDetail(id: number | null) {
  return useQuery({
    queryKey: ["case-review", id],
    queryFn: () => api<CaseReviewDetail>(`/api/v1/teach/cases/${id}`),
    enabled: id !== null,
    retry: false,
  });
}

export function useReviewCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { id: number; score: number; feedback: string }) =>
      api(`/api/v1/teach/cases/${b.id}/review`, { method: "POST", body: JSON.stringify({ score: b.score, feedback: b.feedback }) }),
    onSuccess: (_d, b) => {
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["case-review", b.id] });
      qc.invalidateQueries({ queryKey: ["teach-dashboard"] });
    },
  });
}

// ---------------- Attendance (Module 15) ----------------

export type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface SessionRow {
  id: number;
  date: string;
  title: string | null;
  topicId: number | null;
  room: string | null;
  markedCount: number;
  rosterSize: number;
  status: "UNMARKED" | "PARTIAL" | "FULL";
}

export interface RosterData {
  session: { id: number; date: string; title: string | null; topicId: number | null; room: string | null; groupName: string | null };
  students: { id: number; fullName: string; status: AttStatus | null; grade: number | null }[];
}

export interface AttCell {
  status: AttStatus;
  grade: number | null;
}

export interface AttReport {
  sessions: { id: number; date: string; title: string | null }[];
  students: {
    id: number;
    fullName: string;
    cells: Record<number, AttCell>;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendancePct: number | null;
    avgGrade: number | null;
  }[];
}

export interface DateRange {
  from?: string;
  to?: string;
  search?: string;
  groupId?: number;
}

export function useSessions(courseId: number, range: DateRange) {
  const p = new URLSearchParams();
  if (range.from) p.set("from", range.from);
  if (range.to) p.set("to", range.to);
  if (range.search?.trim()) p.set("search", range.search.trim());
  return useQuery({ queryKey: ["sessions", courseId, range], queryFn: () => api<SessionRow[]>(`/api/v1/teach/courses/${courseId}/sessions?${p}`) });
}

export function useCreateSession(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { date: string; title?: string; topicId?: number | null; room?: string }) =>
      api(`/api/v1/teach/courses/${courseId}/sessions`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", courseId] });
      qc.invalidateQueries({ queryKey: ["att-report", courseId] }); // journal columns
    },
  });
}

export function useUpdateSession(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { id: number; date?: string; title?: string; topicId?: number | null; room?: string }) =>
      api(`/api/v1/teach/sessions/${b.id}`, { method: "PATCH", body: JSON.stringify(b) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", courseId] });
      qc.invalidateQueries({ queryKey: ["att-report", courseId] });
    },
  });
}

export function useDeleteSession(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/teach/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", courseId] });
      qc.invalidateQueries({ queryKey: ["att-report", courseId] });
    },
  });
}

export function useRoster(sessionId: number | null, groupId?: number) {
  return useQuery({
    queryKey: ["roster", sessionId, groupId],
    queryFn: () => api<RosterData>(`/api/v1/teach/sessions/${sessionId}/roster${groupId ? `?groupId=${groupId}` : ""}`),
    enabled: sessionId !== null,
    retry: false,
  });
}

export function useMarkAttendance(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { sessionId: number; marks: { studentId: number; status: AttStatus; grade?: number | null }[] }) =>
      api(`/api/v1/teach/sessions/${b.sessionId}/attendance`, { method: "POST", body: JSON.stringify({ marks: b.marks }) }),
    onSuccess: (_d, b) => {
      qc.invalidateQueries({ queryKey: ["sessions", courseId] });
      qc.invalidateQueries({ queryKey: ["roster", b.sessionId] });
      qc.invalidateQueries({ queryKey: ["att-report", courseId] });
    },
  });
}

export function useAttendanceReport(courseId: number, range: DateRange) {
  const p = new URLSearchParams();
  if (range.from) p.set("from", range.from);
  if (range.to) p.set("to", range.to);
  if (range.search?.trim()) p.set("search", range.search.trim());
  if (range.groupId) p.set("groupId", String(range.groupId));
  return useQuery({ queryKey: ["att-report", courseId, range], queryFn: () => api<AttReport>(`/api/v1/teach/courses/${courseId}/attendance-report?${p}`) });
}
