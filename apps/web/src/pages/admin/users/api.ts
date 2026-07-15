import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export type UserRole = "admin" | "superadmin" | "faculty_admin" | "dept_admin" | "teacher" | "student";

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
  departmentNameUz: string | null;
  departmentNameRu: string | null;
  facultyId: number | null;
  facultyNameUz: string | null;
  facultyNameRu: string | null;
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

export interface ImportResult {
  added: number;
  errors: { row: number; messageUz: string; messageRu: string }[];
}

export function useUsers(params: { role: string; search: string; page: number }) {
  const qs = new URLSearchParams();
  if (params.role) qs.set("role", params.role);
  if (params.search) qs.set("search", params.search);
  qs.set("page", String(params.page));
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => api<UsersPageResp>(`/api/v1/users?${qs.toString()}`),
    placeholderData: (prev) => prev,
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

export function useImportUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/api/v1/users/import`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) throw new Error("import_failed");
      return (await res.json()) as ImportResult;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
