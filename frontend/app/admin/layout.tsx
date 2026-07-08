"use client";

import { useTranslations } from "next-intl";
import { IconBook, IconLayers, IconUsers } from "@/components/Icons";
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
        { href: "/admin/structure", label: t("structure"), icon: <IconLayers /> },
        { href: "/admin/users", label: t("users"), icon: <IconUsers /> },
        { href: "/admin/courses", label: t("courses"), icon: <IconBook /> },
      ]}
    >
      {children}
    </Shell>
  );
}
