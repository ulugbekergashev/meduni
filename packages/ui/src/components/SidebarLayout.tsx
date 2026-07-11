import type { ComponentType, ReactNode } from "react";
import { cls } from "../cls";

export interface SidebarItem {
  href: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
}

export interface SidebarLayoutProps {
  brand: ReactNode;
  items: SidebarItem[];
  userBlock?: ReactNode;
  children: ReactNode;
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

export function SidebarLayout({ brand, items, userBlock, children, LinkComponent }: SidebarLayoutProps) {
  const Link = LinkComponent ?? DefaultLink;

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-5 py-6 text-[16px] font-bold text-ink">{brand}</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cls(
                "flex items-center gap-2.5 rounded-control px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                item.active ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        {userBlock && <div className="border-t border-line px-5 py-4">{userBlock}</div>}
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
    </div>
  );
}
