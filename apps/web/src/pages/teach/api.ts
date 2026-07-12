import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { UnlockRule } from "./topics/api";

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
