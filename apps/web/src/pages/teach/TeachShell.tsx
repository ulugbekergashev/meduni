import { Outlet } from "react-router-dom";
import { BookMarked, BookOpen, Home, ListChecks, Settings, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";
import { useTeachTasks } from "./api";

export function TeachShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  const tasks = useTeachTasks();
  const openTasks = tasks.data?.auto.length ?? 0;

  return (
    <RoleShell
      brand="MedUni AI · Oʻqituvchi"
      items={[
        { href: "/teach", label: t("dashboard"), icon: <Icon icon={Home} />, end: true },
        { href: "/teach/tasks", label: t("myTasks"), icon: <Icon icon={ListChecks} />, badge: openTasks },
        { href: "/teach/courses", label: t("courses"), icon: <Icon icon={BookOpen} /> },
        { href: "/teach/groups", label: t("groups"), icon: <Icon icon={Users2} /> },
        { href: "/teach/glossary", label: t("glossary"), icon: <Icon icon={BookMarked} /> },
        { href: "/teach/settings", label: t("settings"), icon: <Icon icon={Settings} /> },
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
