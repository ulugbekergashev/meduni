import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13.5px] font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
