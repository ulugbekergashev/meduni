import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Hammer } from "lucide-react";
import { Card, Icon } from "@meduni/ui";

// The clinical-case review queue is built in Module 14. Placeholder keeps the
// dashboard's "cases to review" task from linking nowhere.
export function ReviewPlaceholder() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate("/teach")} className="mb-3 flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} />
        {t("back")}
      </button>
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-soft text-amber">
          <Icon icon={Hammer} size={24} />
        </div>
        <p className="text-section font-bold text-ink">{t("reviewSoonTitle")}</p>
        <p className="max-w-sm text-[13px] text-ink-soft">{t("reviewSoonBody")}</p>
      </Card>
    </div>
  );
}
