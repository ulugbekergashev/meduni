import type { ReactNode } from "react";
import { Card, Icon, cls } from "@meduni/ui";
import type { LucideIcon } from "lucide-react";

/** Sahifa shapkasi + statistika kartalari qatori (2026-07-23 v3 — buyurtmachi
 *  DentaCRM etalonini ko'rsatdi: har ko'rsatkich ALOHIDA keng karta, tepada
 *  rangli ikonka-chip, katta raqam, havo ko'p). Sarlavha yuqorida, kartalar
 *  ostida to'liq kenglikda. */
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
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-h1 font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-note text-ink-faint">{subtitle}</p>}
        </div>
        {left && <div className="shrink-0">{left}</div>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{children}</div>
    </div>
  );
}

/** Statistika kartasi (DentaCRM uslubi): ikonka-chip → UPPERCASE yorliq → katta
 *  raqam. Bosilsa filtrlaydi yoki modulga o'tadi; `accent` — gradient urg'u karta. */
export function HeroTile({
  icon,
  value,
  label,
  tone,
  hint,
  onClick,
  selected = false,
  accent = false,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone: string;
  hint?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  /** Gradient urg'u karta (masalan asosiy ko'rsatkich). */
  accent?: boolean;
}) {
  if (accent) {
    return (
      <Card
        interactive={!!onClick}
        onClick={onClick}
        className="flex flex-col gap-3 border-0 !bg-gradient-to-br from-brand-deep to-brand !p-5 text-white"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-control bg-white/15 text-white">
          <Icon icon={icon} size={20} />
        </span>
        <div>
          <p className="text-micro font-extrabold uppercase tracking-wider text-white/75">{label}</p>
          <p className="mt-1.5 text-[30px] font-extrabold leading-none tabular-nums">{value}</p>
          {hint && <p className="mt-1.5 text-note text-white/85">{hint}</p>}
        </div>
      </Card>
    );
  }
  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={cls("flex flex-col gap-3 !p-5", selected && "border-brand ring-2 ring-brand/25")}
    >
      <span className={cls("flex h-11 w-11 items-center justify-center rounded-control", tone)}>
        <Icon icon={icon} size={20} />
      </span>
      <div>
        <p className={cls("text-micro font-extrabold uppercase tracking-wider", selected ? "text-brand-tint" : "text-ink-faint")}>
          {label}
        </p>
        <p className={cls("mt-1.5 text-[30px] font-extrabold leading-none tabular-nums", selected ? "text-brand-tint" : "text-ink")}>
          {value}
        </p>
        {hint && <p className="mt-1.5 text-note text-ink-faint">{hint}</p>}
      </div>
    </Card>
  );
}

/** O'ng ustun bloki — sarlavha + ixcham ro'yxat (dashboard rels bilan bir xil). */
export function RailCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon icon={icon} size={15} className="text-ink-faint" />
        <p className="flex-1 text-note font-bold text-ink-soft">{title}</p>
        {action && (
          <button onClick={action.onClick} className="text-note font-semibold text-brand-tint hover:underline">
            {action.label}
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}
