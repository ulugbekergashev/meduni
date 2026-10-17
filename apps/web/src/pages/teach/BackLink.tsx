import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Icon } from "@meduni/ui";

/** Sahifa tepasidagi "← orqaga" havolasi — Dizayn v3 (kulrang, sokin; aksent emas). */
export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-pill text-note font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Icon icon={ArrowLeft} size={14} />
      {children}
    </button>
  );
}
