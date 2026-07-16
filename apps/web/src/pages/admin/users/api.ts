import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export type UserRole = "superadmin" | "faculty_admin" | "dept_admin" | "teacher" | "student";

export interface UserRow {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  locale: "uz" | "ru";
  isActive: boolean;
  groupId: number | null;
  groupName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  facultyId: number | null;
  facultyName: string | null;
  position: string | null;
}

export interface UsersPageResp {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateUserBody {
  fullName: string;
  email: string;
  role: "STUDENT" | "TEACHER" | "DEPT_ADMIN" | "FACULTY_ADMIN";
  phone?: string | null;
  locale: "uz" | "ru";
  password?: string | null;
  groupId?: number | null;
  departmentId?: number | null;
  facultyId?: number | null;
  position?: string | null;
}

export interface CreatedUser extends UserRow {
  generatedPassword: string | null;
}

export interface UserStats {
  total: number;
  students: number;
  teachers: number;
  deptAdmins: number;
  facultyAdmins: number;
  superAdmins: number;
  inactive: number;
}

export function useUsers(params: {
  role: string;
  search: string;
  page: number;
  facultyId?: string;
  departmentId?: string;
  groupId?: string;
  active?: string;
}) {
  const qs = new URLSearchParams();
  if (params.role) qs.set("role", params.role);
  if (params.search) qs.set("search", params.search);
  if (params.facultyId) qs.set("facultyId", params.facultyId);
  if (params.departmentId) qs.set("departmentId", params.departmentId);
  if (params.groupId) qs.set("groupId", params.groupId);
  if (params.active) qs.set("active", params.active);
  qs.set("page", String(params.page));
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => api<UsersPageResp>(`/api/v1/users?${qs.toString()}`),
    placeholderData: (prev) => prev,
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: ["users", "stats"],
    queryFn: () => api<UserStats>("/api/v1/users/stats"),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserBody) =>
      api<CreatedUser>("/api/v1/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<CreateUserBody> }) =>
      api<UserRow>(`/api/v1/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useToggleActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<UserRow>(`/api/v1/users/${id}/toggle-active`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (id: number) =>
      api<{ password: string }>(`/api/v1/users/${id}/reset-password`, { method: "POST" }),
  });
}

