import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Icon, SidebarLayout, type SidebarItem } from "@meduni/ui";
import { useLogout, useMe } from "../lib/auth";

/** Adapter: SidebarLayout expects a component taking `href`; react-router's Link takes `to`. */
function RouterLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

export interface RoleShellItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Exact-match only (for the role home item); otherwise prefix-match highlights sub-routes. */
  end?: boolean;
  /** Optional count pill (e.g. pending cases). */
  badge?: number;
}

export function RoleShell({
  brand,
  items,
  children,
}: {
  brand: string;
  items: RoleShellItem[];
  children: ReactNode;
}) {
  const { data: me } = useMe();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();

  const sidebarItems: SidebarItem[] = items.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    badge: item.badge,
    active: item.end
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));

  return (
    <SidebarLayout
      brand={brand}
      items={sidebarItems}
      LinkComponent={RouterLink}
      userBlock={
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{me?.full_name}</p>
            <p className="truncate text-[12px] text-ink-faint">{me?.email}</p>
          </div>
          <button
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) })}
            className="shrink-0 rounded-control p-2 text-ink-soft hover:bg-bg"
            aria-label="logout"
          >
            <Icon icon={LogOut} size={16} />
          </button>
        </div>
      }
    >
      {children}
    </SidebarLayout>
  );
}
