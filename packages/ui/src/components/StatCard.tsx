import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cls } from "../cls";
import { Card } from "./Card";
import { Icon } from "./Icon";

export interface StatCardProps {
  icon?: LucideIcon;
  /** The big number (or "—" while loading). */
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  /** Classes painting the icon chip, e.g. "bg-blue-soft text-blue". */
  tone?: string;
  /** Highlight when the card doubles as an active filter. */
  selected?: boolean;
  /** Smaller paddings/number — for dense in-page stat strips. */
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Dashboard stat tile: icon chip + big tabular number + label/hint. Clickable
 *  cards lift on hover; `selected` marks the active-filter state. */
export function StatCard({
  icon,
  value,
  label,
  hint,
  tone = "bg-brand-soft text-brand-deep",
  selected = false,
  compact = false,
  onClick,
  className,
}: StatCardProps) {
  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={cls(
        "flex flex-col",
        compact ? "gap-1.5 !p-4" : "gap-2",
        selected && "border-brand ring-2 ring-brand/25",
        className
      )}
    >
      {icon && (
        <div className={cls("flex items-center justify-center rounded-full", compact ? "h-8 w-8" : "h-10 w-10", tone)}>
          <Icon icon={icon} size={compact ? 16 : 19} />
        </div>
      )}
      <span className={cls("font-bold leading-none tabular-nums text-ink", compact ? "text-[26px]" : "text-[30px]")}>
        {value ?? "—"}
      </span>
      <div>
        <p className={cls("font-semibold text-ink", compact ? "text-[13.5px]" : "text-[14.5px]")}>{label}</p>
        {hint && <p className="text-[13px] text-ink-faint">{hint}</p>}
      </div>
    </Card>
  );
}
