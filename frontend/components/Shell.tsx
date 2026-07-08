"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearTokens } from "@/lib/api";
import type { Me } from "@/lib/useAuth";
import LocaleSwitcher from "./LocaleSwitcher";

export default function Shell({
  me,
  nav,
  children,
}: {
  me?: Me;
  nav?: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-sky-700">{t("appName")}</span>
            <nav className="flex gap-4 text-sm">
              {nav?.map((item) => (
                <Link key={item.href} href={item.href} className="text-slate-600 hover:text-sky-700">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            {me && <span className="hidden text-sm text-slate-600 sm:inline">{me.full_name}</span>}
            {me && (
              <button
                onClick={() => {
                  clearTokens();
                  router.replace("/login");
                }}
                className="rounded border px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                {t("logout")}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
