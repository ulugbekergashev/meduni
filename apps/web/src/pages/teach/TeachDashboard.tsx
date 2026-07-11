import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { EmptyState, Icon } from "@meduni/ui";
import { useMe } from "../../lib/auth";

export function TeachDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "dashboard" });
  const { data: me } = useMe();

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("teachTitle")}</h1>
      <p className="mt-1 text-[13.5px] text-ink-soft">
        {t("welcome")}, {me?.full_name}
      </p>

      <div className="mt-8">
        <EmptyState icon={<Icon icon={BookOpen} size={22} />} text={t("empty")} />
      </div>
    </div>
  );
}
