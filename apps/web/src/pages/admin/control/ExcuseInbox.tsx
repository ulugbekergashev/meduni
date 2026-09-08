import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, FileText, X } from "lucide-react";
import { Button, Card, Icon, Num, Segmented, cls, useToast } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { formatDate } from "../../../lib/date";
import { useAdminExcuses, useReviewExcuse } from "../api";

/**
 * SPRAVKA ARIZALARI — dekanat navbati (Davomat 2.0 · F3).
 *
 * ⚠️ NEGA DEKANATDA: "Sababli" — davomatdagi eng siyosiy status; agar uni
 * o'qituvchi o'z darsida o'zi qo'ysa, koridor (25 %) ma'nosini yo'qotadi.
 * Siyosatda `excuseApprover` sukut bo'yicha DEANERY. Tasdiqlash oraliqdagi
 * BARCHA sababsiz propusklarni sababliga aylantiradi va o'zgarish jurnaliga
 * yozadi — ya'ni amal izsiz emas.
 */
const TONE: Record<string, string> = {
  PENDING: "bg-blue-soft text-blue",
  APPROVED: "bg-emerald-soft text-emerald",
  REJECTED: "bg-rose-soft text-rose",
};

export function ExcuseInbox() {
  const { t } = useTranslation(undefined, { keyPrefix: "excuses" });
  const locale = useLocale();
  const { show } = useToast();
  const [status, setStatus] = useState("PENDING");
  const q = useAdminExcuses(status);
  const review = useReviewExcuse();
  const rows = q.data ?? [];

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Icon icon={FileText} size={15} className="text-ink-faint" />
        <p className="text-note font-bold text-ink">{t("title")}</p>
        <div className="ml-auto">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { key: "PENDING", label: t("tabPending") },
              { key: "APPROVED", label: t("tabApproved") },
              { key: "all", label: t("tabAll") },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-note text-ink-soft">{t("empty")}</p>
      ) : (
        rows.map((r, i) => (
          <div key={r.id} className={cls("flex flex-wrap items-center gap-2 px-4 py-3", i > 0 && "border-t border-line-soft")}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-note text-ink">
                {r.studentName}
                {r.groupName ? <span className="text-ink-faint"> · {r.groupName}</span> : null}
              </p>
              <p className="truncate text-micro text-ink-faint">
                <Num>{formatDate(locale, r.fromDate, "short")}</Num>
                {r.fromDate !== r.toDate && (
                  <>
                    {" — "}
                    <Num>{formatDate(locale, r.toDate, "short")}</Num>
                  </>
                )}
                {" · "}
                {t(`reason${r.reason}`)}
                {" · "}
                {t("covers", { n: r.affected })}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            </div>
            {r.status === "PENDING" ? (
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: r.id, approve: false }, { onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn") })}
                >
                  <Icon icon={X} size={14} /> {t("reject")}
                </Button>
                <Button
                  size="sm"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate(
                      { id: r.id, approve: true },
                      {
                        onSuccess: (d) => show(t("approved", { n: d.applied })),
                        onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn"),
                      }
                    )
                  }
                >
                  <Icon icon={Check} size={14} /> {t("approve")}
                </Button>
              </div>
            ) : (
              <span className={cls("shrink-0 rounded-pill px-2 py-0.5 text-micro font-semibold", TONE[r.status])}>{t(`st${r.status}`)}</span>
            )}
          </div>
        ))
      )}
    </Card>
  );
}
