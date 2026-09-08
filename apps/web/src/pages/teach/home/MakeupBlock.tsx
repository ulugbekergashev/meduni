import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, ClipboardCheck, X } from "lucide-react";
import { Button, Card, Icon, Num, cls, useToast } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { formatDate } from "../../../lib/date";
import { useReviewMakeup, useTeacherMakeups } from "../api";

/**
 * OTRABOTKA NAVBATI (Davomat 2.0 · F3).
 *
 * Talaba qoldirgan amaliy darsni yopdi — o'qituvchi qabul qiladi yoki rad etadi.
 * ⚠️ Qabul qilingan otrabotka talabaning SABABSIZ soatini kamaytiradi (25 %
 * koridori), shuning uchun bu bir bosishlik amal emas: qaysi dars, qaysi mavzu
 * va qanday isbot (DIGITAL bo'lsa — test natijasi) ko'rinib turadi.
 *
 * Navbat bo'sh bo'lsa blok umuman chizilmaydi (ekranda o'lik karta qolmaydi).
 */
export function MakeupBlock() {
  const { t } = useTranslation(undefined, { keyPrefix: "makeup" });
  const locale = useLocale();
  const navigate = useNavigate();
  const { show } = useToast();
  const q = useTeacherMakeups();
  const review = useReviewMakeup();
  const rows = q.data ?? [];
  if (q.isLoading || rows.length === 0) return null;

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon icon={ClipboardCheck} size={15} className="text-ink-faint" />
        <p className="text-note font-bold text-ink">{t("queueTitle")}</p>
        <span className="ml-auto rounded-pill bg-amber-soft px-2 py-0.5 text-micro font-semibold text-amber">
          <Num>{rows.length}</Num>
        </span>
      </div>
      {rows.map((m, i) => (
        <div key={m.id} className={cls("flex flex-wrap items-center gap-2 px-4 py-3", i > 0 && "border-t border-line-soft")}>
          <button
            onClick={() => navigate(`/teach/students/${m.studentId}`)}
            className="min-w-0 flex-1 rounded-control text-left transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <p className="truncate text-note text-ink">{m.studentName}</p>
            <p className="truncate text-micro text-ink-faint">
              {m.topicTitle ?? m.courseName} · <Num>{formatDate(locale, m.date, "short")}</Num> · <Num>{m.hours}</Num> {t("hours")} ·{" "}
              {t(`kind${m.kind}`)}
            </p>
          </button>
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: m.id, accept: false }, { onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn") })}
            >
              <Icon icon={X} size={14} /> {t("reject")}
            </Button>
            <Button
              size="sm"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: m.id, accept: true }, { onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn") })}
            >
              <Icon icon={Check} size={14} /> {t("accept")}
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
