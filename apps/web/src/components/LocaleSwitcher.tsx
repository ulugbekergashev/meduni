import { useTranslation } from "react-i18next";
import { cls } from "@meduni/ui";
import { setLocale, type Locale } from "../lib/i18n";

export function LocaleSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language as Locale;

  return (
    <div className="inline-flex rounded-pill border border-line bg-surface p-0.5 text-[13.5px] font-semibold">
      {(["uz", "ru"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={cls(
            "rounded-pill px-3 py-1 transition-colors",
            current === l ? "bg-brand-soft text-brand-deep" : "text-ink-soft"
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
