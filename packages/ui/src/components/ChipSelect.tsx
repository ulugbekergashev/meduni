import { X } from "lucide-react";
import { cls } from "../cls";

export interface ChipOption {
  id: number;
  label: string;
}

/** Multi-select shown as toggleable chips. Selected chips get the brand tone. */
export function ChipSelect({
  options,
  selected,
  onToggle,
  emptyText,
}: {
  options: ChipOption[];
  selected: number[];
  onToggle: (id: number) => void;
  emptyText?: string;
}) {
  if (options.length === 0 && emptyText) {
    return <p className="text-[14px] text-amber">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSel = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={cls(
              "inline-flex items-center gap-1 rounded-pill border px-3 py-1.5 text-[14px] font-medium transition-colors",
              isSel
                ? "border-brand bg-brand-soft text-brand-deep"
                : "border-line bg-surface text-ink-soft hover:bg-bg"
            )}
          >
            {opt.label}
            {isSel && <X size={13} strokeWidth={2} />}
          </button>
        );
      })}
    </div>
  );
}
