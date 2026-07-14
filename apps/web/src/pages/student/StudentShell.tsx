import { Outlet } from "react-router-dom";
import { CalendarCheck, Home, ListChecks, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";
import { useMyTasks } from "./api";

export function StudentShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  const tasks = useMyTasks();
  const openTasks = tasks.data?.auto.length ?? 0;

  return (
    <RoleShell
      brand="MedUni AI"
      items={[
        { href: "/app", label: t("dashboard"), icon: <Icon icon={Home} />, end: true },
        { href: "/app/tasks", label: t("tasks"), icon: <Icon icon={ListChecks} />, badge: openTasks },
        { href: "/app/attendance", label: t("attendance"), icon: <Icon icon={CalendarCheck} /> },
        { href: "/app/profile", label: t("profile"), icon: <Icon icon={User} /> },
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
