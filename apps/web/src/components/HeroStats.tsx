import type { ReactNode } from "react";
import { Card, Icon, cls } from "@meduni/ui";
import type { LucideIcon } from "lucide-react";

/** Sahifa shapkasi: chapda sarlavha/kontekst, o'ngda ko'rsatkichlar.
 *  Talaba modullarida bir xil zichlik va ritm bo'lishi uchun umumiy. */
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
    <Card className="flex flex-wrap items-center gap-x-8 gap-y-4 !p-5">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-h1 font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-note text-ink-faint">{subtitle}</p>}
        {left && <div className="mt-3">{left}</div>}
      </div>
      <div className="grid min-w-0 flex-[2] grid-cols-2 gap-1 sm:grid-cols-4">{children}</div>
    </Card>
  );
}

/** Hero ichidagi ko'rsatkich — bosilsa filtrlaydi yoki boshqa modulga o'tadi. */
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
        "flex items-center gap-2.5 rounded-control p-2 text-left transition-colors",
        onClick && "hover:bg-bg",
        selected && "bg-brand-soft ring-1 ring-brand/30"
      )}
    >
      <div className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[19px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-ink-soft">{label}</p>
      </div>
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
        <p className="flex-1 text-note font-bold uppercase tracking-wide text-ink-soft">{title}</p>
        {action && (
          <button onClick={action.onClick} className="text-note font-semibold text-brand-deep hover:underline">
            {action.label}
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}
