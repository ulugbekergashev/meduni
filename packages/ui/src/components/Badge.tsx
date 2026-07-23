import type { ReactNode } from "react";
import { cls } from "../cls";

export type BadgeTone = "brand" | "blue" | "violet" | "amber" | "rose" | "emerald" | "slate";

const toneClass: Record<BadgeTone, string> = {
  brand: "bg-brand-soft text-brand-deep",
  blue: "bg-blue-soft text-blue",
  violet: "bg-violet-soft text-violet",
  amber: "bg-amber-soft text-amber",
  rose: "bg-rose-soft text-rose",
  emerald: "bg-emerald-soft text-emerald",
  slate: "bg-bg text-ink-soft",
};

export function Badge({ tone = "slate", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cls(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-note font-semibold",
        toneClass[tone]
      )}
    >
      {children}
    </span>
  );
}
