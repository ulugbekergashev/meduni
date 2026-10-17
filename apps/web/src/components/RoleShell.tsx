import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, LogOut, Moon, Sun } from "lucide-react";
import { BottomNav, Icon, SidebarLayout, type SidebarItem } from "@meduni/ui";
import { useLogout, useMe } from "../lib/auth";
import { getTheme, setTheme, type Theme } from "../lib/theme";
import { useLocale } from "../lib/useLocale";
import { formatDate } from "../lib/date";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Avatar } from "./Avatar";
import { SubNavPanel, SubNavProvider, useSubNavData } from "./SubNav";

/** Adapter: SidebarLayout expects a component taking `href`; react-router's Link takes `to`. */
function RouterLink({ href, className, title, children }: { href: string; className?: string; title?: string; children: ReactNode }) {
  return (
    <Link to={href} className={className} title={title}>
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Icon icon={theme === "dark" ? Sun : Moon} size={15} />
    </button>
  );
}

export interface RoleShellItem {
  href: string;
  label: string;
  /** Mobil tab-bar uchun qisqa yorliq (i18n `navShort.*`). */
  shortLabel?: string;
  icon: ReactNode;
  /** Exact-match only (for the role home item); otherwise prefix-match highlights sub-routes. */
  end?: boolean;
  /** Optional count pill (e.g. pending cases). */
  badge?: number;
  /**
   * Qo'shimcha manzillar — shu yo'llarda ham element FAOL ko'rinadi.
   *
   * Kerak bo'lgan sabab (2026-08-02): bo'lim ichida bir nechta sahifa bo'lsa
   * (`/teach` → Bugun | Vazifalar | Jadval), `end: true` tufayli `/teach/tasks`
   * da birorta rey elementi yonmasdi va menyu "buzuq" ko'rinardi; `end` ni olib
   * tashlash esa har `/teach/*` sahifada Bosh sahifani yoqardi.
   */
  alsoActiveOn?: string[];
}

/** Ikkinchi daraja (bo'lim paneli) sahifalardan keladi — shuning uchun qobiq
 *  provayder ichida turadi: sahifa `SubNav` bilan yozadi, `Inner` o'qiydi. */
export function RoleShell(props: RoleShellProps) {
  // Yig'ilgan holat shu yerda: provayder ham biladi — yig'ilganda ichki
  // bo'limlar menyuda yo'q, sahifa o'z tasmasini desktopda ham chizadi.
  const [collapsed, setCollapsed] = useState(() => readCollapsed());
  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "collapsed" : "open");
      } catch {}
      return next;
    });
  return (
    <SubNavProvider inline={collapsed}>
      <RoleShellInner {...props} collapsed={collapsed} onToggleCollapsed={toggle} />
    </SubNavProvider>
  );
}

// Yangi kalit (Dizayn v3): eski "meduni.navpanel" faqat bo'lim panelini
// yig'ardi — u holatni butun menyuga ko'chirmaymiz.
const COLLAPSE_KEY = "meduni.sidebar.v3";

function readCollapsed(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(COLLAPSE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

interface RoleShellProps {
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
  /**
   * Mobil tab-barda nechta bo'lim ko'rinadi (qolgani "Yana" panelida).
   *
   * ⚠️ `BottomNav` sukut bo'yicha 4 ta ko'rsatadi va "Yana" tugmasini FAQAT
   * yashiringan element qolganda chizadi. Ya'ni aynan 4 ta nav elementi bo'lsa
   * "Yana" umuman chiqmaydi va uning ichidagi Til / Tema / **Chiqish**
   * mobilda ochib bo'lmaydigan bo'lib qoladi. Shuning uchun 4 elementli
   * rollarda bu qiymat 3 ga tushiriladi.
   */
  primaryCount?: number;
}

function RoleShellInner({
  brand,
  items,
  children,
  headerSlot,
  profileHref,
  fullBleed = false,
  showTheme = true,
  primaryCount,
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
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
  /**
   * Mobil tab-barda nechta bo'lim ko'rinadi (qolgani "Yana" panelida).
   *
   * ⚠️ `BottomNav` sukut bo'yicha 4 ta ko'rsatadi va "Yana" tugmasini FAQAT
   * yashiringan element qolganda chizadi. Ya'ni aynan 4 ta nav elementi bo'lsa
   * "Yana" umuman chiqmaydi va uning ichidagi Til / Tema / **Chiqish**
   * mobilda ochib bo'lmaydigan bo'lib qoladi. Shuning uchun 4 elementli
   * rollarda bu qiymat 3 ga tushiriladi.
   */
  primaryCount?: number;
}) {
  const { data: me } = useMe();
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const locale = useLocale();
  const subNav = useSubNavData();

  const sidebarItems: SidebarItem[] = items.map((item) => ({
    href: item.href,
    label: item.label,
    shortLabel: item.shortLabel,
    icon: item.icon,
    badge: item.badge,
    active:
      (item.end ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)) ||
      (item.alsoActiveOn?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false),
  }));

  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");
  const doLogout = () => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) });

  // Mobil "Yana" panelining pastki bloki — headerdan ko'chgan boshqaruvlar.
  const moreExtra = (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-[52px] items-center justify-between gap-3 px-3">
        <span className="text-body font-semibold text-ink">{t("language")}</span>
        <LocaleSwitcher />
      </div>
      {showTheme && (
        <div className="flex min-h-[52px] items-center justify-between gap-3 px-3">
          <span className="text-body font-semibold text-ink">{t("theme")}</span>
          <ThemeButton />
        </div>
      )}
      <button
        onClick={doLogout}
        className="flex min-h-[52px] items-center gap-3 rounded-control px-3 text-body font-semibold text-rose transition-colors hover:bg-rose-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Icon icon={LogOut} size={18} />
        {t("logout")}
      </button>
    </div>
  );

  return (
    <SidebarLayout
      brand={brand}
      items={sidebarItems}
      headerSlot={headerSlot}
      fullBleed={fullBleed}
      panel={subNav ? <SubNavPanel data={subNav} parentLabel={sidebarItems.find((i) => i.active)?.label} /> : undefined}
      LinkComponent={RouterLink}
      bottomNav={
        <BottomNav
          items={sidebarItems}
          primaryCount={primaryCount}
          moreLabel={t("more")}
          moreExtra={moreExtra}
          LinkComponent={RouterLink}
        />
      }
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      collapseLabel={t("collapse")}
      expandLabel={t("expand")}
      userCard={
        <div className="flex items-center gap-1">
          <Link
            to={profileHref}
            title={t("openProfile")}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control p-1.5 transition-colors hover:bg-side-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Avatar name={me?.full_name ?? ""} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-note font-semibold text-side-ink">{me?.full_name}</span>
              <span className="block truncate text-micro text-side-soft">{me?.email}</span>
            </span>
            <Icon icon={ChevronRight} size={14} className="shrink-0 text-side-soft" />
          </Link>
          <button
            onClick={doLogout}
            aria-label={t("logout")}
            title={t("logout")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-side-soft transition-colors hover:bg-rose-soft hover:text-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={LogOut} size={16} />
          </button>
        </div>
      }
      userCompact={
        <Link to={profileHref} title={me?.full_name ?? t("openProfile")} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <Avatar name={me?.full_name ?? ""} />
        </Link>
      }
      rightSlot={
        <>
          <span className="hidden whitespace-nowrap text-note font-medium text-ink-soft xl:block">{today}</span>
          {/* Til/tema mobilda "Yana" panelida — headerda joy tor. */}
          <span className="hidden lg:inline-flex">
            <LocaleSwitcher />
          </span>
          {showTheme && <span className="hidden lg:inline-flex"><ThemeButton /></span>}
          {/* Mobilda menyu yo'q — profilga yo'l headerda qoladi. */}
          <Link to={profileHref} title={t("openProfile")} className="rounded-full lg:hidden">
            <Avatar name={me?.full_name ?? ""} />
          </Link>
        </>
      }
    >
      {children}
    </SidebarLayout>
  );
}
