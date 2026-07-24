import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

const chipTone: Record<string, string> = {
  rose: "bg-rose-soft text-rose",
  amber: "bg-amber-soft text-amber",
  blue: "bg-blue-soft text-blue",
  brand: "bg-brand-soft text-brand-deep",
  violet: "bg-violet-soft text-violet",
  emerald: "bg-emerald-soft text-emerald",
};
const kickerTone: Record<string, string> = {
  rose: "text-rose",
  amber: "text-amber",
  blue: "text-blue",
  brand: "text-brand-deep",
  violet: "text-violet",
  emerald: "text-emerald",
};

/** Bitta ustuvorlik-navbat qatori — KONKRET narsaga ishora qiladi (kim/qaysi
 *  mavzu/qaysi dars), mavhum son emas. `kicker` — qaysi TUR ekanini bildiruvchi
 *  kichik yorliq (CLAUDE.md "UPPERCASE dietasi": faqat eyebrow/yorliq uchun). */
export function TaskFeedRow({
  icon,
  tone,
  kicker,
  title,
  subtitle,
  description,
  meta,
  metaTone,
  onClick,
  trailing,
}: {
  icon: LucideIcon;
  tone: string;
  kicker: string;
  title: string;
  subtitle?: string;
  description?: string | null;
  meta?: string | null;
  metaTone?: "rose" | null;
  onClick?: () => void;
  trailing: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cls("flex items-start gap-3 px-3.5 py-3 transition-colors", onClick && "cursor-pointer hover:bg-bg")}
    >
      <div className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", chipTone[tone] ?? chipTone.brand)}>
        <Icon icon={icon} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cls("text-micro font-bold uppercase tracking-wider", kickerTone[tone] ?? kickerTone.brand)}>{kicker}</p>
        <p className="truncate text-body font-semibold text-ink">{title}</p>
        {subtitle && <p className="truncate text-note text-ink-soft">{subtitle}</p>}
        {description && <p className="mt-0.5 line-clamp-2 text-note text-ink-faint">{description}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        {meta && (
          <span className={cls("text-micro", metaTone === "rose" ? "font-semibold text-rose" : "text-ink-faint")}>{meta}</span>
        )}
        {trailing}
      </div>
    </div>
  );
}
