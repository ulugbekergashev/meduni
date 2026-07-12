import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Hammer } from "lucide-react";
import { Card, Icon } from "@meduni/ui";

// The full lesson page (video / slides / quiz / case tabs) is built in Module 12.
// This placeholder is the honest landing target for "Davom ettirish" until then.
export function LessonPlaceholder() {
  const { id } = useParams();
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} />
        {t("back")}
      </button>
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          <Icon icon={Hammer} size={24} />
        </div>
        <p className="text-section font-bold text-ink">{t("lessonSoonTitle")}</p>
        <p className="max-w-sm text-[13px] text-ink-soft">{t("lessonSoonBody")}</p>
        <p className="text-[12px] text-ink-faint">topic #{id}</p>
      </Card>
    </div>
  );
}
