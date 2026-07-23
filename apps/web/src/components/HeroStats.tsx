import type { ReactNode } from "react";
import { Card, Icon, cls } from "@meduni/ui";
import type { LucideIcon } from "lucide-react";

/** Sahifa shapkasi: chapda sarlavha/kontekst, o'ngda ko'rsatkichlar.
 *  2026-07-23 redizayn: tile'lar endi havoda suzmaydi — bitta yaxlit segmentli
 *  panel (gap-px + bg-line "grout" — har qanday wrap'да ingichka ajratgich). */
export function HeroCard({
  title,
  subtitle,
  left,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Sarlavha ostidagi qo'shimcha (masalan hafta navigatsiyasi). */
  left?: ReactNode;
  /** Ko'rsatkich tile'lari. */
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-x-8 gap-y-4 !p-6">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-h1 font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-note text-ink-faint">{subtitle}</p>}
        {left && <div className="mt-3.5">{left}</div>}
      </div>
      <div className="grid w-full min-w-0 grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line sm:flex sm:w-auto sm:items-stretch">
        {children}
      </div>
    </Card>
  );
}

/** Hero ichidagi ko'rsatkich — segmentli panel katagi. Bosilsa filtrlaydi
 *  yoki boshqa modulga o'tadi. */
export function HeroTile({
  icon,
  value,
  label,
  tone,
  onClick,
  selected = false,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cls(
        "flex min-w-0 items-center gap-3 px-4 py-3.5 text-left transition-colors sm:min-w-[148px]",
        selected ? "bg-brand-soft" : "bg-surface-raised",
        onClick && !selected && "hover:bg-surface",
        onClick && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      )}
    >
      <span className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-control", tone)}>
        <Icon icon={icon} size={16} />
      </span>
      <span className="min-w-0">
        <span
          className={cls(
            "block text-[21px] font-extrabold leading-none tabular-nums",
            selected ? "text-brand-tint" : "text-ink"
          )}
        >
          {value}
        </span>
        <span className={cls("mt-1 block truncate text-note", selected ? "text-brand-tint" : "text-ink-dim")}>
          {label}
        </span>
      </span>
    </Wrapper>
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
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
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
