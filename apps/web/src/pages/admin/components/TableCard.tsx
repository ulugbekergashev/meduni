import type { ReactNode } from "react";
import { cls } from "@meduni/ui";
import { BentoCard, type BentoCardProps } from "../../../components/bento";

/**
 * `DataTable` o'z `Card`ini chizadi (`rounded-card … overflow-x-auto`). Bento
 * kartasi ichida u yassilanadi — ikki qavat chegara bo'lmasin, jadval kartaning
 * chetigacha borsin. Faqat shu juftlik nishonlanadi: bo'sh holat (EmptyState)
 * o'z chegarasini saqlaydi.
 */
const FLATTEN =
  "[&_.rounded-card.overflow-x-auto]:rounded-none [&_.rounded-card.overflow-x-auto]:border-0 [&_.rounded-card.overflow-x-auto]:bg-transparent [&_.rounded-card.overflow-x-auto]:p-0";

/**
 * Jadvalli bento kartochka — sarlavha (ixtiyoriy) + asboblar qatori (filtr,
 * qidiruv) + to'liq kenglikdagi jadval + pastki qator (jami, sahifalash).
 */
export function TableCard({
  toolbar,
  footer,
  children,
  className,
  ...card
}: Omit<BentoCardProps, "bodyClassName" | "children"> & {
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <BentoCard {...card} className={className} bodyClassName="px-0 pb-0">
      {toolbar && <div className="flex flex-wrap items-center gap-2 px-4 pb-3">{toolbar}</div>}
      <div className={cls("min-w-0 overflow-hidden border-t border-line", FLATTEN, !footer && "rounded-b-card")}>{children}</div>
      {footer && <div className="rounded-b-card border-t border-line px-4 py-3">{footer}</div>}
    </BentoCard>
  );
}
