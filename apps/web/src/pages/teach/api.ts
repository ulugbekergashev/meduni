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
