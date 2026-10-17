import type { ReactNode } from "react";
import { cls } from "@meduni/ui";

/**
 * Sahifa shapkasi — Dizayn v3: chapda h1 (26px) + bir qatorli kontekst,
 * o'ngda chiplar yoki asosiy amal (qora pill `Button`). Karta EMAS —
 * sahifa fonida turadi.
 */
export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cls("mb-3 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-h1 font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-note text-ink-soft">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}

/** Shapka yonidagi kulrang yoki tonli chip (streak, reyting, davr). */
export function HeaderChip({
  icon,
  children,
  tone = "plain",
  onClick,
  title,
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "plain" | "amber" | "brand" | "rose" | "emerald";
  onClick?: () => void;
  title?: string;
}) {
  const toneCls = {
    plain: "border border-line bg-surface text-ink-2",
    amber: "bg-amber-soft text-amber",
    brand: "bg-brand-soft text-brand-deep",
    rose: "bg-rose-soft text-rose",
    emerald: "bg-emerald-soft text-emerald",
  }[tone];
  const cl = cls("inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-note font-semibold", toneCls);
  if (!onClick)
    return (
      <span className={cl} title={title}>
        {icon}
        {children}
      </span>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cls(cl, "transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand")}
    >
      {icon}
      {children}
    </button>
  );
}
