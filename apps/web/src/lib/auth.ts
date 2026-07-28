import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type Role = "superadmin" | "faculty_admin" | "dept_admin" | "teacher" | "student";

export interface Me {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  locale: "uz" | "ru";
}

/** All admin tiers share the /admin area; data is scoped server-side. */
export const ADMIN_ROLES: Role[] = ["superadmin", "faculty_admin", "dept_admin"];
export const isAdminRole = (r: Role) => ADMIN_ROLES.includes(r);

export const roleHome: Record<Role, string> = {
  superadmin: "/admin",
  faculty_admin: "/admin",
  dept_admin: "/admin",
  teacher: "/teach",
  student: "/app",
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/auth/me"),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    // Xato chaqiruv joyida ko'rsatiladi — global toast takrorlamasin.
    meta: { silent: true },
    mutationFn: (body: { email: string; password: string }) =>
      api<Me>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (me) => {
      queryClient.setQueryData(["me"], me);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.setQueryData(["me"], null);
    },
  });
}
