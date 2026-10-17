import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

export interface BentoRowProps {
  icon?: LucideIcon;
  /** Ikonka doirasining rangi — `bg-X-soft text-X` juftligi (semantik ton). */
  iconTone?: string;
  /** Ikonka o'rniga chap blok (vaqt katagi, avatar, raqam). */
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** O'ngdagi qiymat (mono raqam, chip). */
  right?: ReactNode;
  onClick?: () => void;
  /** Bosiladigan qatorda o'ngdagi doira-strelka (sukut: bor). */
  arrow?: boolean;
  /** Qator yonidagi alohida amal (✓ belgilash) — qator tugmasidan TASHQARIDA. */
  trailing?: ReactNode;
  muted?: boolean;
  className?: string;
}

/**
 * Bento ro'yxat qatori — Dizayn v3 ro'yxatlarining yagona qatori.
 * Bosiladigan bo'lsa haqiqiy `<button>`; ichma-ich tugma yo'q (`trailing` yonda).
 */
export function BentoRow({
  icon,
  iconTone = "bg-surface-raised text-ink-2",
  lead,
  title,
  sub,
  right,
  onClick,
  arrow = true,
  trailing,
  muted = false,
  className,
}: BentoRowProps) {
  const inner = (
    <>
      {lead ??
        (icon && (
          <span className={cls("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", iconTone)}>
            <Icon icon={icon} size={15} />
          </span>
        ))}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold text-ink">{title}</span>
        {sub && <span className="block truncate text-micro text-ink-soft">{sub}</span>}
      </span>
      {right !== undefined && right !== null && (
        <span className="shrink-0 font-data text-note font-semibold tabular-nums text-ink-2">{right}</span>
      )}
      {onClick && arrow && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface">
          <Icon icon={ArrowRight} size={13} />
        </span>
      )}
    </>
  );
  const rowCls = cls(
    "group flex min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-2 text-left",
    muted && "opacity-60"
  );
  return (
    <div className={cls("flex items-center gap-1", className)}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cls(rowCls, "transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand")}
        >
          {inner}
        </button>
      ) : (
        <div className={rowCls}>{inner}</div>
      )}
      {trailing}
    </div>
  );
}
