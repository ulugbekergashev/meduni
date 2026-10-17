import { ArrowLeft } from "lucide-react";
import { Icon } from "@meduni/ui";

/** Orqaga havola — sahifa shapkasi (`PageHeader`) ustidagi kichik qator. */
export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 inline-flex items-center gap-1 rounded-control text-note font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Icon icon={ArrowLeft} size={15} /> {label}
    </button>
  );
}
