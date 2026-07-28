import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { AtSign, Lock, LogIn, Sparkles } from "lucide-react";

import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { roleHome, useLogin } from "../lib/auth";
import { ApiError } from "../lib/api";
import { useLocale } from "../lib/useLocale";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 280, damping: 22 } },
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function Login() {
  const { t } = useTranslation(undefined, { keyPrefix: "login" });
  const navigate = useNavigate();
  const login = useLogin();
  const locale = useLocale();
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

  return (
    <div className="flex min-h-screen bg-[#0c0f1a]">
      {/* ─── Left Form Side ─── */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-[480px] xl:w-[560px] lg:px-16 relative z-10">
        {/* Subtle left-panel ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -bottom-20 -left-20 h-[320px] w-[320px] rounded-full bg-brand-soft blur-[100px]" />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mx-auto w-full max-w-sm relative"
        >
          {/* Logo + locale */}
          <motion.div variants={item} className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-gradient-to-br from-brand to-blue text-white font-black text-xl shadow-lg shadow-brand/30">
                M
              </div>
              <span className="text-[17px] font-black tracking-tight text-white">MedUni</span>
            </div>
            <LocaleSwitcher />
          </motion.div>

          {/* Headline */}
          <motion.div variants={item} className="mb-9">
            <h1 className="text-[32px] font-black text-white tracking-tight mb-2 leading-tight">
              {t("title")}
            </h1>
            <p className="text-[15px] text-white/50 leading-relaxed">{t("subtitle")}</p>
          </motion.div>

          {/* Form */}
          <motion.form variants={item} onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-white/60 uppercase tracking-wider pl-0.5">
                {t("email")}
              </label>
              <div className="relative">
                <AtSign size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  placeholder="name@meduni.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 w-full rounded-[12px] border border-white/10 bg-white/5 pl-10 pr-4 text-[15px] text-white placeholder:text-white/25 outline-none transition-all focus:border-brand/60 focus:bg-white/8 focus:ring-2 focus:ring-brand/20 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-white/60 uppercase tracking-wider pl-0.5">
                {t("password")}
              </label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 w-full rounded-[12px] border border-white/10 bg-white/5 pl-10 pr-4 text-[15px] text-white placeholder:text-white/25 outline-none transition-all focus:border-brand/60 focus:bg-white/8 focus:ring-2 focus:ring-brand/20 shadow-inner"
                />
              </div>
            </div>

            {login.isError && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[10px] border border-rose/30 bg-rose-soft px-4 py-3 text-[14px] font-semibold text-rose"
              >
                {errorText}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="mt-1 flex py-4 w-full items-center justify-center gap-2.5 rounded-[12px] bg-gradient-to-r from-brand to-blue text-[16px] font-black text-white shadow-lg shadow-brand/30 transition-all hover:shadow-xl hover:shadow-brand/40 hover:-translate-y-[1px] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              {login.isPending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <LogIn size={18} />
              )}
              {t("submit")}
            </button>
          </motion.form>
        </motion.div>
      </div>

      {/* ─── Right Visual Side ─── */}
      <div className="hidden flex-1 relative lg:flex items-center justify-center overflow-hidden">
        {/* Animated ambient blobs */}
        <div className="absolute inset-0">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-15%] left-[-10%] h-[65%] w-[65%] rounded-full bg-brand blur-[140px]"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[-20%] right-[-10%] h-[60%] w-[55%] rounded-full bg-blue blur-[120px]"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
            className="absolute top-[40%] right-[20%] h-[30%] w-[30%] rounded-full bg-violet blur-[100px]"
          />
        </div>

        {/* Glass card overlay */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="show"
          className="relative z-10 max-w-md px-12"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-bold text-white/80 shadow-sm">
            <Sparkles size={14} className="text-brand-soft" />
            Academic Excellence Platform
          </div>
          <h2 className="text-[44px] font-black tracking-tight text-white leading-[1.1] mb-5">
            MedUni<br />
            <span className="bg-gradient-to-r from-brand-soft to-blue bg-clip-text text-transparent">
              Next-Gen Portal
            </span>
          </h2>
          <p className="text-white/50 text-[16px] leading-relaxed mb-3">
            Welcome to the unified platform for students, teachers, and faculty administrators. Your entire academic journey, elevated.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {["Grades & Analytics", "Live Schedule", "Course Hub", "AI-Powered"].map((f) => (
              <span key={f} className="rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5 text-[13px] font-semibold text-white/60">
                {f}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
