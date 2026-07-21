import { useState, type ComponentType, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { motion } from "framer-motion";
import { cls } from "../cls";
import { Icon } from "./Icon";

export interface SidebarItem {
  href: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  badge?: number;
}

export interface SidebarLayoutProps {
  brand: ReactNode;
  items: SidebarItem[];
  userBlock?: ReactNode;
  children: ReactNode;
  headerSlot?: ReactNode;
  rightSlot?: ReactNode;
  /** Ishchi sahifalar (dars paneli) — shell max-w/padding qo'ymaydi, kontent
   *  butun ekranni to'ldiradi va panellar o'z ichida skroll qiladi.
   *  ZICHLIK QOIDASI (CLAUDE.md §4). */
  fullBleed?: boolean;
  LinkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
}

function DefaultLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

const COLLAPSE_KEY = "meduni.sidebar";

export function SidebarLayout({ brand, items, children, headerSlot, rightSlot, fullBleed = false, LinkComponent }: SidebarLayoutProps) {
  const Link = LinkComponent ?? DefaultLink;
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(COLLAPSE_KEY) === "collapsed"
  );
  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "collapsed" : "open");
      } catch {}
      return next;
    });

  return (
    <div className={cls("flex bg-bg", fullBleed ? "h-screen overflow-hidden" : "min-h-screen")}>
      <aside
        className={cls(
          "sticky top-0 z-20 h-screen shrink-0 flex flex-col border-r border-side-line bg-side transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-[272px]"
        )}
      >
        <div
          className={cls(
            "flex h-[57px] shrink-0 items-center border-b border-side-line text-[18px] font-bold tracking-tight text-side-ink",
            collapsed ? "justify-center" : "px-6"
          )}
        >
          {collapsed ? (typeof brand === "string" ? brand.charAt(0) : brand) : brand}
        </div>

        <nav className={cls("flex flex-1 flex-col gap-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cls(
                "relative flex items-center rounded-control py-2.5 text-[15px] font-medium transition-colors duration-150",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                item.active
                  ? "bg-side-active text-side-active-ink"
                  : "text-side-soft hover:bg-side-hover hover:text-side-ink"
              )}
            >
              {item.active && (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
                />
              )}
              <span className="relative shrink-0" title={collapsed ? item.label : undefined}>
                {item.icon}
                {collapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-side bg-rose" />
                )}
              </span>
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose px-1.5 text-[12px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[57px] shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <button
            onClick={toggle}
            aria-label={collapsed ? "open sidebar" : "collapse sidebar"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ink-soft transition-colors hover:bg-bg hover:text-ink"
          >
            <Icon icon={PanelLeft} size={18} />
          </button>
          <div className="min-w-0 flex-1">{headerSlot}</div>
          {rightSlot && <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>}
        </header>

        {fullBleed ? (
          // Ishchi rejim — kontent butun maydonni to'ldiradi. Desktopda panel
          // ichida skroll; mobilda sahifa skroll qiladi (panellar ustma-ust).
          <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">{children}</div>
        ) : (
          <div className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        )}
      </main>
    </div>
  );
}
