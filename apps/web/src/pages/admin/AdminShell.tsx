import { Outlet } from "react-router-dom";
import { Home, Network } from "lucide-react";
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
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
