import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Moon, Sun } from "lucide-react";
import { Icon, SidebarLayout, type SidebarItem } from "@meduni/ui";
import { useLogout, useMe } from "../lib/auth";
import { getTheme, setTheme, type Theme } from "../lib/theme";
import { useLocale } from "../lib/useLocale";
import { formatDate } from "../lib/date";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Avatar } from "./Avatar";

/** Adapter: SidebarLayout expects a component taking `href`; react-router's Link takes `to`. */
function RouterLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

/** Compact header theme switch: one button, cycles light ↔ dark. */
function ThemeButton() {
  const [theme, setLocal] = useState<Theme>(getTheme());
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      onClick={() => {
        setTheme(next);
        setLocal(next);
      }}
      aria-label="theme"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-line text-ink-soft transition-colors hover:bg-bg hover:text-ink"
    >
      <Icon icon={theme === "dark" ? Sun : Moon} size={15} />
    </button>
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
  headerSlot,
  profileHref,
  fullBleed = false,
  showTheme = true,
}: {
  brand: string;
  items: RoleShellItem[];
  children: ReactNode;
  headerSlot?: ReactNode;
  /** Header'dagi user bloki shu sahifaga olib boradi (rolga qarab profil/sozlamalar). */
  profileHref: string;
  /** Ishchi sahifa (dars paneli) — to'liq ekran, panel ichida skroll. */
  fullBleed?: boolean;
  /** Talaba tomoni faqat qorong'i — tema tugmasi ko'rsatilmaydi. */
  showTheme?: boolean;
}) {
  const { data: me } = useMe();
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const locale = useLocale();

  const sidebarItems: SidebarItem[] = items.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    badge: item.badge,
    active: item.end
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));

  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");

  return (
    <SidebarLayout
      brand={brand}
      items={sidebarItems}
      headerSlot={headerSlot}
      fullBleed={fullBleed}
      LinkComponent={RouterLink}
      rightSlot={
        <>
          <span className="hidden whitespace-nowrap text-[13.5px] font-medium text-ink-faint xl:block">{today}</span>
          <LocaleSwitcher />
          {showTheme && <ThemeButton />}
          {/* User bloki — avatar + ism, bosilsa profil/sozlamalar sahifasi */}
          <Link
            to={profileHref}
            title={t("openProfile")}
            className="ml-1 flex min-w-0 items-center gap-2.5 rounded-control border-l border-line py-1 pl-3 pr-1.5 transition-colors hover:bg-bg"
          >
            <div className="hidden min-w-0 text-right leading-tight sm:block">
              <p className="max-w-[150px] truncate text-[13.5px] font-semibold text-ink">{me?.full_name}</p>
              <p className="max-w-[150px] truncate text-[12px] text-ink-faint">{me?.email}</p>
            </div>
            <Avatar name={me?.full_name ?? ""} />
          </Link>
          <button
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) })}
            aria-label="logout"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose"
          >
            <Icon icon={LogOut} size={15} />
          </button>
        </>
      }
    >
      {children}
    </SidebarLayout>
  );
}
