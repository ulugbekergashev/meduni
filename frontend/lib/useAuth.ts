"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api, getAccessToken } from "./api";

export type Me = {
  id: number;
  role: "admin" | "teacher" | "student";
  full_name: string;
  email: string;
  locale: string;
};

export const homeFor = (role: Me["role"]) =>
  role === "admin" ? "/admin/structure" : role === "teacher" ? "/teach" : "/app";

export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => api<Me>("/auth/me"),
    enabled: !!getAccessToken(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Клиентский guard страницы: редиректит на /login или на «свой» кабинет. */
export function useRequireRole(role: Me["role"]) {
  const router = useRouter();
  const { data: me, isLoading } = useMe();

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    if (!isLoading && me && me.role !== role) {
      router.replace(homeFor(me.role));
    }
  }, [me, isLoading, role, router]);

  return { me: me?.role === role ? me : undefined, isLoading };
}
