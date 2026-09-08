import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, Icon, StatCard, cls } from "@meduni/ui";

/**
 * Sahifa shapkasi + ko'rsatkichlar qatori.
 *
 * ⚠️ 2026-09 «Sokin panel»: ichki ko'rinish qayta yozildi, API O'ZGARMADI —
 * shu sababli 6 ta chaqiruvchi sahifa tegilmasdan yangi qiyofaga o'tdi.
 * Ilgari bu blokda gradient karta, rangli ikonka-chip, `blur-3xl` yog'du,
 * `-translate-y-1` sakrash va UPPERCASE yorliqlar bor edi — ya'ni ekrandagi
 * eng baland ovozli joy sahifaning eng ma'nosiz qismi edi.
 */
export function HeroCard({
  title,
  subtitle,
  left,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Sarlavha yonidagi qo'shimcha (hafta navigatsiyasi, halqa, streak...). */
  left?: ReactNode;
  /** HeroTile kartalari. */
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
        <div className="min-w-0">
          <h1 className="truncate text-h1 font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-note text-ink-soft">{subtitle}</p>}
        </div>
        {left && <div className="shrink-0">{left}</div>}
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{children}</div>
    </div>
  );
}

/**
 * Ko'rsatkich kartasi — endi umumiy `StatCard` ustidagi yupqa qatlam.
 * `icon`/`tone`/`accent` E'TIBORGA OLINMAYDI (§4 ovoz ierarxiyasi):
 * ko'rsatkich kartochkasida rangli chip ham, gradient ham yo'q.
 */
export function HeroTile({
  value,
  label,
  hint,
  onClick,
  selected,
}: {
  icon?: LucideIcon;
  value: string;
  label: string;
  tone?: string;
  hint?: ReactNode;
  onClick?: () => void;
  /** Faqat FILTR kartochkalarida beriladi — `undefined` = filtr emas. */
  selected?: boolean;
  accent?: boolean;
}) {
  return <StatCard label={label} value={value} hint={hint} onClick={onClick} selected={selected} />;
}

/** O'ng ustun bloki — sarlavha + ixcham ro'yxat. */
export function RailCard({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cls("!p-0", className)}>
      <div className="flex items-center gap-2 px-4 pb-3 pt-3.5">
        <Icon icon={icon} size={15} className="shrink-0 text-ink-faint" />
        <h3 className="min-w-0 flex-1 truncate text-section font-bold text-ink">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            className="shrink-0 text-micro font-bold text-brand-deep hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}
