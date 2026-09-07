import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  /** Main line — what this (empty) place is. */
  text: string;
  /** Optional second line — what to do about it. */
  hint?: string;
  action?: ReactNode;
}

/**
 * Bo'sh holat (2026-09 «Sokin panel»).
 *
 * ⚠️ Balandlik `py-14` + 56px ikonka doirasi edi — bo'sh ro'yxat ekranning
 * yarmini egallab, "sahifa buzilgan" taassurotini berardi. Referens qoidasi:
 * sahifa pastida o'lik bo'shliq bo'lmaydi, bo'sh blok kontentga teng bo'ladi.
 */
export function EmptyState({ icon, text, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line bg-surface px-6 py-8 text-center">
      {icon && <div className="text-ink-dim">{icon}</div>}
      <div>
        <p className="max-w-sm text-note text-ink-soft">{text}</p>
        {hint && <p className="mx-auto mt-1 max-w-xs text-micro text-ink-faint">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
