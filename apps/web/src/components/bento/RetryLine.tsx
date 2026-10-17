import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Icon } from "@meduni/ui";

/** Kartochka ichidagi ixcham xato holati — bo'lim yuklanmasa qayta urinish. */
export function RetryLine({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "common" });
  return (
    <div className="flex items-center gap-2 px-4 py-4 text-note text-rose">
      <Icon icon={AlertCircle} size={16} />
      <span className="flex-1">{t("loadError")}</span>
      <button
        type="button"
        onClick={onRetry}
        className="font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {t("retry")}
      </button>
    </div>
  );
}
