import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, AtSign, BookOpen, ClipboardCheck, FileText, GraduationCap, Lock, LogIn, Sparkles, Stethoscope, UserCheck } from "lucide-react";

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

// Dizayn v3: har imkoniyat — o'z pastel kartochkasi (bento), tekis brend
// paneli o'rniga. Ton ma'noli: kontent=violet, amaliyot=amber, nazorat=emerald.
/** Platformaning ishlash oqimi — hero ichida (panelBody aytgan zanjir). */
const FLOW = [
  { icon: FileText, key: "flowMaterial" },
  { icon: Sparkles, key: "flowAi" },
  { icon: UserCheck, key: "flowTeacher" },
  { icon: GraduationCap, key: "flowStudent" },
] as const;

const FEATURES = [
  { icon: BookOpen, key: "featContent", tone: "bg-violet-soft", chip: "bg-surface/70 text-violet" },
  { icon: Stethoscope, key: "featPractice", tone: "bg-amber-soft", chip: "bg-surface/70 text-amber" },
  { icon: ClipboardCheck, key: "featControl", tone: "bg-emerald-soft", chip: "bg-surface/70 text-emerald" },
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
              <span className="flex h-9 w-9 items-center justify-center rounded-control bg-ink text-body font-semibold text-surface">
                M
              </span>
              <span className="text-section font-semibold tracking-tight text-ink">MedUni AI</span>
            </div>
            <LocaleSwitcher />
          </motion.div>

          <motion.div variants={item} className="mb-7">
            <h1 className="text-h1 font-semibold leading-tight text-ink">{t("subtitle")}</h1>
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
              className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-ink text-note font-semibold text-surface transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-60"
            >
              {login.isPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface/40 border-t-surface" />
              ) : (
                <LogIn size={16} />
              )}
              {t("submit")}
            </button>
          </motion.form>
        </motion.div>
      </div>

      {/* ───────────────── O'ng: bento paneli ─────────────────
          Dizayn v3 «Pastel bento»: ilova ichidagi kabi bloklar — bitta
          brand-soft hero va uchta pastel imkoniyat kartasi. Animatsiya
          faqat kirishda (stagger), loop yo'q. */}
      <div className="hidden flex-1 justify-center p-3 lg:flex">
        <motion.div
          variants={stagger}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="grid w-full max-w-5xl grid-cols-3 content-center gap-3 self-center"
        >
          <motion.div variants={item} className="col-span-3 flex min-h-80 flex-col justify-between gap-10 rounded-card bg-brand-soft p-10">
            <ol className="flex flex-wrap items-center gap-2">
              {FLOW.map(({ icon: Ico, key }, i) => (
                <li key={key} className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-pill bg-surface/80 py-1.5 pl-1.5 pr-3.5 text-note font-semibold text-ink">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-surface">
                      <Ico size={14} />
                    </span>
                    {t(key)}
                  </span>
                  {i < FLOW.length - 1 && <ArrowRight size={16} className="text-brand-deep" aria-hidden />}
                </li>
              ))}
            </ol>
            <div>
            <h2 className="max-w-xl text-h1 font-semibold leading-tight text-ink">{t("panelTitle")}</h2>
            <p className="mt-3 max-w-xl text-body leading-relaxed text-ink-2">{t("panelBody")}</p>
            </div>
          </motion.div>
          {FEATURES.map(({ icon: Ico, key, tone, chip }) => (
            <motion.div key={key} variants={item} className={`flex min-h-44 flex-col rounded-card p-5 ${tone}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${chip}`}>
                <Ico size={18} />
              </span>
              <p className="mt-auto pt-6 text-body font-semibold text-ink">{t(`${key}Title`)}</p>
              <p className="mt-1 text-note text-ink-2">{t(`${key}Body`)}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
