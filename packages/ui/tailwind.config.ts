import type { Config } from "tailwindcss";

const sharedConfig: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          raised: "rgb(var(--surface-raised-rgb) / <alpha-value>)",
        },
        "surface-glass": "var(--surface-glass)",
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          strong: "rgb(var(--ink-strong-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-soft-rgb) / <alpha-value>)",
          faint: "rgb(var(--ink-faint-rgb) / <alpha-value>)",
          dim: "rgb(var(--ink-dim-rgb) / <alpha-value>)",
        },
        "ink-soft": "rgb(var(--ink-soft-rgb) / <alpha-value>)",
        "ink-faint": "rgb(var(--ink-faint-rgb) / <alpha-value>)",
        line: {
          DEFAULT: "rgb(var(--line-rgb) / <alpha-value>)",
          raised: "rgb(var(--line-raised-rgb) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--brand-rgb) / <alpha-value>)",
          soft: "rgb(var(--brand-soft-rgb) / <alpha-value>)",
          deep: "rgb(var(--brand-deep-rgb) / <alpha-value>)",
          tint: "rgb(var(--brand-tint-rgb) / <alpha-value>)",
        },
        blue: { DEFAULT: "rgb(var(--blue-rgb) / <alpha-value>)", soft: "rgb(var(--blue-soft-rgb) / <alpha-value>)" },
        violet: { DEFAULT: "rgb(var(--violet-rgb) / <alpha-value>)", soft: "rgb(var(--violet-soft-rgb) / <alpha-value>)" },
        amber: { DEFAULT: "rgb(var(--amber-rgb) / <alpha-value>)", soft: "rgb(var(--amber-soft-rgb) / <alpha-value>)" },
        rose: { DEFAULT: "rgb(var(--rose-rgb) / <alpha-value>)", soft: "rgb(var(--rose-soft-rgb) / <alpha-value>)" },
        emerald: { DEFAULT: "rgb(var(--emerald-rgb) / <alpha-value>)", soft: "rgb(var(--emerald-soft-rgb) / <alpha-value>)" },
        side: {
          DEFAULT: "rgb(var(--side-bg-rgb) / <alpha-value>)",
          deep: "rgb(var(--side-bg-deep-rgb) / <alpha-value>)",
          ink: "rgb(var(--side-ink-rgb) / <alpha-value>)",
          soft: "rgb(var(--side-ink-soft-rgb) / <alpha-value>)",
          line: "rgb(var(--side-line-rgb) / <alpha-value>)",
          active: "rgb(var(--side-active-bg-rgb) / <alpha-value>)",
          "active-ink": "rgb(var(--side-active-ink-rgb) / <alpha-value>)",
          hover: "rgb(var(--side-hover-bg-rgb) / <alpha-value>)",
        },
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
      // Shkala 2026-07-23 v3 — KATTA SAKRASH (buyurtmachi 3-marta "yozuvlar
      // kichkina" dedi). Katta ekranlarda o'qishbop bo'lishi uchun ochiq
      // shkala. micro=13px — MUTLAQ minimum; text-[N] arbitrary TAQIQ.
      fontSize: {
        /** 2026-08-03 (buyurtmachi: "juda kattalashib ketmaganmi? kichiraytir,
         *  ozroqqa, juda kichiraytirma") — v3 shkalasidan BIR pog'ona pastga.
         *  ⚠️ `micro` 13px TEGILMAYDI: §4 bo'yicha mutlaq minimum. */
        h1: ["26px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        stat: ["34px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        section: ["18px", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        body: ["16px", { lineHeight: "1.6" }],
        note: ["14px", { lineHeight: "1.55" }],
        micro: ["13px", { lineHeight: "1.45" }],
        /** Uzun matn o'qish uchun (konspekt tanasi) — A−/A+ bilan boshqariladi. */
        read: ["18px", { lineHeight: "1.8" }],
      },
      fontFamily: {
        sans: ["'Manrope Variable'", "Manrope", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default sharedConfig;
