"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearTokens } from "@/lib/api";
import type { Me } from "@/lib/useAuth";
import { IconLogo, IconLogOut } from "./Icons";
import LocaleSwitcher from "./LocaleSwitcher";
import { Avatar, cls } from "./ui";

export type NavItem = { href: string; label: string; icon?: ReactNode };

function Logo() {
  const t = useTranslations("common");
  return (
    <span className="flex items-center gap-2">
      <IconLogo className="text-2xl text-teal-600" />
      <span className="text-lg font-bold tracking-tight text-slate-900">
        {t("appName")}
        <span className="text-teal-600">.</span>
      </span>
    </span>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <button
      onClick={() => {
        clearTokens();
        router.replace("/login");
      }}
      title={t("logout")}
      className={cls(
        "flex items-center gap-2 rounded-lg text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800",
        compact ? "p-2" : "w-full px-3 py-2",
      )}
    >
      <IconLogOut className="text-base" />
      {!compact && t("logout")}
    </button>
  );
}

function NavLinks({ nav, orientation }: { nav: NavItem[]; orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <>
      {nav.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cls(
              "flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors",
              orientation === "vertical" ? "px-3 py-2.5" : "shrink-0 px-3 py-2",
              active
                ? "bg-teal-50 text-teal-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            {item.icon && <span className={cls("text-lg", active ? "text-teal-600" : "text-slate-400")}>{item.icon}</span>}
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/**
 * Каркас приложения.
 * variant="sidebar" — админ/преподаватель (desktop-first, боковое меню);
 * variant="top" — студент (mobile-first, шапка).
 */
export default function Shell({
  me,
  nav = [],
  variant = "top",
  children,
}: {
  me?: Me;
  nav?: NavItem[];
  variant?: "sidebar" | "top";
  children: ReactNode;
}) {
  if (variant === "sidebar") {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="px-5 py-5">
            <Logo />
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            <NavLinks nav={nav} orientation="vertical" />
          </nav>
          <div className="border-t border-slate-200 p-3">
            {me && (
              <div className="mb-2 flex items-center gap-2.5 px-2 py-1.5">
                <Avatar name={me.full_name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{me.full_name}</p>
                  <p className="truncate text-xs text-slate-400">{me.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between px-2">
              <LocaleSwitcher />
              <LogoutButton compact />
            </div>
          </div>
        </aside>

        {/* Mobile header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo />
            <div className="flex items-center gap-2">
              <LocaleSwitcher />
              {me && <Avatar name={me.full_name} size="sm" />}
              <LogoutButton compact />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            <NavLinks nav={nav} orientation="horizontal" />
          </nav>
        </header>

        <main className="px-4 py-6 md:ml-64 md:px-8 md:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2.5">
            <LocaleSwitcher />
            {me && <Avatar name={me.full_name} size="sm" />}
            <LogoutButton compact />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
