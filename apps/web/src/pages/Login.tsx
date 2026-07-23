import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { AtSign, Lock, LogIn, Sparkles } from "lucide-react";

import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { roleHome, useLogin } from "../lib/auth";
import { apiErrorMessage } from "../lib/api";
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
  const locale = useLocale();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: (me) => navigate(roleHome[me.role] ?? "/", { replace: true }) }
    );
  };

  return (
    <div className="flex min-h-screen bg-bg relative overflow-hidden">
      {/* ─── Animated Ambient Blobs (Light Mode) ─── */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-5%] h-[60%] w-[50%] rounded-full bg-brand blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.2, 0.15] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-15%] right-[-5%] h-[55%] w-[45%] rounded-full bg-blue blur-[100px]"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute top-[30%] right-[15%] h-[40%] w-[40%] rounded-full bg-violet blur-[110px]"
        />
      </div>

      {/* ─── Left Form Side ─── */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-[480px] xl:w-[560px] lg:px-16 relative z-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mx-auto w-full max-w-sm relative"
        >
          {/* Logo + locale */}
          <motion.div variants={item} className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-gradient-to-br from-brand to-brand-tint text-white font-black text-xl shadow-[0_4px_12px_rgba(79,70,229,0.3)]">
                M
              </div>
              <span className="text-[17px] font-black tracking-tight text-ink">MedUni</span>
            </div>
            <LocaleSwitcher />
          </motion.div>

          {/* Headline */}
          <motion.div variants={item} className="mb-9">
            <h1 className="text-[32px] font-black text-ink tracking-tight mb-2 leading-tight">
              {t("title")}
            </h1>
            <p className="text-[15px] text-ink-soft leading-relaxed font-medium">{t("subtitle")}</p>
          </motion.div>

          {/* Form with Glassmorphism */}
          <motion.form 
            variants={item} 
            onSubmit={onSubmit} 
            className="flex flex-col gap-5 p-6 rounded-[24px] bg-surface-glass backdrop-blur-xl border border-white shadow-card"
          >
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-ink-soft uppercase tracking-wider pl-0.5">
                {t("email")}
              </label>
              <div className="relative">
                <AtSign size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="email"
                  placeholder="name@meduni.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 w-full rounded-[14px] border border-line bg-surface pl-10 pr-4 text-[15px] font-medium text-ink placeholder:text-ink-faint outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-ink-soft uppercase tracking-wider pl-0.5">
                {t("password")}
              </label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 w-full rounded-[14px] border border-line bg-surface pl-10 pr-4 text-[15px] font-medium text-ink placeholder:text-ink-faint outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10 shadow-inner"
                />
              </div>
            </div>

            {login.isError && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[10px] border border-rose/30 bg-rose-soft px-4 py-3 text-[14px] font-semibold text-rose"
              >
                {apiErrorMessage(login.error, locale) || t("error")}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="mt-2 flex h-13 w-full items-center justify-center gap-2.5 rounded-[14px] bg-gradient-to-r from-brand to-brand-tint text-[16px] font-black text-white shadow-[0_4px_14px_-2px_rgba(79,70,229,0.4)] transition-all hover:shadow-[0_6px_20px_-2px_rgba(79,70,229,0.5)] hover:-translate-y-[1px] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
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
      <div className="hidden flex-1 relative lg:flex items-center justify-center overflow-hidden z-10">
        {/* Glass card overlay */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="show"
          className="relative max-w-md px-12"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-4 py-2 text-[13px] font-bold text-brand shadow-sm">
            <Sparkles size={14} className="text-brand" />
            Academic Excellence Platform
          </div>
          <h2 className="text-[48px] font-black tracking-tight text-ink leading-[1.1] mb-5">
            MedUni<br />
            <span className="bg-gradient-to-r from-brand to-blue bg-clip-text text-transparent">
              Next-Gen Portal
            </span>
          </h2>
          <p className="text-ink-soft font-medium text-[17px] leading-relaxed mb-5">
            Welcome to the unified platform for students, teachers, and faculty administrators. Your entire academic journey, beautifully elevated.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2.5">
            {["Grades & Analytics", "Live Schedule", "Course Hub", "AI-Powered"].map((f) => (
              <span key={f} className="rounded-full border border-line bg-surface/60 backdrop-blur-sm px-4 py-2 text-[13.5px] font-bold text-ink-soft shadow-sm hover:text-ink transition-colors cursor-default">
                {f}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
