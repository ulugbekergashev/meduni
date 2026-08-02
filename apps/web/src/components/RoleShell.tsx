import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Moon, Sun } from "lucide-react";
import { BottomNav, Icon, SidebarLayout, type SidebarItem } from "@meduni/ui";
import { useLogout, useMe } from "../lib/auth";
import { getTheme, setTheme, type Theme } from "../lib/theme";
import { useLocale } from "../lib/useLocale";
import { formatDate } from "../lib/date";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Avatar } from "./Avatar";
import { SubNavPanel, SubNavProvider, useSubNavData } from "./SubNav";

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
  return (
    <SubNavProvider>
      <RoleShellInner {...props} />
    </SubNavProvider>
  );
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
      panel={subNav ? <SubNavPanel data={subNav} /> : undefined}
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
      rightSlot={
        <>
          <span className="hidden whitespace-nowrap text-[13.5px] font-medium text-ink-faint xl:block">{today}</span>
          {/* Til/tema/chiqish mobilda "Yana" panelida — headerda joy tor. */}
          <span className="hidden lg:inline-flex">
            <LocaleSwitcher />
          </span>
          {showTheme && <span className="hidden lg:inline-flex"><ThemeButton /></span>}
          {/* User bloki — avatar + ism, bosilsa profil/sozlamalar sahifasi */}
          <Link
            to={profileHref}
            title={t("openProfile")}
            className="flex min-w-0 items-center gap-2.5 rounded-control py-1 pr-0.5 transition-colors hover:bg-bg lg:ml-1 lg:border-l lg:border-line lg:pl-3 lg:pr-1.5"
          >
            <div className="hidden min-w-0 text-right leading-tight lg:block">
              <p className="max-w-[150px] truncate text-[13.5px] font-semibold text-ink">{me?.full_name}</p>
              <p className="max-w-[150px] truncate text-[12px] text-ink-faint">{me?.email}</p>
            </div>
            <Avatar name={me?.full_name ?? ""} />
          </Link>
          <button
            onClick={doLogout}
            aria-label="logout"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose lg:flex"
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
