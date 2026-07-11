import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { EmptyState, Icon } from "@meduni/ui";

// Placeholder — replaced by the Progress module (Module 13).
export function ProgressTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach.placeholder" });
  return <EmptyState icon={<Icon icon={BarChart3} size={22} />} text={t("progress")} />;
}
