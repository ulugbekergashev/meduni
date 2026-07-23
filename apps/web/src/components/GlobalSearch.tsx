import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon, Spinner, cls } from "@meduni/ui";

export interface SearchItem {
  key: string;
  label: string;
  sub?: string | null;
  link: string;
}

export interface SearchSection {
  key: string; // i18n key under search.sections.*
  icon: LucideIcon;
  items: SearchItem[];
}

/**
 * Global top-bar search. The shell supplies `fetch(q)` (role-scoped endpoint +
 * result mapping); this component owns debounce, dropdown, and keyboard UX
 * (Ctrl+K focuses, Esc closes, click navigates).
 */
export function GlobalSearch({ fetch }: { fetch: (q: string) => Promise<SearchSection[]> }) {
  const { t } = useTranslation(undefined, { keyPrefix: "search" });
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sections, setSections] = useState<SearchSection[]>([]);

  // Ctrl+K / Cmd+K focuses the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close when clicking outside.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced fetch.
  useEffect(() => {
    if (!q.trim()) {
      setSections([]);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    const id = setTimeout(() => {
      fetch(q)
        .then((s) => setSections(s))
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const go = (link: string) => {
    setOpen(false);
    setQ("");
    navigate(link);
  };

  const hasResults = sections.some((s) => s.items.length > 0);
  const showDropdown = open && q.trim().length > 0;

  return (
    <div ref={boxRef} className="relative max-w-md w-full sm:w-[320px] lg:w-[400px]">
      <div className="group flex items-center gap-2 rounded-full border border-line bg-surface-raised px-4 shadow-sm ring-1 ring-black/5 transition-all focus-within:ring-2 focus-within:ring-brand/30 hover:bg-surface-glass">
        <Icon icon={Search} size={18} className="shrink-0 text-ink-faint transition-colors group-focus-within:text-brand" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("placeholder")}
          className="h-10 w-full bg-transparent text-[14.5px] font-medium text-ink outline-none placeholder:text-ink-faint"
        />
        <kbd className="hidden shrink-0 rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-bold tracking-wider text-ink-faint shadow-sm sm:block">
          Ctrl K
        </kbd>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-[20px] border border-line bg-surface/90 p-2 shadow-[0_10px_40px_rgb(0,0,0,0.1)] backdrop-blur-2xl ring-1 ring-black/5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-5 text-note text-ink-soft">
              <Spinner size={15} /> {t("searching")}
            </div>
          ) : error ? (
            <p className="py-5 text-center text-note text-rose">{t("error")}</p>
          ) : !hasResults ? (
            <p className="py-5 text-center text-note text-ink-faint">{t("empty")}</p>
          ) : (
            sections.map(
              (section) =>
                section.items.length > 0 && (
                  <div key={section.key} className="mb-1 last:mb-0">
                    <p className="px-2.5 pb-1 pt-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
                      {t(`sections.${section.key}`)}
                    </p>
                    {section.items.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => go(item.link)}
                        className={cls(
                          "group/item flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-all hover:bg-surface-raised hover:pl-4"
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-ink-soft transition-colors group-hover/item:bg-brand-soft group-hover/item:text-brand-deep">
                          <Icon icon={section.icon} size={14} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-body font-medium text-ink">{item.label}</span>
                          {item.sub && <span className="block truncate text-[12.5px] text-ink-faint">{item.sub}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )
            )
          )}
        </div>
      )}
    </div>
  );
}
