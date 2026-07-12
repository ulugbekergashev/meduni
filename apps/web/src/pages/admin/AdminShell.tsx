import { Outlet } from "react-router-dom";
import { BookMarked, BookOpen, Home, Network, Palette, ScrollText, Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";

export function AdminShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });

  return (
    <RoleShell
      brand="MedUni AI · Admin"
      items={[
        { href: "/admin", label: t("dashboard"), icon: <Icon icon={Home} />, end: true },
        { href: "/admin/structure", label: t("structure"), icon: <Icon icon={Network} /> },
        { href: "/admin/users", label: t("users"), icon: <Icon icon={Users} /> },
        { href: "/admin/courses", label: t("courses"), icon: <Icon icon={BookOpen} /> },
        { href: "/admin/glossary", label: t("glossary"), icon: <Icon icon={BookMarked} /> },
        { href: "/admin/templates", label: t("templates"), icon: <Icon icon={Palette} /> },
        { href: "/admin/ai", label: t("ai"), icon: <Icon icon={Sparkles} /> },
        { href: "/admin/audit", label: t("audit"), icon: <Icon icon={ScrollText} /> },
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
