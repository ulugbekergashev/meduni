import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

/** Ishchi panel — NotebookLM uslubi: ixcham shapka + ichki skroll.
 *  ZICHLIK QOIDASI (CLAUDE.md §4): bo'shliq panel ICHIDA (padding), panellar
 *  ORASIDA emas; desktopda panel to'liq balandlikni egallaydi va o'zi skroll qiladi. */
export function Panel({
  title,
  icon,
  actions,
  header,
  children,
  bodyClassName,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  /** To'liq maxsus shapka (title/icon/actions o'rniga). */
  header?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section
      className={cls(
        "flex flex-1 flex-col overflow-hidden rounded-card border border-line bg-surface lg:min-h-0",
        className
      )}
    >
      {header ? (
        <div className="shrink-0 border-b border-line px-2 py-1.5">{header}</div>
      ) : (
        (title || actions) && (
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
            {icon && <Icon icon={icon} size={14} className="shrink-0 text-ink-faint" />}
            {title && (
              <p className="min-w-0 flex-1 truncate text-note font-bold uppercase tracking-wide text-ink-soft">{title}</p>
            )}
            {actions}
          </div>
        )
      )}
      <div className={cls("min-h-0 flex-1 lg:overflow-y-auto", bodyClassName)}>{children}</div>
    </section>
  );
}
