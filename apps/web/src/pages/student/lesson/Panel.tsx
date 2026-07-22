import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

/** Panel "ovoz balandligi" (2026-07-23 — kabina effektiga qarshi):
 *  - `content` — o'qiladigan yuza. Ekrandagi YAGONA yoritilgan karta:
 *    ko'tarilgan fon + chegara. Fokus shu yerda.
 *  - `chrome` — xizmatchi ustun (rail / chat). Kartaga o'ralmaydi: sahifa
 *    fonida turadi, chegarasi yo'q — shuning uchun markazga raqobat qilmaydi.
 *  Sabab: uchala ustun bir xil `bg-surface + border` bo'lganda ko'z qayerga
 *  qarashni bilmaydi ("samolyot boshqaruvi" hissi). */
export type PanelTone = "content" | "chrome";

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
  tone = "content",
}: {
  title?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  /** To'liq maxsus shapka (title/icon/actions o'rniga). */
  header?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
  tone?: PanelTone;
}) {
  const chrome = tone === "chrome";
  return (
    <section
      className={cls(
        "flex flex-1 flex-col overflow-hidden lg:min-h-0",
        chrome ? "rounded-card" : "rounded-card border border-line bg-surface",
        className
      )}
    >
      {header ? (
        <div className={cls("shrink-0 px-2 py-1.5", !chrome && "border-b border-line")}>{header}</div>
      ) : (
        (title || actions) && (
          <div
            className={cls(
              "flex shrink-0 items-center gap-2 px-3 py-2",
              chrome ? "pb-1" : "border-b border-line"
            )}
          >
            {icon && <Icon icon={icon} size={14} className="shrink-0 text-ink-faint" />}
            {/* UPPERCASE dietasi: panel sarlavhasi endi oddiy registrda —
                ekranda bir vaqtda 3 ta "qichqiruvchi" yorliq turmasin. */}
            {title && <p className="min-w-0 flex-1 truncate text-note font-bold text-ink-soft">{title}</p>}
            {actions}
          </div>
        )
      )}
      <div className={cls("min-h-0 flex-1 lg:overflow-y-auto", bodyClassName)}>{children}</div>
    </section>
  );
}
