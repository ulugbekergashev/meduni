"use client";

import { useTranslations } from "next-intl";
import { IconBook, IconCalendar, IconFile, IconHome, IconLayers, IconSparkles, IconTrophy, IconUsers } from "@/components/Icons";
import Shell from "@/components/Shell";
import { useRequireRole } from "@/lib/useAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me } = useRequireRole("admin");
  const t = useTranslations("nav");

  if (!me) return null;
  return (
    <Shell
      me={me}
      variant="sidebar"
      nav={[
        { href: "/admin", label: t("dashboard"), icon: <IconHome />, exact: true },
        { href: "/admin/structure", label: t("structure"), icon: <IconLayers /> },
        { href: "/admin/users", label: t("users"), icon: <IconUsers /> },
        { href: "/admin/courses", label: t("courses"), icon: <IconBook /> },
        { href: "/admin/glossary", label: t("glossary"), icon: <IconFile /> },
        { href: "/admin/templates", label: t("templates"), icon: <IconSparkles /> },
        { href: "/admin/xp", label: t("xp"), icon: <IconTrophy /> },
        { href: "/admin/audit", label: t("auditNav"), icon: <IconCalendar /> },
      ]}
    >
      {children}
    </Shell>
  );
}
