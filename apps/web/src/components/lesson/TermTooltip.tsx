import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Languages } from "lucide-react";
import { Icon } from "@meduni/ui";
import type { Term } from "./digestTypes";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Matcher {
  regex: RegExp;
  byLower: Map<string, Term>;
}

/** Konspekt atamalaridan (uz + lat) matn ichida topib bo'ladigan matcher.
 *  Uzun atamalar avval (masalan "atrioventrikulyar tugun" > "tugun"). */
function buildMatcher(terms: Term[]): Matcher | null {
  const byLower = new Map<string, Term>();
  const keys: string[] = [];
  for (const t of terms) {
    for (const raw of [t.uz, t.lat]) {
      const k = (raw ?? "").trim();
      // 4+ belgi — juda qisqa/umumiy so'zlarni tooltip qilmaymiz.
      if (k.length < 4) continue;
      const low = k.toLowerCase();
      if (byLower.has(low)) continue;
      byLower.set(low, t);
      keys.push(k);
    }
  }
  if (keys.length === 0) return null;
  keys.sort((a, b) => b.length - a.length);
  // So'z chegarasi — harf/raqamga yopishmagan joyda (lotin/kirill/uz harflari).
  const alt = keys.map(escapeRe).join("|");
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(${alt})(?![\\p{L}\\p{N}])`, "giu");
  return { regex, byLower };
}

/** Bitta atama — nuqta-chiziqли, bosilganda/hover'да izoh chiqadi.
 *  Mindmap (Faza 2) barg tugunlarida ham qayta ishlatiladi. */
export function TermChip({ raw, term }: { raw: string; term: Term }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Tashqariga bosilsa yopiladi (mobil).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <span
      ref={ref}
      className="relative inline"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        className="cursor-help rounded-[3px] underline decoration-brand-tint/60 decoration-dotted underline-offset-[3px] outline-none transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
      >
        {raw}
      </span>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            role="tooltip"
            className="absolute left-1/2 top-full z-50 mt-1.5 block w-max max-w-[260px] -translate-x-1/2 whitespace-normal rounded-card border border-line bg-surface-raised px-3 py-2 text-left shadow-card"
          >
            <span className="mb-1 flex items-center gap-1.5 text-micro font-extrabold uppercase tracking-wider text-brand-tint">
              <Icon icon={Languages} size={11} />
              {t("termTooltip")}
            </span>
            {term.lat && (
              <span className="block text-note font-bold italic text-ink">{term.lat}</span>
            )}
            <span className="mt-0.5 block text-note text-ink-soft">
              <span className="font-semibold text-ink-strong">{term.uz}</span>
              {term.ru ? ` · ${term.ru}` : ""}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Matnni atamalar bilan render qiladi — topilgan atamalar tooltip oladi.
 *  Konspekt terms bo'sh bo'lsa yoki mos kelmasa — oddiy matn. */
export function TermText({ text, terms }: { text: string; terms: Term[] }) {
  const matcher = useMemo(() => buildMatcher(terms), [terms]);
  if (!matcher || !text) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  matcher.regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = matcher.regex.exec(text))) {
    const start = m.index;
    const matched = m[1];
    if (start > last) nodes.push(<Fragment key={key++}>{text.slice(last, start)}</Fragment>);
    const term = matcher.byLower.get(matched.toLowerCase());
    if (term) {
      nodes.push(<TermChip key={key++} raw={matched} term={term} />);
    } else {
      nodes.push(<Fragment key={key++}>{matched}</Fragment>);
    }
    last = start + matched.length;
    if (m.index === matcher.regex.lastIndex) matcher.regex.lastIndex++; // xavfsizlik
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <>{nodes}</>;
}
