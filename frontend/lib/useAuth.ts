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

/** Клиентский guard страницы: редиректит на /login или на «свой» кабинет.
 *  Принимает одну роль или список допустимых ролей. */
export function useRequireRole(role: Me["role"] | Me["role"][]) {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const roles = Array.isArray(role) ? role : [role];
  const rolesKey = roles.join(",");

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    if (!isLoading && me && !roles.includes(me.role)) {
      router.replace(homeFor(me.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, isLoading, rolesKey, router]);

  return { me: me && roles.includes(me.role) ? me : undefined, isLoading };
}
