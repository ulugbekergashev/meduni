import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { Button, Icon, Spinner, cls } from "@meduni/ui";
import type { ControlReport } from "../api";

export interface HeroIssue {
  key: string;
  n: number;
  label: string;
  /** Raqam rangi — qo'lda ochish va o'chirilgan ketma-ketlik rose, qolgani amber. */
  tone: "rose" | "amber";
}

/** Nazorat hisobotidagi chetlashishlar — faqat noldan kattalari. */
export function controlIssues(totals: ControlReport["totals"] | undefined, t: (k: string) => string): HeroIssue[] {
  if (!totals) return [];
  return [
    { key: "manual", n: totals.manualUnlocksLast30d, label: t("s.manual"), tone: "rose" as const },
    { key: "bare", n: totals.topicsWithoutAssessment, label: t("s.bare"), tone: "amber" as const },
    { key: "below", n: totals.coursesBelowPolicy, label: t("s.below"), tone: "amber" as const },
    { key: "seqOff", n: totals.coursesSequentialOff, label: t("s.seqOff"), tone: "rose" as const },
  ].filter((x) => x.n > 0);
}

/**
 * Admin bosh sahifasining yagona yoritilgan yuzasi — "biror narsa noto'g'rimi?".
 * Nol bo'lsa tinch yashil "Hammasi joyida", aks holda amber + chetlashishlar ro'yxati.
 * Kutilayotgan ishlar (keys/kontent/kvota) o'ng kartada — bu yerda faqat soni.
 */
export function AdminHero({
  issues,
  pending,
  controlLoading,
  controlError,
  onRetryControl,
}: {
  issues: HeroIssue[];
  pending: number;
  controlLoading: boolean;
  controlError: boolean;
  onRetryControl: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminHome" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "control" });
  const { t: tCommon } = useTranslation(undefined, { keyPrefix: "common" });
  const navigate = useNavigate();

  const deviations = issues.reduce((a, x) => a + x.n, 0);
  const total = deviations + pending;
  const clean = total === 0 && !controlError && !controlLoading;

  return (
    <section
      className={cls(
        "flex h-full flex-col gap-4 rounded-card p-5 sm:flex-row sm:items-stretch",
        clean ? "bg-emerald-soft" : "bg-amber-soft"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cls(
            "inline-flex max-w-full items-center gap-1.5 self-start truncate rounded-pill bg-surface/70 px-2.5 py-1 text-micro font-semibold",
            clean ? "text-emerald" : "text-amber"
          )}
        >
          <Icon icon={clean ? ShieldCheck : AlertTriangle} size={13} />
          {t("heroEyebrow")}
        </span>
        <h2 className="mt-3 truncate text-h1 font-semibold text-ink">{clean ? t("heroClean") : t("heroIssues")}</h2>

        <div className="mt-1 text-note text-ink-2">
          {controlLoading ? (
            <Spinner size={14} />
          ) : controlError ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-rose">
              {t("controlError")}
              <button
                type="button"
                onClick={onRetryControl}
                className="font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {tCommon("retry")}
              </button>
            </span>
          ) : clean ? (
            t("heroCleanHint")
          ) : (
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {issues.length === 0 && <span>{tc("noDeviations")}</span>}
              {issues.map((x) => (
                <span key={x.key}>
                  <b className={cls("font-data tabular-nums", x.tone === "rose" ? "text-rose" : "text-amber")}>{x.n}</b>{" "}
                  {x.label.toLowerCase()}
                </span>
              ))}
              {pending > 0 && <span className="text-ink-soft">{t("pendingWork", { n: pending })}</span>}
            </span>
          )}
        </div>

        <div className="mt-auto pt-4">
          <Button variant="primary" size="lg" onClick={() => navigate("/admin/control")}>
            {t("openControl")}
            <Icon icon={ArrowRight} size={16} />
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-row items-end justify-between gap-2 border-t border-ink/10 pt-3 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0 sm:text-right">
        <p className={cls("text-display font-semibold tabular-nums", clean ? "text-emerald" : "text-ink")}>
          {controlLoading ? "—" : total}
        </p>
        <p className="text-micro text-ink-2">{t("issuesWord")}</p>
      </div>
    </section>
  );
}
