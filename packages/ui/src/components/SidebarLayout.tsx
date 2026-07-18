import { useState, type ComponentType, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
    <div className="flex min-h-screen bg-bg">
      {/* Light sidebar (2026-07 redesign): white surface, soft active chip. Colors
          come from --side-* tokens so light and dark themes each tune their own values.
          Collapsible: the header toggle shrinks it to zero width. */}
      <aside
        className={cls(
          "shrink-0 overflow-hidden border-r border-side-line bg-gradient-to-b from-side to-side-deep transition-[width] duration-200",
          collapsed ? "w-0 border-r-0" : "w-[272px]"
        )}
      >
        <div className="flex h-full w-[272px] flex-col">
          <div className="px-6 pb-5 pt-7 text-[17px] font-bold tracking-tight text-side-ink">{brand}</div>
          <nav className="flex flex-1 flex-col gap-1 px-3.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cls(
                  "relative flex items-center gap-3 rounded-control px-3.5 py-3 text-[14.5px] font-medium transition-colors",
                  item.active
                    ? "bg-side-active text-side-active-ink"
                    : "text-side-soft hover:bg-side-hover hover:text-side-ink"
                )}
              >
                {item.active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-pill bg-side-active-ink" />
                )}
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose px-1.5 text-[11px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          {userBlock && <div className="border-t border-side-line px-5 py-4">{userBlock}</div>}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {/* Top bar — fixed 57px so sticky offsets below (e.g. wizard stepper) stay valid. */}
        <div className="sticky top-0 z-30 border-b border-line bg-surface px-4 sm:px-6">
          <div className="mx-auto flex h-[57px] w-full max-w-[1280px] items-center gap-3">
            <button
              onClick={toggle}
              aria-label={collapsed ? "open sidebar" : "collapse sidebar"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ink-soft transition-colors hover:bg-bg hover:text-ink"
            >
              <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size={18} />
            </button>
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
