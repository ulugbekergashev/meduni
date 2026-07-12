import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "../../lib/api";
import type { UnlockRule } from "./topics/api";

export { API_URL };

export interface TeachCourse {
  id: number;
  subjectNameUz: string;
  subjectNameRu: string;
  departmentNameUz: string;
  departmentNameRu: string;
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

export interface TeachGroup {
  id: number;
  name: string;
  yearOfStudy: number;
  facultyNameUz: string;
  facultyNameRu: string;
  subjects: { uz: string; ru: string }[];
  students: { id: number; fullName: string; email: string }[];
  studentCount: number;
}

export function useTeachGroups() {
  return useQuery({ queryKey: ["teach-groups"], queryFn: () => api<TeachGroup[]>("/api/v1/teach/groups") });
}

export interface SyllabusTopic {
  id: number;
  titleUz: string;
  titleRu: string;
  orderIndex: number;
  hours: number;
  note: string;
}
export interface Syllabus {
  courseId: number;
  subjectNameUz: string;
  subjectNameRu: string;
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
  titleUz: string;
  titleRu: string;
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

export interface TeachDashboard {
  courses: {
    id: number;
    subjectNameUz: string;
    subjectNameRu: string;
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
  };
  upcomingSessions: {
    id: number;
    courseId: number;
    date: string;
    subjectNameUz: string;
    subjectNameRu: string;
    title: string | null;
    room: string | null;
  }[];
}

export function useTeachDashboard() {
  return useQuery({ queryKey: ["teach-dashboard"], queryFn: () => api<TeachDashboard>("/api/v1/teach/dashboard") });
}

// ---------------- Case review queue (Module 14) ----------------

export type ReviewStatus = "PENDING" | "REVIEWED";

export interface QueueItem {
  id: number;
  studentName: string;
  courseId: number;
  subjectNameUz: string;
  subjectNameRu: string;
  topicId: number;
  topicUz: string;
  topicRu: string;
  submittedAt: string;
  reviewedAt: string | null;
  score: number | null;
  status: ReviewStatus;
}

export interface ReviewFilters {
  courses: { id: number; nameUz: string; nameRu: string }[];
  topics: { id: number; courseId: number; titleUz: string; titleRu: string }[];
}

export interface CaseReviewDetail {
  id: number;
  studentName: string;
  courseId: number;
  subjectNameUz: string;
  subjectNameRu: string;
  topicUz: string;
  topicRu: string;
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
  titleUz: string | null;
  titleRu: string | null;
  topicId: number | null;
  room: string | null;
  markedCount: number;
  rosterSize: number;
  status: "UNMARKED" | "PARTIAL" | "FULL";
}

export interface RosterData {
  session: { id: number; date: string; title: string | null; topicId: number | null; room: string | null; groupName: string | null };
  students: { id: number; fullName: string; status: AttStatus | null }[];
}

export interface AttReport {
  sessions: { id: number; date: string; title: string | null; titleUz: string | null; titleRu: string | null }[];
  students: {
    id: number;
    fullName: string;
    cells: Record<number, AttStatus>;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendancePct: number | null;
  }[];
}

export interface DateRange {
  from?: string;
  to?: string;
  search?: string;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions", courseId] }),
  });
}

export function useUpdateSession(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { id: number; date?: string; title?: string; topicId?: number | null; room?: string }) =>
      api(`/api/v1/teach/sessions/${b.id}`, { method: "PATCH", body: JSON.stringify(b) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions", courseId] }),
  });
}

export function useDeleteSession(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/teach/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions", courseId] }),
  });
}

export function useRoster(sessionId: number | null) {
  return useQuery({
    queryKey: ["roster", sessionId],
    queryFn: () => api<RosterData>(`/api/v1/teach/sessions/${sessionId}/roster`),
    enabled: sessionId !== null,
    retry: false,
  });
}

export function useMarkAttendance(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { sessionId: number; marks: { studentId: number; status: AttStatus }[] }) =>
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
  return useQuery({ queryKey: ["att-report", courseId, range], queryFn: () => api<AttReport>(`/api/v1/teach/courses/${courseId}/attendance-report?${p}`) });
}
