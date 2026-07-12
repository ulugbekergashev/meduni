import { Outlet } from "react-router-dom";
import { BookMarked, BookOpen, ClipboardCheck, Home, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";
import { useTeachDashboard } from "./api";

export function TeachShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  const dash = useTeachDashboard();
  const pendingCases = dash.data?.tasks.casesToReview ?? 0;

  return (
    <RoleShell
      brand="MedUni AI · Oʻqituvchi"
      items={[
        { href: "/teach", label: t("dashboard"), icon: <Icon icon={Home} />, end: true },
        { href: "/teach/courses", label: t("courses"), icon: <Icon icon={BookOpen} /> },
        { href: "/teach/groups", label: t("groups"), icon: <Icon icon={Users2} /> },
        { href: "/teach/cases/review", label: t("caseReview"), icon: <Icon icon={ClipboardCheck} />, badge: pendingCases },
        { href: "/teach/glossary", label: t("glossary"), icon: <Icon icon={BookMarked} /> },
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
