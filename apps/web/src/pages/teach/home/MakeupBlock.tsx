import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, ClipboardCheck, X } from "lucide-react";
import { Button, Icon, useToast } from "@meduni/ui";
import { BentoCard, BentoRow } from "../../../components/bento";
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
    <BentoCard title={t("queueTitle")} count={rows.length} bodyClassName="px-2 pb-3">
      <ul className="space-y-0.5">
        {rows.map((m) => (
          <li key={m.id}>
            <BentoRow
              icon={ClipboardCheck}
              iconTone="bg-amber-soft text-amber"
              title={m.studentName}
              sub={
                <>
                  {m.topicTitle ?? m.courseName} · {formatDate(locale, m.date, "short")} · {m.hours} {t("hours")} · {t(`kind${m.kind}`)}
                </>
              }
              onClick={() => navigate(`/teach/students/${m.studentId}`)}
              arrow={false}
              trailing={
                <span className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={review.isPending}
                    aria-label={t("reject")}
                    onClick={() => review.mutate({ id: m.id, accept: false }, { onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn") })}
                  >
                    <Icon icon={X} size={14} /> <span className="hidden sm:inline">{t("reject")}</span>
                  </Button>
                  <Button
                    size="sm"
                    disabled={review.isPending}
                    aria-label={t("accept")}
                    onClick={() => review.mutate({ id: m.id, accept: true }, { onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn") })}
                  >
                    <Icon icon={Check} size={14} /> <span className="hidden sm:inline">{t("accept")}</span>
                  </Button>
                </span>
              }
            />
          </li>
        ))}
      </ul>
    </BentoCard>
  );
}
