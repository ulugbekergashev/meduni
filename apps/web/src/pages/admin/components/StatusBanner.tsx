import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

export interface BannerItem {
  key: string;
  n?: number;
  text: string;
  tone?: "rose" | "amber" | "ink";
}

const SHELL = { emerald: "bg-emerald-soft", amber: "bg-amber-soft", rose: "bg-rose-soft" };
const ICON = {
  emerald: { icon: CheckCircle2, cls: "bg-surface/70 text-emerald" },
  amber: { icon: AlertTriangle, cls: "bg-surface/70 text-amber" },
  rose: { icon: OctagonAlert, cls: "bg-surface/70 text-rose" },
};
const NUM = { rose: "text-rose", amber: "text-amber", ink: "text-ink" };

/**
 * Nazorat sahifalarining xulosa yuzasi — "chetlashish bormi?" savoliga bitta
 * pastel javob. Nol bo'lsa tinch yashil, aks holda amber/rose + ismsiz sanoq.
 * ⛔ STAT DIETASI: kartalar galereyasi EMAS — bitta yuza, raqamlar matnda.
 */
export function StatusBanner({
  tone,
  headline,
  items = [],
  hint,
  aside,
}: {
  tone: "emerald" | "amber" | "rose";
  headline: ReactNode;
  items?: BannerItem[];
  hint?: ReactNode;
  aside?: ReactNode;
}) {
  const ic = ICON[tone];
  return (
    <section className={cls("flex flex-col gap-3 rounded-card p-4 sm:flex-row sm:items-start sm:p-5", SHELL[tone])}>
      <span className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", ic.cls)}>
        <Icon icon={ic.icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-section font-semibold text-ink">{headline}</p>
        {items.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-note text-ink-2">
            {items.map((x) => (
              <span key={x.key}>
                {x.n !== undefined && (
                  <>
                    <b className={cls("font-data tabular-nums", NUM[x.tone ?? "ink"])}>{x.n}</b>{" "}
                  </>
                )}
                {x.text}
              </span>
            ))}
          </p>
        )}
        {hint && <p className="mt-2 max-w-prose text-micro leading-relaxed text-ink-soft">{hint}</p>}
      </div>
      {aside && <div className="shrink-0 text-micro text-ink-2 sm:text-right">{aside}</div>}
    </section>
  );
}
