import type { LucideIcon } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

const TONE = {
  blue: "hover:bg-blue-soft hover:text-blue",
  brand: "hover:bg-brand-soft hover:text-brand-deep",
  amber: "hover:bg-amber-soft hover:text-amber",
  rose: "hover:bg-rose-soft hover:text-rose",
};

/** Jadval qatoridagi ikonka-amal (ko'rish, tahrirlash, parol) — doira, tonli hover. */
export function IconAction({
  icon,
  label,
  tone = "brand",
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  tone?: keyof typeof TONE;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cls(
        "flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50",
        TONE[tone]
      )}
    >
      <Icon icon={icon} size={16} />
    </button>
  );
}
