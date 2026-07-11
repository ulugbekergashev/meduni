import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { EmptyState, Icon } from "@meduni/ui";

// Placeholder — replaced by the Topics module (Module 5). Separate route/component
// so only this tab mounts and fetches its own data; the shell never loads it.
export function TopicsTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach.placeholder" });
  return <EmptyState icon={<Icon icon={FileText} size={22} />} text={t("topics")} />;
}
