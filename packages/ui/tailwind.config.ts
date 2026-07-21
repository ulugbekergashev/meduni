import type { Config } from "tailwindcss";

const sharedConfig: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-glass": "var(--surface-glass)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-faint": "var(--ink-faint)",
        line: "var(--line)",
        brand: {
          DEFAULT: "var(--brand)",
          soft: "var(--brand-soft)",
          deep: "var(--brand-deep)",
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
      fontSize: {
        h1: ["30px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        stat: ["38px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        section: ["17px", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        body: ["15px", { lineHeight: "1.55" }],
        note: ["13.5px", { lineHeight: "1.45" }],
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default sharedConfig;
