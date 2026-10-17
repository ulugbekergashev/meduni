import type { ReactNode } from "react";
import { cls } from "@meduni/ui";

export interface PillTab<T extends string> {
  key: T;
  label: ReactNode;
  count?: number;
}

/**
 * Dizayn v3 segmenti — faol element QORA pill (`bg-ink text-surface`),
 * qolganlari `text-ink-soft`. `Segmented` (packages/ui) bilan bir xil API va a11y
 * (`tablist` / `aria-selected`); admin sahifalarida shu ishlatiladi.
 */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  options: PillTab<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cls("inline-flex max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-pill bg-surface-raised p-1", className)}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.key)}
            className={cls(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1 text-note font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              on ? "bg-ink text-surface" : "text-ink-soft hover:text-ink"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cls("font-data text-micro tabular-nums", on ? "text-surface/70" : "text-ink-faint")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
