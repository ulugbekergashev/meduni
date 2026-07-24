import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "../../lib/api";
import type { UnlockRule } from "./topics/api";

export { API_URL };

export interface TeachCourse {
  id: number;
  subjectName: string; // The backend now sends loaded.name here which we can rename or keep as subjectName but I will just rename to courseName in UI
  departmentName: string;
  teacherName: string;
  semester: number;
  academicYear: string;
  groups: { id: number; name: string }[];
  studentCount: number;
  defaultUnlockRuleJson?: UnlockRule | null;
  /** Ochilish shartlari (mustaqil, birga ishlaydi). */
  scheduleUnlock?: boolean;
  sequentialUnlock?: boolean;
}

export function useTeachCourses() {
  return useQuery({
    queryKey: ["teach-courses"],
    queryFn: () => api<TeachCourse[]>("/api/v1/teach/courses"),
  });
}

// O'qituvchi o'zi kurs yaratadi
export interface CourseFormOptions {
  departmentId: number;
  departmentName: string;
  facultyName: string;
  groups: { id: number; name: string; yearOfStudy: number; studentCount: number }[];
}
export function useCourseFormOptions() {
  return useQuery({ queryKey: ["teach-course-form-options"], queryFn: () => api<CourseFormOptions>("/api/v1/teach/course-form-options") });
}
export function useCreateTeacherCourse() {
  const qc = useQueryClient();
  return useMutation({
    // Semestr endi formada yo'q — backend default beradi (buyurtmachi qarori).
    mutationFn: (body: { name: string; description?: string; groupIds: number[]; academicYear?: string }) =>
      api<TeachCourse & { enrolledCount: number }>("/api/v1/teach/courses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teach-courses"] });
      qc.invalidateQueries({ queryKey: ["teach-dashboard"] });
    },
  });
}

/** O'qituvchi o'z fakultetida yangi guruh yaratadi. */
export function useCreateTeacherGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; yearOfStudy: number }) =>
      api<{ id: number; name: string; yearOfStudy: number; studentCount: number }>("/api/v1/teach/groups", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teach-groups"] });
      qc.invalidateQueries({ queryKey: ["teach-course-form-options"] });
    },
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
/** Guruhning bitta kurs bo'yicha hisoboti (profil pastida ko'rsatiladi). */
export interface GroupCourseReport {
  id: number;
  name: string;
  studentCount: number;
  topicsTotal: number;
  avgProgress: number;
  avgQuizScore: number | null;
  behindCount: number;
}
export interface TeachGroup {
  id: number;
  name: string;
  yearOfStudy: number;
  facultyName: string;
  courses: { id: number; name: string }[];
  /** Guruhning har kurs bo'yicha o'zlashtirish hisoboti. */
  courseReport: GroupCourseReport[];
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

// Guruh biriktirish (o'qituvchi o'z kursiga)
export interface AssignableGroup {
  id: number;
  name: string;
  yearOfStudy: number;
  studentCount: number;
}
export function useAssignableGroups(courseId: number) {
  return useQuery({
    queryKey: ["assignable-groups", courseId],
    queryFn: () => api<AssignableGroup[]>(`/api/v1/teach/courses/${courseId}/assignable-groups`),
  });
}
function useGroupMutation(courseId: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["course-groups", courseId] });
    qc.invalidateQueries({ queryKey: ["assignable-groups", courseId] });
    qc.invalidateQueries({ queryKey: ["teach-course", courseId] });
  };
}
export function useAttachGroup(courseId: number) {
  const invalidate = useGroupMutation(courseId);
  return useMutation({
    mutationFn: (groupId: number) =>
      api<{ ok: boolean; enrolled: number }>(`/api/v1/teach/courses/${courseId}/groups`, { method: "POST", body: JSON.stringify({ groupId }) }),
    onSuccess: invalidate,
  });
}
export function useDetachGroup(courseId: number) {
  const invalidate = useGroupMutation(courseId);
  return useMutation({
    mutationFn: (groupId: number) => api(`/api/v1/teach/courses/${courseId}/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export interface StudentDetailTopic {
  id: number;
  title: string;
  state: CellState;
  pct: number;
  reason: { uz: string; ru: string } | null;
  hasQuiz: boolean;
  quizScore: number | null;
  hasCase: boolean;
  caseSubmitted: boolean;
  caseReviewed: boolean;
  caseScore: number | null;
  caseFeedback: string | null;
  caseAttemptId: number | null;
}
export interface StudentDetailSession {
  date: string;
  /** Dars vaqti "HH:MM" — baho aynan shu darsga yoziladi (bir kunda bir necha dars). */
  time: string;
  groupId: number | null;
  status: AttStatus;
  grade: number | null;
  topicTitle: string | null;
}
export interface StudentDetailCourse {
  courseId: number;
  subjectName: string;
  topicsTotal: number;
  completedCount: number;
  overallPct: number;
  attendance: { present: number; absent: number; late: number; excused: number; pct: number | null; avgGrade: number | null };
  sessions: StudentDetailSession[];
  topics: StudentDetailTopic[];
}
export interface PracticeSignals {
  cardsReviewed: number;
  cardsKnownPct: number | null;
  patientSessions: number;
  patientAvgScore: number | null;
  tutorQuestions: number;
}

export interface StudentDetail {
  student: { id: number; fullName: string; email: string; groupId: number | null; groupName: string | null };
  /** Modul 28 — amaliyot faolligi (takrorlash/bemor/AI-tutor). */
  practiceSignals: PracticeSignals;
  courses: StudentDetailCourse[];
}

export function useStudentDetail(studentId: number) {
  return useQuery({ queryKey: ["student-detail", studentId], queryFn: () => api<StudentDetail>(`/api/v1/teach/students/${studentId}`), retry: false });
}

/** Talaba profilidan bitta mavzuni qo'lda ochish (qulfdagi mavzuni COMPLETED qiladi). */
export function useUnlockForStudent(studentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { courseId: number; topicId: number }) =>
      api(`/api/v1/teach/courses/${b.courseId}/unlock`, { method: "POST", body: JSON.stringify({ studentId, topicId: b.topicId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-detail", studentId] });
      qc.invalidateQueries({ queryKey: ["course-progress"] });
    },
  });
}

/** Talaba profilidan bitta darsga baho qo'yish (yo'qlama holati saqlanadi). */
export function useGradeSession(studentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { courseId: number; date: string; startTime: string; groupId: number | null; status: AttStatus; grade: number | null }) =>
      api("/api/v1/teach/attendance-by-date", {
        method: "POST",
        body: JSON.stringify({ courseId: b.courseId, date: b.date, startTime: b.startTime, groupId: b.groupId, marks: [{ studentId, status: b.status, grade: b.grade }] }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-detail", studentId] });
      qc.invalidateQueries({ queryKey: ["roster-by-date"] });
      qc.invalidateQueries({ queryKey: ["teacher-lessons"] });
    },
  });
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


// ---- Guruh xatolari xaritasi (Modul 28) ----

export interface MistakeStudent {
  id: number;
  fullName: string;
}

export interface MistakeQuestion {
  questionId: number;
  text: string;
  options: string[];
  correctIndex: number;
  wrongCount: number;
  wrongPct: number;
  distribution: number[];
  noAnswer: number;
  wrongStudents: MistakeStudent[];
}

export interface MistakeStep {
  index: number;
  title: string;
  prompt: string;
  options: { text: string; correct: boolean }[];
  wrongCount: number;
  wrongPct: number;
  distribution: number[];
  wrongStudents: MistakeStudent[];
}

export interface MistakeTopic {
  topicId: number;
  title: string;
  orderIndex: number;
  quiz: { attempted: number; questions: MistakeQuestion[] } | null;
  case: { submitted: number; steps: MistakeStep[] } | null;
  unknownCards: number;
  severity: number;
}

export function useCourseMistakes(courseId: number) {
  return useQuery({
    queryKey: ["teach-mistakes", courseId],
    queryFn: () => api<{ topics: MistakeTopic[]; studentCount: number }>(`/api/v1/teach/courses/${courseId}/mistakes`),
  });
}

export function useUpdateCourseSettings(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { defaultUnlockRuleJson?: UnlockRule; scheduleUnlock?: boolean; sequentialUnlock?: boolean }) =>
      api(`/api/v1/teach/courses/${courseId}/settings`, { method: "PUT", body: JSON.stringify(body) }),
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

// ---------------- My Tasks hub — vazifa borti (3 manba + holat + statistika) ----------------

export type TaskTone = "rose" | "amber" | "blue" | "brand" | "violet" | "emerald";

export type TeacherTaskKind =
  | "cases_review"
  | "material_missing"
  | "digest_approve"
  | "content_create"
  | "content_publish"
  | "factcheck"
  | "attendance_unmarked"
  | "students_behind"
  | "assigned"
  | "students_assignment";

export type TaskSource = "auto" | "kafedra" | "students";
export type TaskBoardStatus = "open" | "overdue" | "done";

export type TeacherQuickAction =
  | { type: "attendance"; courseId: number; date: string; startTime: string; groupId: number | null }
  | { type: "done"; taskId: number };

/** Bitta konkret ish qatori — talaba/mavzu/dars ismi bilan, mavhum son emas. */
export interface TeacherTaskItem {
  id: string;
  source: TaskSource;
  status: TaskBoardStatus;
  kind: TeacherTaskKind;
  tone: TaskTone;
  title: string;
  subtitle: string;
  description?: string | null;
  sinceIso: string | null;
  dueIso?: string | null;
  completedIso?: string | null;
  link: string;
  quickAction?: TeacherQuickAction;
  progress?: { done: number; total: number };
  deletableTaskIds?: number[];
}

export interface TaskHistoryBucket {
  key: string;
  count: number;
}

export interface TaskBoard {
  stats: { toDo: number; overdue: number; waiting: number; done: number };
  counts: { auto: number; kafedra: number; students: number; done: number; overdue: number; all: number };
  items: TeacherTaskItem[];
  months: TaskHistoryBucket[];
}

export function useTaskBoard() {
  return useQuery({ queryKey: ["teach-tasks"], queryFn: () => api<TaskBoard>("/api/v1/teach/tasks") });
}

export function useSetTaskDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: true }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teach-tasks"] }),
  });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teach-tasks"] }),
  });
}
export function useDeleteMyTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teach-tasks"] }),
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

export interface AiSuggest {
  score: number;
  rationale: string;
  missed: string[];
}

export interface PatientSessionLog {
  messages: { role: "student" | "patient"; text: string }[];
  eval: {
    diagnosis: string;
    correct: boolean;
    anamnesisScore: number;
    communicationScore: number;
    overallScore: number;
    strengths: string;
    improvements: string;
  } | null;
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
  /** v2 qadam avto-bahosi. */
  autoScore: number | null;
  submittedAt: string;
  score: number | null;
  feedback: string | null;
  reviewedAt: string | null;
  status: ReviewStatus;
  /** Modul 28 — AI tavsiyasi keshi va talabaning virtual bemor amaliyoti. */
  aiSuggest: AiSuggest | null;
  patientSession: PatientSessionLog | null;
}

/** AI tavsiyaviy baho so'rash (kesh; force qayta generatsiya). */
export function useAiSuggest(attemptId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (force?: boolean) =>
      api<{ suggest: AiSuggest; cached: boolean }>(
        `/api/v1/teach/cases/${attemptId}/ai-suggest${force ? "?force=1" : ""}`,
        { method: "POST" }
      ),
    onSuccess: (r) => {
      qc.setQueryData<CaseReviewDetail>(["case-review", attemptId], (old) =>
        old ? { ...old, aiSuggest: r.suggest } : old
      );
    },
  });
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

// Darslar hub — o'qituvchining barcha kurslaridagi darslar
export interface TeacherSession {
  id: number;
  date: string;
  title: string | null;
  room: string | null;
  courseId: number;
  courseName: string;
  topicTitle: string | null;
  groupId: number | null;
  groupName: string | null;
  markedCount: number;
  rosterSize: number;
  status: "UNMARKED" | "PARTIAL" | "FULL";
}
export function useTeacherSessions(range: { from?: string; to?: string; search?: string }) {
  const p = new URLSearchParams();
  if (range.from) p.set("from", range.from);
  if (range.to) p.set("to", range.to);
  if (range.search?.trim()) p.set("search", range.search.trim());
  return useQuery({ queryKey: ["teacher-sessions", range], queryFn: () => api<TeacherSession[]>(`/api/v1/teach/sessions?${p}`) });
}

// ---- Haftalik takroriy jadval (slotlar) → darslar AVTOMATIK ----
export interface ScheduleSlot {
  id: number;
  courseId: number;
  groupId: number | null;
  weekday: number; // 0=Dushanba..6=Yakshanba
  startTime: string;
  room: string | null;
}
export interface DerivedLesson {
  courseId: number;
  courseName: string;
  groupId: number | null;
  groupName: string | null;
  slotId: number;
  date: string;
  dayKey: string;
  weekday: number;
  startTime: string;
  room: string | null;
  sessionId: number | null;
  markedCount: number;
  rosterSize: number;
  status: "UNMARKED" | "PARTIAL" | "FULL";
}

export function useScheduleSlots(courseId: number, enabled = true) {
  return useQuery({ queryKey: ["schedule-slots", courseId], queryFn: () => api<ScheduleSlot[]>(`/api/v1/teach/courses/${courseId}/schedule-slots`), enabled });
}
function invalidateSchedule(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["schedule-slots"] });
  qc.invalidateQueries({ queryKey: ["teacher-lessons"] });
  qc.invalidateQueries({ queryKey: ["group-timetable"] });
}
export function useAddSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { courseId: number; groupId?: number | null; weekday: number; startTime: string; room?: string }) =>
      api<ScheduleSlot>(`/api/v1/teach/courses/${b.courseId}/schedule-slots`, { method: "POST", body: JSON.stringify({ groupId: b.groupId ?? null, weekday: b.weekday, startTime: b.startTime, room: b.room }) }),
    onSuccess: () => invalidateSchedule(qc),
  });
}
export function useDeleteSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId: number) => api(`/api/v1/teach/schedule-slots/${slotId}`, { method: "DELETE" }),
    onSuccess: () => invalidateSchedule(qc),
  });
}
export function useTeacherLessons(range: { from: string; to: string; search?: string }) {
  const p = new URLSearchParams({ from: range.from, to: range.to });
  if (range.search?.trim()) p.set("search", range.search.trim());
  return useQuery({ queryKey: ["teacher-lessons", range], queryFn: () => api<DerivedLesson[]>(`/api/v1/teach/lessons?${p}`), enabled: !!range.from && !!range.to });
}
export interface GroupTimetableCourse {
  courseId: number;
  courseName: string;
  cycleStart: string | null; // YYYY-MM-DD
  cycleEnd: string | null;
  slots: { slotId: number; weekday: number; startTime: string; room: string | null }[];
}
export interface GroupTimetable {
  courses: GroupTimetableCourse[];
}
export function useGroupTimetable(groupId: number) {
  return useQuery({ queryKey: ["group-timetable", groupId], queryFn: () => api<GroupTimetable>(`/api/v1/teach/groups/${groupId}/timetable`) });
}

/** Sikl masteri — bir marta sana oralig'i + kunlar/vaqtlar → butun jadval. */
export function useSetupCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { courseId: number; groupId: number; cycleStart: string; cycleEnd: string; days: { weekday: number; startTime: string; room?: string }[] }) =>
      api<{ ok: boolean; days: number }>(`/api/v1/teach/courses/${b.courseId}/groups/${b.groupId}/cycle`, {
        method: "POST",
        body: JSON.stringify({ cycleStart: b.cycleStart, cycleEnd: b.cycleEnd, days: b.days }),
      }),
    onSuccess: () => invalidateSchedule(qc),
  });
}

// Yo'qlama (kurs, sana) bo'yicha — sessiya lazy yaratiladi
export interface DateRoster {
  date: string;
  students: { id: number; fullName: string; status: AttStatus | null; grade: number | null }[];
}
export function useRosterByDate(courseId: number, date: string, groupId?: number, time?: string) {
  const p = new URLSearchParams({ courseId: String(courseId), date });
  if (groupId) p.set("groupId", String(groupId));
  if (time) p.set("time", time); // dars = sana+vaqt (bir kunda bir necha dars bo'lishi mumkin)
  return useQuery({ queryKey: ["roster-by-date", courseId, date, groupId, time], queryFn: () => api<DateRoster>(`/api/v1/teach/attendance-by-date?${p}`), enabled: !!courseId && !!date });
}
export function useMarkByDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { courseId: number; date: string; startTime?: string; groupId?: number | null; marks: { studentId: number; status: AttStatus; grade?: number | null }[] }) =>
      api<{ ok: boolean; sessionId: number; marked: number }>("/api/v1/teach/attendance-by-date", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-lessons"] });
      qc.invalidateQueries({ queryKey: ["roster-by-date"] });
      qc.invalidateQueries({ queryKey: ["teach-group"] });
      qc.invalidateQueries({ queryKey: ["attendance-matrix"] });
    },
  });
}

// Davomat matritsasi (talaba × DARS + %) — kurs+guruh, sana oralig'i.
// Ustun = alohida dars (sana+vaqt): bir kunda bir necha dars bo'lishi mumkin.
export interface MatrixColumn {
  key: string;   // "YYYY-MM-DD|HH:MM"
  date: string;
  time: string;
  room: string | null;
}
export interface AttendanceMatrix {
  columns: MatrixColumn[];
  todayKey: string;
  students: { id: number; fullName: string; pct: number | null; cells: Record<string, AttStatus> }[];
}
export function useAttendanceMatrix(courseId: number | null, groupId: number, from: string, to: string) {
  const p = new URLSearchParams({ courseId: String(courseId), groupId: String(groupId), from, to });
  return useQuery({
    queryKey: ["attendance-matrix", courseId, groupId, from, to],
    queryFn: () => api<AttendanceMatrix>(`/api/v1/teach/attendance-matrix?${p}`),
    enabled: !!courseId && !!groupId && !!from && !!to,
  });
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
      qc.invalidateQueries({ queryKey: ["teacher-sessions"] }); // Darslar hub
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
      qc.invalidateQueries({ queryKey: ["teacher-sessions"] }); // Darslar hub
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
