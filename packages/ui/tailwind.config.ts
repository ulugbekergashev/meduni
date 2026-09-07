import type { Config } from "tailwindcss";

/**
 * MEDUNI dizayn tizimi — «Sokin panel» (2026-09 redizayn).
 * Reja: `.claude/plans/redizayn-sokin-panel-2026-09.md`. Qiymatlar
 * `packages/ui/src/tokens.css` dan keladi, bu yerda faqat xarita.
 */
const sharedConfig: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          /** Chap rey va yuqori panel. */
          2: "rgb(var(--surface-2-rgb) / <alpha-value>)",
          /** Kartochka ICHIDAGI maydon, input, jadval shapkasi. */
          raised: "rgb(var(--surface-raised-rgb) / <alpha-value>)",
        },
        "surface-glass": "var(--surface-glass)",
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          strong: "rgb(var(--ink-strong-rgb) / <alpha-value>)",
          /** Jadval qiymati, ikkilamchi matn. */
          2: "rgb(var(--ink-2-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-soft-rgb) / <alpha-value>)",
          faint: "rgb(var(--ink-faint-rgb) / <alpha-value>)",
          dim: "rgb(var(--ink-dim-rgb) / <alpha-value>)",
        },
        "ink-soft": "rgb(var(--ink-soft-rgb) / <alpha-value>)",
        "ink-faint": "rgb(var(--ink-faint-rgb) / <alpha-value>)",
        line: {
          DEFAULT: "rgb(var(--line-rgb) / <alpha-value>)",
          /** Tugma va input chegarasi (kuchliroq). */
          raised: "rgb(var(--line-raised-rgb) / <alpha-value>)",
          /** Jadval/ro'yxat qatorlari orasi (mayinroq). */
          soft: "rgb(var(--line-soft-rgb) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--brand-rgb) / <alpha-value>)",
          hover: "rgb(var(--brand-hover-rgb) / <alpha-value>)",
          soft: "rgb(var(--brand-soft-rgb) / <alpha-value>)",
          deep: "rgb(var(--brand-deep-rgb) / <alpha-value>)",
          tint: "rgb(var(--brand-tint-rgb) / <alpha-value>)",
        },
        blue: { DEFAULT: "rgb(var(--blue-rgb) / <alpha-value>)", soft: "rgb(var(--blue-soft-rgb) / <alpha-value>)" },
        violet: { DEFAULT: "rgb(var(--violet-rgb) / <alpha-value>)", soft: "rgb(var(--violet-soft-rgb) / <alpha-value>)" },
        amber: { DEFAULT: "rgb(var(--amber-rgb) / <alpha-value>)", soft: "rgb(var(--amber-soft-rgb) / <alpha-value>)" },
        rose: {
          DEFAULT: "rgb(var(--rose-rgb) / <alpha-value>)",
          soft: "rgb(var(--rose-soft-rgb) / <alpha-value>)",
          /** Xato kartochkasining chegarasi. */
          line: "rgb(var(--rose-line-rgb) / <alpha-value>)",
          /** Xato foni USTIDAGI izoh matni. */
          muted: "rgb(var(--rose-muted-rgb) / <alpha-value>)",
        },
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
        /** Kartochkada soya YO'Q — `none`ga bog'langan (tokens.css'ga qarang). */
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        /** Sahifadan uzilgan yuzalar. */
        modal: "var(--shadow-modal)",
        pop: "var(--shadow-pop)",
      },
      /**
       * SHRIFT SHKALASI — «Sokin panel» (2026-09).
       * Referens 11–13px da ishlaydi, bizda esa §4 bo'yicha 13px mutlaq minimum
       * edi (buyurtmachi 3 marta "kichkina" degan). Oraliq tanlandi: referensdan
       * bir pog'ona katta, eski shkalamizdan ikki pog'ona kichik.
       * ⚠️ `text-[N]` arbitrary qiymatlar TAQIQ — token ishlat.
       */
      fontSize: {
        h1: ["26px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        stat: ["28px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        section: ["16px", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        body: ["14px", { lineHeight: "1.55" }],
        note: ["13px", { lineHeight: "1.5" }],
        micro: ["12px", { lineHeight: "1.45" }],
        /** Uzun matn o'qish uchun (konspekt tanasi) — A−/A+ bilan boshqariladi. */
        read: ["17px", { lineHeight: "1.8" }],
      },
      /**
       * OG'IRLIK SHKALASI — referens usuli (UI_UPGRADE_PLAN 1.2).
       * Ilovada `font-extrabold` 131 joyda, `font-black` 10 joyda ishlatilgan —
       * natijada ekrandagi hamma narsa bir xil baland ovozda "qichqirar" va
       * ierarxiya yo'qolar edi. Har faylga tegmasdan SHKALANING O'ZI
       * pasaytirildi: yozuvlar o'z o'rnida qoladi, lekin ko'z bir joyga tikiladi.
       */
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "500",
        bold: "600",
        extrabold: "600",
        black: "700",
      },
      fontFamily: {
        sans: [
          "'Sora Variable'",
          "Sora",
          // Sora'da kirill harflari yo'q — ruscha matn to'liq Inter'da chiqadi
          // (brauzer har harfni alohida tanlaydi, hech narsa buzilmaydi).
          "'Inter Variable'",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        /** Raqam ustunlari, telefon, vaqt, sana. `.num` klassi ham shundan. */
        data: [
          "'JetBrains Mono Variable'",
          "'JetBrains Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      spacing: {
        header: "var(--header-h)",
        rail: "var(--rail-w)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default sharedConfig;
