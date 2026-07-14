import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
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
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        pill: "var(--radius-pill)",
      },
      fontSize: {
        h1: ["25px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        stat: ["34px", { lineHeight: "1.1" }],
        section: ["14.5px", { lineHeight: "1.4" }],
        body: ["13.5px", { lineHeight: "1.5" }],
        note: ["12px", { lineHeight: "1.45" }],
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
