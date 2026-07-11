import { useTranslation } from "react-i18next";
import { CalendarCheck } from "lucide-react";
import { EmptyState, Icon } from "@meduni/ui";

// Placeholder — replaced by the Attendance module (Module 15).
export function SessionsTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach.placeholder" });
  return <EmptyState icon={<Icon icon={CalendarCheck} size={22} />} text={t("sessions")} />;
}
