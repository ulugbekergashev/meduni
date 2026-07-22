import type { Config } from "tailwindcss";

const sharedConfig: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
        },
        "surface-glass": "var(--surface-glass)",
        ink: {
          DEFAULT: "var(--ink)",
          strong: "var(--ink-strong)",
          soft: "var(--ink-soft)",
          faint: "var(--ink-faint)",
          dim: "var(--ink-dim)",
        },
        "ink-soft": "var(--ink-soft)",
        "ink-faint": "var(--ink-faint)",
        line: {
          DEFAULT: "var(--line)",
          raised: "var(--line-raised)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          soft: "var(--brand-soft)",
          deep: "var(--brand-deep)",
          tint: "var(--brand-tint)",
        },
        blue: { DEFAULT: "var(--blue)", soft: "var(--blue-soft)" },
        violet: { DEFAULT: "var(--violet)", soft: "var(--violet-soft)" },
        amber: { DEFAULT: "var(--amber)", soft: "var(--amber-soft)" },
        rose: { DEFAULT: "var(--rose)", soft: "var(--rose-soft)" },
        emerald: { DEFAULT: "var(--emerald)", soft: "var(--emerald-soft)" },
        side: {
          DEFAULT: "var(--side-bg)",
          deep: "var(--side-bg-deep)",
          ink: "var(--side-ink)",
          soft: "var(--side-ink-soft)",
          line: "var(--side-line)",
          active: "var(--side-active-bg)",
          "active-ink": "var(--side-active-ink)",
          hover: "var(--side-hover-bg)",
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
      // Shkala 2026-07-23: bir pog'ona ko'tarildi (buyurtmachi: "sal textini
      // kattalashtir"). micro=11.5px — MUTLAQ minimum; text-[10px] kabi
      // arbitrary qiymatlar TAQIQ (dostupnost poli).
      fontSize: {
        h1: ["22px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        stat: ["34px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        section: ["16px", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        body: ["14px", { lineHeight: "1.55" }],
        note: ["12.5px", { lineHeight: "1.45" }],
        micro: ["11.5px", { lineHeight: "1.35" }],
        /** Uzun matn o'qish uchun (konspekt tanasi) — A−/A+ bilan boshqariladi. */
        read: ["16px", { lineHeight: "1.75" }],
      },
      fontFamily: {
        sans: ["'Manrope Variable'", "Manrope", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default sharedConfig;
