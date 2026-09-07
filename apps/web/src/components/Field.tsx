import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-note font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
