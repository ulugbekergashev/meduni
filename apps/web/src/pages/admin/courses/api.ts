import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export interface CourseRow {
  id: number;
  subjectId: number;
  subjectName: string;
  departmentName: string;
  teacherId: number;
  teacherName: string;
  semester: number;
  academicYear: string;
  groups: { id: number; name: string }[];
  studentCount: number;
}

export interface CourseStudent {
  enrollmentId: number;
  studentId: number;
  fullName: string;
  email: string;
  groupName: string | null;
  status: "ACTIVE" | "DROPPED";
}

export interface CourseDetail extends CourseRow {
  students: CourseStudent[];
  topicCount: number;
}

export interface CreatedCourse extends CourseRow {
  enrolledCount: number;
}

export interface CreateCourseBody {
  subjectId: number;
  teacherId: number;
  semester: number;
  academicYear: string;
  groupIds: number[];
}

interface TeacherLite {
  id: number;
  fullName: string;
}

export interface CourseFilters {
  academicYear?: string;
  semester?: string;
  subjectId?: string;
  teacherId?: string;
  search?: string;
}

/** Kurslar ko'p (har semestrda bir nechta × ko'p semestr) — filtrlash serverda. */
export function useCourses(filters: CourseFilters = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
  const qs = p.toString();
  return useQuery({
    queryKey: ["courses", qs],
    queryFn: () => api<CourseRow[]>(`/api/v1/courses${qs ? `?${qs}` : ""}`),
  });
}

/** Filtr dropdownlari uchun mavjud davrlar. */
export function useCoursePeriods() {
  return useQuery({
    queryKey: ["course-periods"],
    queryFn: () => api<{ years: string[]; semesters: number[] }>("/api/v1/courses/periods"),
  });
}

export function useCourse(id: number) {
  return useQuery({
    queryKey: ["courses", id],
    queryFn: () => api<CourseDetail>(`/api/v1/courses/${id}`),
  });
}

export function useTeachers() {
  return useQuery({
    queryKey: ["teachers-for-course"],
    queryFn: async () => {
      const res = await api<{ items: TeacherLite[] }>("/api/v1/users?role=TEACHER&page=1");
      return res.items;
    },
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCourseBody) =>
      api<CreatedCourse>("/api/v1/courses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<CreateCourseBody> }) =>
      api<CourseDetail>(`/api/v1/courses/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["courses", v.id] });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });
}
