"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconLogo } from "@/components/Icons";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Button, Field, Input } from "@/components/ui";
import { api, setTokens } from "@/lib/api";
import { homeFor, type Me } from "@/lib/useAuth";

export default function LoginPage() {
  const t = useTranslations("login");
  const tc = useTranslations("common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tokens = await api<{ access_token: string; refresh_token: string }>(
        "/auth/login",
        { method: "POST", body: { email, password } },
      );
      setTokens(tokens.access_token, tokens.refresh_token);
      const me = await api<Me>("/auth/me");
      router.replace(homeFor(me.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Брендовая панель (desktop) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 p-10 text-white lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <IconLogo className="text-3xl text-teal-300" />
          <span className="text-xl font-bold tracking-tight">
            {tc("appName")}
            <span className="text-teal-300">.</span>
          </span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-snug">{t("tagline")}</h2>
          <p className="mt-3 text-teal-100/80">{t("taglineHint")}</p>
        </div>
        <p className="relative text-xs text-teal-100/50">© {new Date().getFullYear()} MedUni AI</p>
      </div>

      {/* Форма */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between lg:justify-end">
            <span className="flex items-center gap-2 lg:hidden">
              <IconLogo className="text-2xl text-teal-600" />
              <span className="text-lg font-bold">{tc("appName")}</span>
            </span>
            <LocaleSwitcher />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("title")}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">{t("subtitle")}</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label={t("email")}>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="name@meduni.uz"
              />
            </Field>
            <Field label={t("password")}>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Field>
            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
            <Button type="submit" disabled={busy} className="w-full justify-center py-2.5">
              {busy ? tc("loading") : t("submit")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
