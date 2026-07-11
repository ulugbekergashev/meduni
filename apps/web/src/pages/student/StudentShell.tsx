import { Outlet } from "react-router-dom";
import { Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";

export function StudentShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });

  return (
    <RoleShell
      brand="MedUni AI"
      items={[{ href: "/app", label: t("dashboard"), icon: <Icon icon={Home} /> }]}
    >
      <Outlet />
    </RoleShell>
  );
}
