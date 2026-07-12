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
