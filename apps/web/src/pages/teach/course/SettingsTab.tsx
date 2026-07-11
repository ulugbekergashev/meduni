import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { EmptyState, Icon } from "@meduni/ui";

// Placeholder — replaced by course settings / unlock rules (Module 10).
export function SettingsTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach.placeholder" });
  return <EmptyState icon={<Icon icon={Settings} size={22} />} text={t("settings")} />;
}
