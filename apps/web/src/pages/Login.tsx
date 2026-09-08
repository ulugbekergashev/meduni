import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AtSign, BookOpen, ClipboardCheck, Lock, LogIn, Stethoscope } from "lucide-react";

import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { roleHome, useLogin } from "../lib/auth";
import { ApiError } from "../lib/api";
import { useLocale } from "../lib/useLocale";

/**
 * Kirish sahifasi (2026-09 «Sokin panel» redizayni).
 *
 * ⚠️ Ilgari bu sahifa ilovaning QOLGAN qismidan butunlay boshqa tilda
 * gapirardi: qora texno-fon, uchta cheksiz "pulsatsiya" qiladigan gradient
 * dog', `font-black` va — eng jiddiysi — o'ng paneldagi butun matn
 * INGLIZCHA edi ("Academic Excellence Platform", "Next-Gen Portal"),
 * holbuki ilova uz/ru da ishlaydi. Foydalanuvchi bir dizayndan kirib,
 * butunlay boshqasiga tushardi.
 *
 * Endi: o'sha tokenlar, o'sha shrift, mavzuga ergashadi. O'ng panel —
 * platforma nima qilishini ayting, reklama shiori emas. Loop-animatsiya
 * yo'q (§4 Motion qoidasi).
 */
const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
};

const FEATURES = [
  { icon: BookOpen, key: "featContent" },
  { icon: Stethoscope, key: "featPractice" },
  { icon: ClipboardCheck, key: "featControl" },
] as const;

export function Login() {
  const { t } = useTranslation(undefined, { keyPrefix: "login" });
  const navigate = useNavigate();
  const login = useLogin();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ⚠️ Har qanday xatoni "parol noto'g'ri" deb ko'rsatish MUMKIN EMAS: server
  // uxlab qolgan yoki deploy ketayotgan bo'lsa foydalanuvchi parolini qidirib
  // ovora bo'ladi. 401 — haqiqatan noto'g'ri ma'lumot; qolgani — server xabari.
  const errorText = (() => {
    const err = login.error;
    if (!err) return null;
    if (err instanceof ApiError && err.status !== 401) {
      return locale === "ru" ? err.messageRu : err.messageUz;
    }
    return t("error");
  })();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: (me) => navigate(roleHome[me.role] ?? "/", { replace: true }) }
    );
  };

  const field =
    "h-10 w-full rounded-control border border-line-raised bg-surface-raised pl-9 pr-3 text-note text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ───────────────── Chap: forma ───────────────── */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-[520px] lg:px-16">
        <motion.div
          variants={stagger}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="mx-auto w-full max-w-[340px]"
        >
          <motion.div variants={item} className="mb-9 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand text-body font-bold text-white">
                M
              </span>
              <span className="text-section font-bold tracking-tight text-ink">MedUni AI</span>
            </div>
            <LocaleSwitcher />
          </motion.div>

          <motion.div variants={item} className="mb-7">
            <h1 className="text-h1 font-bold leading-tight text-ink">{t("subtitle")}</h1>
            <p className="mt-1.5 text-note text-ink-soft">{t("hint")}</p>
          </motion.div>

          <motion.form variants={item} onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-micro text-ink-soft">
                {t("email")}
              </label>
              <div className="relative">
                <AtSign
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@meduni.uz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={field}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-micro text-ink-soft">
                {t("password")}
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={field}
                />
              </div>
            </div>

            {login.isError && (
              <p
                role="alert"
                className="rounded-control border border-rose-line bg-rose-soft px-3 py-2.5 text-micro font-bold text-rose"
              >
                {errorText}
              </p>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-control bg-brand text-note font-bold text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-60"
            >
              {login.isPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <LogIn size={16} />
              )}
              {t("submit")}
            </button>
          </motion.form>
        </motion.div>
      </div>

      {/* ───────────────── O'ng: brend paneli ─────────────────
          Bitta tekis brend yuzasi. Gradient dog'lar va cheksiz pulsatsiya
          yo'q — ular ekranda eng ko'p harakat qiladigan, lekin hech narsa
          aytmaydigan qism edi. */}
      <div className="hidden flex-1 items-center justify-center bg-brand px-12 lg:flex">
        <div className="max-w-md">
          <h2 className="text-h1 font-bold leading-tight text-white">{t("panelTitle")}</h2>
          <p className="mt-3 text-body leading-relaxed text-white/80">{t("panelBody")}</p>

          <ul className="mt-8 flex flex-col gap-4">
            {FEATURES.map(({ icon: Ico, key }) => (
              <li key={key} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-white/15 text-white">
                  <Ico size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-note font-bold text-white">{t(`${key}Title`)}</p>
                  <p className="mt-0.5 text-micro text-white/70">{t(`${key}Body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
