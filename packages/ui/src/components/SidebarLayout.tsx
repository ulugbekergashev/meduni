import type { ComponentType, ReactNode } from "react";
import { cls } from "../cls";

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
  /** Optional sticky top bar above the content (e.g. a global search). */
  headerSlot?: ReactNode;
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

export function SidebarLayout({ brand, items, userBlock, children, headerSlot, LinkComponent }: SidebarLayoutProps) {
  const Link = LinkComponent ?? DefaultLink;

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-5 py-6 text-[16px] font-bold text-ink">{brand}</div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cls(
                "flex items-center gap-2.5 rounded-control px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                item.active ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink"
              )}
            >
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
        {userBlock && <div className="border-t border-line px-5 py-4">{userBlock}</div>}
      </aside>
      <main className="flex-1 overflow-y-auto">
        {headerSlot && (
          <div className="sticky top-0 z-30 border-b border-line bg-surface px-5 py-2.5 sm:px-8">
            <div className="mx-auto w-full max-w-[1180px]">{headerSlot}</div>
          </div>
        )}
        <div className="px-5 py-7 sm:px-8">
          <div className="mx-auto w-full max-w-[1180px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
