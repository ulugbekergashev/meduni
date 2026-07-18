import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export interface StudentRow {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  locale: "uz" | "ru";
  isActive: boolean;
  groupId: number | null;
  groupName: string | null;
  facultyId: number | null;
  facultyName: string | null;
  coursesCount: number;
  progressPct: number | null;
  attendancePct: number | null;
}

export interface StudentsResp {
  items: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StudentStats {
  total: number;
  active: number;
  inactive: number;
  groupsCount: number;
  byFaculty: { name: string; count: number }[];
}

export function useStudents(params: {
  facultyId: string;
  groupId: string;
  active: string;
  search: string;
  page: number;
}) {
  const qs = new URLSearchParams();
  if (params.facultyId) qs.set("facultyId", params.facultyId);
  if (params.groupId) qs.set("groupId", params.groupId);
  if (params.active) qs.set("active", params.active);
  if (params.search) qs.set("search", params.search);
  qs.set("page", String(params.page));
  return useQuery({
    queryKey: ["admin-students", params],
    queryFn: () => api<StudentsResp>(`/api/v1/admin/students?${qs}`),
    placeholderData: (prev) => prev,
  });
}

export function useStudentStats() {
  return useQuery({
    queryKey: ["admin-students", "stats"],
    queryFn: () => api<StudentStats>("/api/v1/admin/students/stats"),
  });
}

export interface StudentBody {
  fullName: string;
  email: string;
  phone?: string | null;
  locale: "uz" | "ru";
  groupId: number;
  password?: string | null;
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin-students"] });
    qc.invalidateQueries({ queryKey: ["users"] });
  };
}

export function useCreateStudent() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: StudentBody) =>
      api<{ generatedPassword: string | null }>("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({ ...body, role: "STUDENT" }),
      }),
    onSuccess: inv,
  });
}

export function useUpdateStudent() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<StudentBody> }) =>
      api(`/api/v1/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: inv,
  });
}

export function useToggleStudent() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/users/${id}/toggle-active`, { method: "POST" }),
    onSuccess: inv,
  });
}

export function useResetStudentPassword() {
  return useMutation({
    mutationFn: (id: number) => api<{ password: string }>(`/api/v1/users/${id}/reset-password`, { method: "POST" }),
  });
}
