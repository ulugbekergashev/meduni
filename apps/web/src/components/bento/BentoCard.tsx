import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Icon, Spinner, cls } from "@meduni/ui";
import { RetryLine } from "./RetryLine";

/** Pastel yoki oq yuzalar — `MetricTile` bilan bir xil to'plam. */
export type BentoTone = "plain" | "brand" | "violet" | "amber" | "emerald" | "blue" | "rose";

const SHELL: Record<BentoTone, string> = {
  plain: "border border-line bg-surface",
  brand: "bg-brand-soft",
  violet: "bg-violet-soft",
  amber: "bg-amber-soft",
  emerald: "bg-emerald-soft",
  blue: "bg-blue-soft",
  rose: "bg-rose-soft",
};

export interface BentoCardProps {
  title?: ReactNode;
  /** Sarlavha yonidagi qora son belgisi (masalan vazifalar soni). */
  count?: number;
  /** Sarlavha yonidagi kulrang chip yoki izoh (sana, "joriy semestr"). */
  meta?: ReactNode;
  /** O'ng chetdagi havola ("Barchasi →"). */
  action?: { label: string; onClick: () => void };
  /** O'ng chetga ixtiyoriy boshqaruv (Segmented, tugma). `action` o'rniga. */
  right?: ReactNode;
  tone?: BentoTone;
  /** Holatlar — berilsa tanasi o'rniga spinner/xato chiziladi. */
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  className?: string;
  /** Tana padding'i — ro'yxatlar uchun `px-2 pb-3`, oddiy kontent `px-4 pb-4`. */
  bodyClassName?: string;
  children?: ReactNode;
}

/**
 * Bento kartochkasi — Dizayn v3 sahifalarining yagona bloki: sarlavha
 * (16px) + son/meta + o'ngda amal, ostida tana. Soyasiz, radius 16.
 */
export function BentoCard({
  title,
  count,
  meta,
  action,
  right,
  tone = "plain",
  isLoading = false,
  isError = false,
  onRetry,
  className,
  bodyClassName = "px-4 pb-4",
  children,
}: BentoCardProps) {
  const hasHeader = title !== undefined || action || right;
  return (
    <section className={cls("flex min-w-0 flex-col rounded-card", SHELL[tone], className)}>
      {hasHeader && (
        <header className="flex min-w-0 items-center gap-2 px-4 pb-2 pt-4">
          {title !== undefined && <h3 className="truncate text-section font-semibold text-ink">{title}</h3>}
          {count !== undefined && count > 0 && (
            <span className="shrink-0 rounded-pill bg-ink px-2 py-0.5 font-data text-micro font-semibold tabular-nums text-surface">
              {count}
            </span>
          )}
          {meta !== undefined && (
            <span className="shrink-0 rounded-pill bg-surface-raised px-2 py-0.5 text-micro font-semibold text-ink-soft">
              {meta}
            </span>
          )}
          <span className="ml-auto shrink-0">
            {right ??
              (action && (
                <button
                  type="button"
                  onClick={action.onClick}
                  className="inline-flex items-center gap-1 text-note font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {action.label}
                  <Icon icon={ArrowRight} size={14} />
                </button>
              ))}
          </span>
        </header>
      )}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <Spinner size={18} />
        </div>
      ) : isError ? (
        <RetryLine onRetry={onRetry ?? (() => undefined)} />
      ) : (
        <div className={cls("flex min-h-0 flex-1 flex-col", !hasHeader && "pt-4", bodyClassName)}>{children}</div>
      )}
    </section>
  );
}
