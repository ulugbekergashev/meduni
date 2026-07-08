"use client";

import { useTranslations } from "next-intl";
import Shell from "@/components/Shell";
import { useRequireRole } from "@/lib/useAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me } = useRequireRole("admin");
  const t = useTranslations("nav");

  if (!me) return null;
  return (
    <Shell
      me={me}
      nav={[
        { href: "/admin/structure", label: t("structure") },
        { href: "/admin/users", label: t("users") },
        { href: "/admin/courses", label: t("courses") },
      ]}
    >
      {children}
    </Shell>
  );
}
