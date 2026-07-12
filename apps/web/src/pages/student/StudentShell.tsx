import { Outlet } from "react-router-dom";
import { CalendarCheck, Home, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";

export function StudentShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });

  return (
    <RoleShell
      brand="MedUni AI"
      items={[
        { href: "/app", label: t("dashboard"), icon: <Icon icon={Home} />, end: true },
        { href: "/app/attendance", label: t("attendance"), icon: <Icon icon={CalendarCheck} /> },
        { href: "/app/profile", label: t("profile"), icon: <Icon icon={User} /> },
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
