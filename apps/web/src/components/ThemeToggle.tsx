import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { getTheme, setTheme, type Theme } from "../lib/theme";

/** Light / Dark segmented switch. Theme lives in <html data-theme>; no React state
 *  is needed elsewhere — the CSS variables flip and every token-based color follows. */
export function ThemeToggle() {
  const { t } = useTranslation(undefined, { keyPrefix: "theme" });
  const [theme, setLocal] = useState<Theme>(getTheme());

  const pick = (v: Theme) => {
    setTheme(v);
    setLocal(v);
  };

  const opts: { value: Theme; icon: typeof Sun }[] = [
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
  ];

  return (
    <div>
      <p className="mb-1.5 text-[13.5px] font-semibold text-ink-soft">{t("label")}</p>
      <div className="flex overflow-hidden rounded-control border border-line">
        {opts.map(({ value, icon }) => (
          <button
            key={value}
            onClick={() => pick(value)}
            className={cls(
              "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[14.5px] font-semibold transition-colors",
              theme === value ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg"
            )}
          >
            <Icon icon={icon} size={15} /> {t(value)}
          </button>
        ))}
      </div>
    </div>
  );
}
