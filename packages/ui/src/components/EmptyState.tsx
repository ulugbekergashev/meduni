import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  /** Main line — what this (empty) place is. */
  text: string;
  /** Optional second line — what to do about it. */
  hint?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, text, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center">
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          {icon}
        </div>
      )}
      <div>
        <p className="max-w-sm text-body font-semibold text-ink">{text}</p>
        {hint && <p className="mx-auto mt-1 max-w-xs text-note text-ink-soft">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
