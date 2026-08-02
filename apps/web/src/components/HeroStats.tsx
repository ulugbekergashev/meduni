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
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-5 gap-y-2.5">
        <div className="min-w-0">
          <h1 className="text-h1 font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-note text-ink-faint">{subtitle}</p>}
        </div>
        {left && <div className="shrink-0">{left}</div>}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">{children}</div>
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
        className="group flex flex-col gap-3 border-0 !bg-gradient-to-br from-brand-deep via-brand to-violet !p-5 text-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-control bg-white/20 text-white shadow-inner backdrop-blur-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon icon={icon} size={20} />
        </span>
        <div>
          <p className="text-note font-extrabold uppercase tracking-wider text-white/80">{label}</p>
          <p className="mt-1 text-stat font-extrabold leading-none tabular-nums drop-shadow-md">{value}</p>
          {hint && <p className="mt-1.5 text-note text-white/90">{hint}</p>}
        </div>
      </Card>
    );
  }
  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={cls(
        "group relative overflow-hidden flex flex-col gap-3 !p-4 transition-all duration-300 hover:-translate-y-1",
        selected ? "border-brand ring-2 ring-brand/30 shadow-[0_0_20px_rgba(79,70,229,0.15)]" : "border border-line shadow-card hover:shadow-card-hover"
      )}
    >
      {/* Subtle glow effect behind the icon */}
      <div className={cls("absolute -top-8 -left-8 h-24 w-24 rounded-full blur-3xl opacity-20 transition-opacity duration-300 group-hover:opacity-40", tone.replace("text-", "bg-"))} />
      
      <span className={cls("relative flex h-10 w-10 items-center justify-center rounded-control transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6", tone)}>
        <Icon icon={icon} size={20} />
      </span>
      <div className="relative z-10">
        <p className={cls("text-micro font-bold uppercase tracking-wider", selected ? "text-brand-tint" : "text-ink-soft")}>
          {label}
        </p>
        <p className={cls("mt-1 text-h1 font-extrabold leading-none tabular-nums tracking-tight", selected ? "text-brand-tint" : "text-ink")}>
          {value}
        </p>
        {hint && <p className="mt-1 text-note font-medium text-ink-faint">{hint}</p>}
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
