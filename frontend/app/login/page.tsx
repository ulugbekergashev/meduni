"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api, setTokens } from "@/lib/api";
import { homeFor, type Me } from "@/lib/useAuth";
import LocaleSwitcher from "@/components/LocaleSwitcher";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-sky-700">{tc("appName")}</h1>
          <LocaleSwitcher />
        </div>
        <h2 className="mb-4 text-lg font-semibold">{t("title")}</h2>
        <label className="mb-3 block text-sm">
          {t("email")}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="username"
          />
        </label>
        <label className="mb-4 block text-sm">
          {t("password")}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-sky-600 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy ? tc("loading") : t("submit")}
        </button>
      </form>
    </div>
  );
}
