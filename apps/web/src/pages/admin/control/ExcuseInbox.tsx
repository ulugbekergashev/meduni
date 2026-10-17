import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, FileText, X } from "lucide-react";
import { Button, EmptyState, Icon, Num, Spinner, cls, useToast } from "@meduni/ui";
import { BentoCard, BentoRow, RetryLine } from "../../../components/bento";
import { PillTabs } from "../components";
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

export function ExcuseInbox({ className }: { className?: string }) {
  const { t } = useTranslation(undefined, { keyPrefix: "excuses" });
  const locale = useLocale();
  const { show } = useToast();
  const [status, setStatus] = useState("PENDING");
  const q = useAdminExcuses(status);
  const review = useReviewExcuse();
  const rows = q.data ?? [];
  const tabs = (
    <PillTabs
      value={status}
      onChange={setStatus}
      options={[
        { key: "PENDING", label: t("tabPending") },
        { key: "APPROVED", label: t("tabApproved") },
        { key: "all", label: t("tabAll") },
      ]}
    />
  );
  const fail = (e: unknown) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn");

  return (
    <BentoCard
      className={className}
      title={t("title")}
      count={status === "PENDING" ? rows.length : undefined}
      right={<div className="hidden sm:block">{tabs}</div>}
      bodyClassName="px-2 pb-3"
    >
      {/* Telefonda tablar sarlavhani siqib qo‘ymasin — tanada alohida qator. */}
      <div className="px-2 pb-2 sm:hidden">{tabs}</div>
      {q.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner size={18} />
        </div>
      ) : q.isError ? (
        <RetryLine onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-2 py-4">
          <EmptyState icon={<Icon icon={FileText} size={20} />} text={t("empty")} />
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.id}>
              <BentoRow
                className="flex-wrap"
                icon={FileText}
                iconTone="bg-blue-soft text-blue"
                title={
                  <>
                    {r.studentName}
                    {r.groupName ? <span className="font-normal text-ink-soft"> · {r.groupName}</span> : null}
                  </>
                }
                sub={
                  <>
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
                  </>
                }
                trailing={
                  r.status === "PENDING" ? (
                    <div className="flex shrink-0 gap-1.5 pr-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: r.id, approve: false }, { onError: fail })}
                      >
                        <Icon icon={X} size={14} /> {t("reject")}
                      </Button>
                      <Button
                        size="sm"
                        disabled={review.isPending}
                        onClick={() =>
                          review.mutate(
                            { id: r.id, approve: true },
                            { onSuccess: (d) => show(t("approved", { n: d.applied })), onError: fail }
                          )
                        }
                      >
                        <Icon icon={Check} size={14} /> {t("approve")}
                      </Button>
                    </div>
                  ) : (
                    <span className={cls("mr-2 shrink-0 rounded-pill px-2 py-0.5 text-micro font-semibold", TONE[r.status])}>
                      {t(`st${r.status}`)}
                    </span>
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}
