import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type Role = "admin" | "teacher" | "student";

export interface Me {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  locale: "uz" | "ru";
}

export const roleHome: Record<Role, string> = {
  admin: "/admin",
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
