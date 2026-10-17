import { type ComponentType, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cls } from "../cls";
import { Icon } from "./Icon";

export interface SidebarItem {
  href: string;
  label: string;
  /** Mobil tab-bar va yig'ilgan rey uchun qisqa yorliq. */
  shortLabel?: string;
  icon?: ReactNode;
  active?: boolean;
  badge?: number;
}

export interface SidebarLayoutProps {
  brand: ReactNode;
  items: SidebarItem[];
  children: ReactNode;
  headerSlot?: ReactNode;
  rightSlot?: ReactNode;
  /** Ishchi sahifalar (dars paneli) — shell max-w/padding qo'ymaydi, kontent
   *  butun ekranni to'ldiradi va panellar o'z ichida skroll qiladi (§4). */
  fullBleed?: boolean;
  /** Mobil navigatsiya (`BottomNav`) — `lg` dan kichik ekranda pastda turadi. */
  bottomNav?: ReactNode;
  /** Ishchi rejimda (dars) pastki menyu yashiriladi — o'sha yerda o'z paneli bor. */
  hideBottomNav?: boolean;
  /**
   * Faol modulning ichki bo'limlari. Dizayn v3 (2026-10): alohida 248px ustun
   * EMAS — faol band OSTIDA ichma-ich ro'yxat. Yig'ilgan menyuda chizilmaydi
   * (u holda sahifa o'z tasmasini ko'rsatadi — `SubNav`).
   */
  panel?: ReactNode;
  /** Menyu pastidagi foydalanuvchi kartasi (yoyilgan holatda). */
  userCard?: ReactNode;
  /** Yig'ilgan holatdagi ixcham foydalanuvchi belgisi (avatar). */
  userCompact?: ReactNode;
  /** Menyu yig'ilganmi — holat qobiqda (RoleShell), chunki `SubNav` ham biladi. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  collapseLabel?: string;
  expandLabel?: string;
  LinkComponent?: ComponentType<{ href: string; className?: string; title?: string; children: ReactNode }>;
}

function DefaultLink({ href, className, title, children }: { href: string; className?: string; title?: string; children: ReactNode }) {
  return (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  );
}

function Badge({ n, dot }: { n: number; dot?: boolean }) {
  return (
    <span
      className={cls(
        "flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-rose px-1.5 text-micro font-semibold leading-none text-white",
        dot && "absolute -right-1.5 -top-1.5 h-4 min-w-[16px] border-2 border-side px-0.5"
      )}
    >
      {n > 9 && dot ? "9+" : n}
    </span>
  );
}

/**
 * Ilova qobig'i — Dizayn v3 «Pastel bento».
 *
 * Chapda YOZUVLI menyu (brend · bandlar · foydalanuvchi). Faol band — qora pill;
 * uning ichki bo'limlari (kurs: Mavzular/Natijalar/…) shu band ostida ochiladi.
 * Yig'ilganda 76px ikonka reyiga aylanadi. `lg` dan kichikda menyu yo'q —
 * pastki tab-bar (`BottomNav`).
 */
export function SidebarLayout({
  brand,
  items,
  children,
  headerSlot,
  rightSlot,
  fullBleed = false,
  bottomNav,
  hideBottomNav = false,
  panel,
  userCard,
  userCompact,
  collapsed = false,
  onToggleCollapsed,
  collapseLabel = "Collapse menu",
  expandLabel = "Expand menu",
  LinkComponent,
}: SidebarLayoutProps) {
  const Link = LinkComponent ?? DefaultLink;
  const reduce = useReducedMotion();
  const brandText = typeof brand === "string" ? brand : null;
  // "MedUni AI · O'qituvchi" — rol ikkinchi qatorga (bir qatorda qirqilardi).
  const [brandName, brandRole] = brandText ? brandText.split(" · ") : [null, null];

  const showBottomNav = Boolean(bottomNav) && !hideBottomNav;
  // Pastki menyu balandligi + iPhone "home indicator" — kontent tagidagi havo.
  const bottomNavPad = "pb-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom))] lg:pb-6";

  return (
    <div className={cls("flex bg-bg", fullBleed ? "h-screen overflow-hidden" : "min-h-screen")}>
      <aside
        className={cls(
          "sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-side-line bg-side transition-[width] duration-200 lg:flex",
          collapsed ? "w-rail" : "w-sidebar"
        )}
      >
        {/* Brend */}
        <div className={cls("flex h-[var(--header-h)] shrink-0 items-center gap-2.5", collapsed ? "justify-center" : "px-5")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-ink text-section font-semibold text-surface">
            {brandText ? brandText.charAt(0) : "M"}
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-section font-semibold tracking-tight text-side-ink">{brandName ?? brand}</span>
              {brandRole && <span className="block truncate text-micro text-side-soft">{brandRole}</span>}
            </span>
          )}
        </div>

        <nav className={cls("flex flex-1 flex-col gap-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
          {items.map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cls(
                  "group relative flex items-center rounded-pill font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  collapsed ? "h-11 justify-center" : "h-10 gap-3 px-3.5 text-note",
                  item.active ? "text-surface" : "text-side-soft hover:bg-side-hover hover:text-side-ink"
                )}
              >
                {item.active && (
                  <motion.span
                    layoutId={reduce ? undefined : "sidebar-active-pill"}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    className="absolute inset-0 rounded-pill bg-ink"
                  />
                )}
                <span className="relative shrink-0">
                  {item.icon}
                  {collapsed && item.badge !== undefined && item.badge > 0 && <Badge n={item.badge} dot />}
                </span>
                {!collapsed && <span className="relative min-w-0 flex-1 truncate">{item.label}</span>}
                {!collapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="relative">
                    <Badge n={item.badge} />
                  </span>
                )}
              </Link>
              {/* Ichki bo'limlar — faqat faol band ostida va yoyilgan holatda. */}
              {item.active && panel && !collapsed && (
                <div className="mb-1 ml-[26px] mt-1 border-l border-side-line pl-2">{panel}</div>
              )}
            </div>
          ))}
        </nav>

        {/* Pastki blok: foydalanuvchi + yig'ish */}
        <div className={cls("shrink-0 border-t border-side-line", collapsed ? "flex flex-col items-center gap-2 py-3" : "p-3")}>
          {collapsed ? userCompact : userCard}
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? expandLabel : collapseLabel}
              title={collapsed ? expandLabel : collapseLabel}
              className={cls(
                "flex h-9 items-center gap-2 rounded-pill text-note font-medium text-side-soft transition-colors hover:bg-side-hover hover:text-side-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                collapsed ? "w-9 justify-center" : "mt-2 w-full px-3.5"
              )}
            >
              <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size={17} />
              {!collapsed && <span className="truncate">{collapseLabel}</span>}
            </button>
          )}
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[var(--header-h)] shrink-0 items-center gap-2 border-b border-line bg-bg px-3 sm:gap-4 sm:px-6 lg:border-transparent">
          {/* Mobilda brend header'da turadi (yon menyu ko'rinmaydi). */}
          <span className="flex shrink-0 items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-ink text-note font-semibold text-surface">
              {brandText ? brandText.charAt(0) : "M"}
            </span>
          </span>
          <div className="min-w-0 flex-1">{headerSlot}</div>
          {rightSlot && <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{rightSlot}</div>}
        </header>

        {fullBleed ? (
          <div className={cls("min-h-0 flex-1 overflow-y-auto lg:overflow-hidden", showBottomNav && bottomNavPad)}>
            {children}
          </div>
        ) : (
          <div
            className={cls(
              "mx-auto w-full max-w-[1760px] flex-1 px-3 pb-4 pt-1 sm:px-6 sm:pb-6 2xl:px-8",
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
