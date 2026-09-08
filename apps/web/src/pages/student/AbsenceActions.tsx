import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, FileText, Send } from "lucide-react";
import { Button, Card, Icon, Num, Select, Spinner, cls, useToast } from "@meduni/ui";
import { apiErrorMessage } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import {
  useCreateExcuse, useMyExcuses, useMyMakeups, useSubmitMakeup,
  type AbsenceReason, type ExcuseRequest, type Makeup,
} from "./api";

/**
 * PROPUSK BILAN NIMA QILISH MUMKIN (Davomat 2.0 · F3).
 *
 * ⚠️ Ilgari talaba propuskni FAQAT KO'RARDI — "Qoldirilgan darslar" ro'yxati
 * boshi berk ko'cha edi. Endi ikkita chiqish yo'li: otrabotka (qarzni yopish)
 * va spravka arizasi (propuskni sababli qilish). Ikkalasi ham 25 % koridoriga
 * ta'sir qiladi, shuning uchun ular DAVOMAT sahifasida, raqam yonida turadi.
 */

const MK_TONE: Record<Makeup["status"], string> = {
  REQUIRED: "bg-amber-soft text-amber",
  SUBMITTED: "bg-blue-soft text-blue",
  ACCEPTED: "bg-emerald-soft text-emerald",
  REJECTED: "bg-rose-soft text-rose",
  WAIVED: "bg-bg text-ink-soft",
};
const EX_TONE: Record<ExcuseRequest["status"], string> = {
  PENDING: "bg-blue-soft text-blue",
  APPROVED: "bg-emerald-soft text-emerald",
  REJECTED: "bg-rose-soft text-rose",
};

function MakeupRow({ m, first }: { m: Makeup; first: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const locale = useLocale();
  const navigate = useNavigate();
  const { show } = useToast();
  const submit = useSubmitMakeup();
  const open = m.status === "REQUIRED" || m.status === "REJECTED";

  return (
    <div className={cls("flex flex-wrap items-center gap-2 px-5 py-3", !first && "border-t border-line-soft")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-note text-ink">{m.topicTitle ?? m.courseName}</p>
        <p className="truncate text-micro text-ink-faint">
          {m.topicTitle ? `${m.courseName} · ` : ""}
          <Num>{formatDate(locale, m.date, "short")}</Num>
          {" · "}
          <Num>{m.hours}</Num> {t("hoursShort")}
          {" · "}
          {m.kind === "DIGITAL" ? t("mkDigestHint") : t("mkInPersonHint")}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cls("rounded-pill px-2 py-0.5 text-micro font-semibold", MK_TONE[m.status])}>{t(`mk${m.status}`)}</span>
        <span className={cls("text-micro", m.overdue ? "text-rose" : "text-ink-faint")}>
          {m.overdue ? t("mkOverdue") : t("mkDue", { d: formatDate(locale, m.dueAt, "short") })}
        </span>
      </div>
      {open && (
        <div className="flex shrink-0 gap-1.5">
          {m.kind === "DIGITAL" && m.topicId && (
            <Button size="sm" variant="soft" onClick={() => navigate(`/app/topics/${m.topicId}`)}>
              {t("mkOpenTopic")}
            </Button>
          )}
          <Button
            size="sm"
            disabled={submit.isPending}
            onClick={() => submit.mutate(m.id, { onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn") })}
          >
            {t("mkSubmit")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Otrabotka qarzlari — muddati o'tganlari tepada. */
export function MakeupList() {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const q = useMyMakeups();
  const rows = (q.data ?? []).filter((m) => m.status !== "ACCEPTED" && m.status !== "WAIVED");
  if (q.isLoading) return null;
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueAt.localeCompare(b.dueAt));
  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
        <Icon icon={ClipboardCheck} size={15} className="text-ink-faint" />
        <p className="text-note font-bold text-ink-soft">{t("debtsTitle")}</p>
        <span className="ml-auto text-micro text-ink-faint">
          <Num>{sorted.length}</Num>
        </span>
      </div>
      {sorted.map((m, i) => (
        <MakeupRow key={m.id} m={m} first={i === 0} />
      ))}
    </Card>
  );
}

const REASONS: AbsenceReason[] = ["ILLNESS", "FAMILY", "OFFICIAL", "COMPETITION", "OTHER"];

/** Spravka arizalari + yangi ariza formasi. */
export function ExcuseList() {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const locale = useLocale();
  const { show } = useToast();
  const q = useMyExcuses();
  const create = useCreateExcuse();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<{ fromDate: string; toDate: string; reason: AbsenceReason; note: string }>({
    fromDate: today,
    toDate: today,
    reason: "ILLNESS",
    note: "",
  });

  const rows = q.data ?? [];

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
        <Icon icon={FileText} size={15} className="text-ink-faint" />
        <p className="text-note font-bold text-ink-soft">{t("excusesTitle")}</p>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="ml-auto rounded-control text-micro font-semibold text-brand-tint transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {t("excuseNew")}
          </button>
        )}
      </div>

      {open && (
        <div className="grid gap-2 border-b border-line-soft px-5 py-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-micro text-ink-faint">{t("excuseFrom")}</span>
            <input
              type="date"
              value={form.fromDate}
              onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-note outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-micro text-ink-faint">{t("excuseTo")}</span>
            <input
              type="date"
              value={form.toDate}
              onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-note outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-micro text-ink-faint">{t("excuseReason")}</span>
            <Select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value as AbsenceReason }))}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reason${r}`)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-micro text-ink-faint">{t("excuseNote")}</span>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-note outline-none focus:border-brand"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              size="sm"
              disabled={create.isPending}
              onClick={() =>
                create.mutate(form, {
                  onSuccess: (r) => {
                    show(t("excuseSent", { n: r.matched }));
                    setOpen(false);
                  },
                  onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn"),
                })
              }
            >
              <Icon icon={Send} size={14} /> {t("excuseSend")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t("excuseCancel")}
            </Button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner size={20} />
        </div>
      ) : rows.length === 0 ? (
        !open && <p className="px-5 py-4 text-micro text-ink-faint">{t("debtsEmpty")}</p>
      ) : (
        rows.map((r, i) => (
          <div key={r.id} className={cls("flex flex-wrap items-center gap-2 px-5 py-3", i > 0 && "border-t border-line-soft")}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-note text-ink">
                <Num>{formatDate(locale, r.fromDate, "short")}</Num>
                {r.fromDate !== r.toDate && (
                  <>
                    {" — "}
                    <Num>{formatDate(locale, r.toDate, "short")}</Num>
                  </>
                )}
                {" · "}
                {t(`reason${r.reason}`)}
              </p>
              <p className="truncate text-micro text-ink-faint">
                {t("excuseCovers", { n: r.affected })}
                {r.reviewComment ? ` · ${r.reviewComment}` : r.note ? ` · ${r.note}` : ""}
                {r.reviewedByName ? ` · ${r.reviewedByName}` : ""}
              </p>
            </div>
            <span className={cls("shrink-0 rounded-pill px-2 py-0.5 text-micro font-semibold", EX_TONE[r.status])}>
              {r.status === "APPROVED" && <Icon icon={CheckCircle2} size={11} className="mr-1 inline align-[-1px]" />}
              {t(`st${r.status}`)}
            </span>
          </div>
        ))
      )}
    </Card>
  );
}
