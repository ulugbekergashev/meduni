import type { ReactNode } from "react";
import { cls } from "../cls";

export interface SegmentedOption<T extends string> {
  key: T;
  label: ReactNode;
  /** Yorliq yonidagi son (filtr natijasi soni). */
  count?: number;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (key: T) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/**
 * Segmentli tanlagich — davr filtri, ichki tablar, ko'rinish almashtirgichi
 * (2026-09 «Sokin panel»). Ilovadagi yagona nusxa.
 *
 * Ilgari bir xil boshqaruv uch xil ko'rinishda edi: profilda pill, guruh
 * sahifasida chiziqli, moliyada bosh harfli. Endi bitta: `bg-surface-raised`
 * yo'lak + 1px chegara, faol element brend fonda.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className={cls(
        "inline-flex shrink-0 items-center gap-1 rounded-control border border-line bg-surface-raised p-1",
        className
      )}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.key)}
            className={cls(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[6px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              size === "sm" ? "px-2.5 py-1 text-micro" : "px-3.5 py-1.5 text-note",
              on ? "bg-brand text-white" : "text-ink-soft hover:text-ink"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cls("font-data tabular-nums text-micro", on ? "text-white/75" : "text-ink-faint")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
