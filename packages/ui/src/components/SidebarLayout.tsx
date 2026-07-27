import { useState, type ComponentType, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { motion } from "framer-motion";
import { cls } from "../cls";
import { Icon } from "./Icon";

export interface SidebarItem {
  href: string;
  label: string;
  /** Mobil tab-bar uchun qisqa yorliq (katak ~78px — uzun nom qirqiladi). */
  shortLabel?: string;
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
  /** Mobil navigatsiya (`BottomNav`) — `lg` dan kichik ekranda pastda turadi.
   *  RoleShell yig'adi (i18n + til/tema/chiqish bloki u yerda). */
  bottomNav?: ReactNode;
  /** Ishchi rejimda (dars) pastki menyu yashiriladi — o'sha yerda o'z paneli bor. */
  hideBottomNav?: boolean;
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

export function SidebarLayout({
  brand,
  items,
  children,
  headerSlot,
  rightSlot,
  fullBleed = false,
  bottomNav,
  hideBottomNav = false,
  LinkComponent,
}: SidebarLayoutProps) {
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

  const showBottomNav = Boolean(bottomNav) && !hideBottomNav;
  // Pastki menyu balandligi + iPhone "home indicator" — kontent tagidagi havo.
  // lg+ da menyu yo'q, shuning uchun oddiy paddingga qaytamiz.
  const bottomNavPad = "pb-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom))] lg:pb-5";

  return (
    <div className={cls("flex bg-bg", fullBleed ? "h-screen overflow-hidden" : "min-h-screen")}>
      {/* Yon panel — faqat lg+ da. Mobilda uning o'rniga pastki tab-bar ishlaydi
          (272px panel 375px ekranda joyning uchdan ikkisini yeb qo'yardi). */}
      <aside
        className={cls(
          "sticky top-0 z-20 h-screen shrink-0 hidden lg:flex flex-col border-r border-side-line bg-side transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-[272px]"
        )}
      >
        <div
          className={cls(
            "flex h-[var(--header-h)] shrink-0 items-center border-b border-side-line text-[18px] font-bold tracking-tight text-side-ink",
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
                "relative flex items-center rounded-control py-3 text-body font-semibold transition-colors duration-150",
                collapsed ? "justify-center px-0" : "gap-3 px-3.5",
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
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose px-1.5 text-micro font-bold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* ⚠️ Ilgari `bg-surface/80 border-line/50` edi — token ranglarda
            shaffoflik modifikatori CSS generatsiya QILMAYDI, ya'ni header
            fonsiz va chegarasiz qolardi (skroll paytida matn ostidan
            ko'rinardi). Solid token ishlatiladi. */}
        <header className="sticky top-0 z-30 flex h-[var(--header-h)] shrink-0 items-center gap-2 border-b border-line bg-surface px-3 shadow-sm sm:gap-4 sm:px-6 transition-all duration-300">
          {/* Yig'ish tugmasi faqat lg+ da mantiqiy — mobilda yon panel yo'q. */}
          <button
            onClick={toggle}
            aria-label={collapsed ? "open sidebar" : "collapse sidebar"}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-all hover:bg-surface-raised hover:text-ink hover:shadow-sm lg:flex"
          >
            <Icon icon={PanelLeft} size={18} />
          </button>
          {/* Mobilda brend header'da turadi (yon panel ko'rinmaydi). */}
          <span className="shrink-0 truncate text-[17px] font-extrabold tracking-tight text-ink lg:hidden">
            {brand}
          </span>
          <div className="min-w-0 flex-1">{headerSlot}</div>
          {rightSlot && <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{rightSlot}</div>}
        </header>

        {fullBleed ? (
          // Ishchi rejim — kontent butun maydonni to'ldiradi. Desktopda panel
          // ichida skroll; mobilda sahifa skroll qiladi (panellar ustma-ust).
          <div className={cls("min-h-0 flex-1 overflow-y-auto lg:overflow-hidden", showBottomNav && bottomNavPad)}>
            {children}
          </div>
        ) : (
          <div
            className={cls(
              "mx-auto w-full max-w-[1760px] flex-1 px-3 py-3 sm:px-6 sm:py-5 2xl:px-8",
              // Pastki menyu kontentning oxirgi elementini yopib qo'ymasin.
              showBottomNav && bottomNavPad
            )}
          >
            {children}
          </div>
        )}
      </main>

      {showBottomNav && bottomNav}
    </div>
  );
}
