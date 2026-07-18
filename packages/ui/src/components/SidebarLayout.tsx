import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cls } from "../cls";
import { Icon } from "./Icon";

export interface SidebarItem {
  href: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  /** Optional count shown as a pill on the right (e.g. pending items). */
  badge?: number;
}

export interface SidebarLayoutProps {
  brand: ReactNode;
  items: SidebarItem[];
  userBlock?: ReactNode;
  children: ReactNode;
  /** Sticky top-bar content (e.g. a global search); the bar itself always renders. */
  headerSlot?: ReactNode;
  /** Right side of the top bar: locale/theme switches, user block, logout. */
  rightSlot?: ReactNode;
  /** Defaults to a plain <a> — pass next/link's Link (or similar) to get client-side navigation. */
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

export function SidebarLayout({ brand, items, userBlock, children, headerSlot, rightSlot, LinkComponent }: SidebarLayoutProps) {
  const Link = LinkComponent ?? DefaultLink;
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(COLLAPSE_KEY) === "collapsed"
  );
  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "collapsed" : "open");
      } catch {
        /* storage blocked — state still works for the session */
      }
      return next;
    });

  return (
    <div className="relative flex min-h-screen bg-bg">
      {/* Collapse toggle riding the sidebar's edge; follows the width transition. */}
      <button
        onClick={toggle}
        aria-label={collapsed ? "open sidebar" : "collapse sidebar"}
        className="absolute top-[21px] z-40 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-card transition-all duration-200 hover:bg-brand-soft hover:text-brand-deep"
        style={{ left: collapsed ? 72 : 272 }}
      >
        <Icon icon={collapsed ? ChevronRight : ChevronLeft} size={15} />
      </button>
      {/* Light sidebar (2026-07 redesign): white surface, soft active chip. Colors
          come from --side-* tokens so light and dark themes each tune their own values.
          Collapsible: the header toggle shrinks it to an icon-only rail. */}
      <aside
        className={cls(
          "shrink-0 overflow-hidden border-r border-side-line bg-gradient-to-b from-side to-side-deep transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-[272px]"
        )}
      >
        <div className={cls("flex h-full flex-col", collapsed ? "w-[72px]" : "w-[272px]")}>
          <div
            className={cls(
              "pb-5 pt-7 text-[18px] font-bold tracking-tight text-side-ink",
              collapsed ? "text-center" : "px-6"
            )}
          >
            {collapsed ? (typeof brand === "string" ? brand.charAt(0) : brand) : brand}
          </div>
          <nav className={cls("flex flex-1 flex-col gap-1", collapsed ? "px-3" : "px-3.5")}>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cls(
                  "relative flex items-center rounded-control py-3 text-[16.5px] font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "gap-3 px-3.5",
                  item.active
                    ? "bg-side-active text-side-active-ink"
                    : "text-side-soft hover:bg-side-hover hover:text-side-ink"
                )}
              >
                {item.active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-pill bg-side-active-ink" />
                )}
                {/* Rail mode: icon carries the item; label becomes a native tooltip. */}
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
          {userBlock && !collapsed && <div className="border-t border-side-line px-5 py-4">{userBlock}</div>}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {/* Top bar — fixed 57px so sticky offsets below (e.g. wizard stepper) stay valid. */}
        <div className="sticky top-0 z-30 border-b border-line bg-surface px-4 sm:px-6">
          <div className="mx-auto flex h-[57px] w-full max-w-[1280px] items-center gap-3 pl-4">
            <div className="min-w-0 flex-1">{headerSlot}</div>
            {rightSlot && <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>}
          </div>
        </div>
        <div className="px-5 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
