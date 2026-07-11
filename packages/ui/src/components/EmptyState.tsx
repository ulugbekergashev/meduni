import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          {icon}
        </div>
      )}
      <p className="max-w-xs text-[13.5px] text-ink-soft">{text}</p>
      {action}
    </div>
  );
}
