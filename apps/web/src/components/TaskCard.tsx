import type { LucideIcon } from "lucide-react";
import { Icon } from "@meduni/ui";

// Full class strings (Tailwind JIT needs them literal, not interpolated).
const toneClass: Record<string, string> = {
  rose: "border-rose/30 bg-rose-soft text-rose",
  amber: "border-amber/30 bg-amber-soft text-amber",
  blue: "border-blue/30 bg-blue-soft text-blue",
  brand: "border-brand/30 bg-brand-soft text-brand-deep",
  violet: "border-violet/30 bg-violet-soft text-violet",
  emerald: "border-emerald/40 bg-emerald-soft text-emerald",
};

/** A single actionable task tile (count/value + label), links to where you act. */
export function TaskCard({
  icon,
  tone,
  value,
  label,
  onClick,
}: {
  icon: LucideIcon;
  tone: string;
  value: string | number;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-3 rounded-card border p-3.5 text-left transition-all ${
        toneClass[tone] ?? toneClass.brand
      } ${onClick ? "hover:-translate-y-0.5 hover:shadow-sm" : "cursor-default"}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60">
        <Icon icon={icon} size={18} />
      </div>
      <span className="text-[24px] font-bold leading-none tabular-nums">{value}</span>
      <span className="min-w-0 flex-1 text-body font-semibold">{label}</span>
    </button>
  );
}
