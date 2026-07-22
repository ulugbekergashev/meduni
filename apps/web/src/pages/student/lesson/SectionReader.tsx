import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clock, FileText, Info, Minus, Plus, TriangleAlert } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { DigestBlock, LessonSection } from "../api";

/** O'qish shrifti — A−/A+ bilan boshqariladi, tanlov localStorage'da qoladi. */
const READ_SIZES = [13, 14, 15, 16, 17];
const SIZE_KEY = "meduni.readSize";

function useReadSize() {
  const [idx, setIdx] = useState(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(SIZE_KEY) : null;
    const n = raw ? Number(raw) : 1;
    return Number.isInteger(n) && n >= 0 && n < READ_SIZES.length ? n : 1;
  });
  const set = (next: number) => {
    const clamped = Math.max(0, Math.min(READ_SIZES.length - 1, next));
    setIdx(clamped);
    try {
      window.localStorage.setItem(SIZE_KEY, String(clamped));
    } catch {}
  };
  return { px: READ_SIZES[idx], idx, dec: () => set(idx - 1), inc: () => set(idx + 1), min: idx === 0, max: idx === READ_SIZES.length - 1 };
}

// ---------- Blok renderlari ----------

function Block({ block }: { block: DigestBlock }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });

  if (block.type === "para") {
    return <p className="text-ink-strong">{block.text}</p>;
  }

  if (block.type === "callout") {
    const warn = block.tone === "warning";
    return (
      <div
        className={cls(
          "flex gap-2.5 rounded-control border-l-2 px-3.5 py-3",
          warn ? "border-amber bg-amber-soft" : "border-brand bg-brand-soft"
        )}
      >
        <Icon
          icon={warn ? TriangleAlert : Info}
          size={15}
          className={cls("mt-0.5 shrink-0", warn ? "text-amber" : "text-brand-tint")}
        />
        <div className="min-w-0">
          <p className={cls("mb-0.5 text-micro font-extrabold uppercase tracking-wider", warn ? "text-amber" : "text-brand-tint")}>
            {warn ? t("calloutWarning") : t("calloutImportant")}
          </p>
          <p className="text-ink-strong">{block.text}</p>
        </div>
      </div>
    );
  }

  // list
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag className="space-y-2">
      {block.items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            className={cls(
              "mt-[7px] shrink-0",
              block.ordered
                ? "mt-0 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-raised text-micro font-extrabold tabular-nums text-ink-soft"
                : "h-1.5 w-1.5 rounded-full bg-brand"
            )}
          >
            {block.ordered ? i + 1 : null}
          </span>
          <span className="min-w-0 text-ink-strong">
            {it.lead && <strong className="font-extrabold text-ink">{it.lead}</strong>}
            {it.lead ? " — " : ""}
            {it.text}
          </span>
        </li>
      ))}
    </Tag>
  );
}

// ---------- Reader ----------

export function SectionReader({
  sections,
  active,
  onActive,
  onMarkRead,
  onFinished,
  finishedLabel,
}: {
  sections: LessonSection[];
  active: number;
  onActive: (index: number) => void;
  /** Bo'lim o'qildi deb belgilash (aniq harakat: "Keyingi bo'lim"). */
  onMarkRead: (index: number) => void;
  /** Oxirgi bo'lim yakunlangach — keyingi bosqichga o'tish (layout v2). */
  onFinished?: () => void;
  /** Oxirgi bo'lim tugmasi matni ("Keyingi bosqich: Test" kabi). */
  finishedLabel?: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const size = useReadSize();

  const idx = Math.max(0, Math.min(sections.length - 1, active));
  const section = sections[idx];
  const readCount = sections.filter((s) => s.read).length;

  // Faol bo'limga skroll (pill bosilganda ko'rinib turishi uchun).
  useEffect(() => {
    document.getElementById(`sec-pill-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [idx]);

  if (!section) return null;

  const last = idx === sections.length - 1;
  const goNext = () => {
    onMarkRead(idx);
    if (!last) onActive(idx + 1);
    else onFinished?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Bo'lim navigatsiyasi + o'qish shrifti */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-hide">
          {sections.map((s) => (
            <button
              key={s.index}
              id={`sec-pill-${s.index}`}
              onClick={() => onActive(s.index)}
              className={cls(
                "inline-flex shrink-0 items-center gap-1.5 rounded-control px-2.5 py-1 text-note font-bold transition-colors",
                s.index === idx ? "bg-brand-soft text-brand-tint" : "text-ink-faint hover:bg-surface-raised hover:text-ink-soft"
              )}
            >
              {s.read && <Icon icon={Check} size={12} className="text-emerald" strokeWidth={3} />}
              <span className="tabular-nums">{s.index + 1}.</span>
              <span className="max-w-[150px] truncate">{s.title}</span>
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-control border border-line">
          <button
            onClick={size.dec}
            disabled={size.min}
            aria-label={t("readSmaller")}
            className="flex h-6 w-6 items-center justify-center rounded-l-control text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
          >
            <Icon icon={Minus} size={12} />
          </button>
          <span className="px-0.5 text-micro font-extrabold text-ink-faint">A</span>
          <button
            onClick={size.inc}
            disabled={size.max}
            aria-label={t("readBigger")}
            className="flex h-6 w-6 items-center justify-center rounded-r-control text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
          >
            <Icon icon={Plus} size={12} />
          </button>
        </div>
      </div>

      {/* O'qish maydoni — editorial zichlik (bo'shliq padding bilan) */}
      <div className="min-h-0 flex-1 lg:overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.article
            key={idx}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-[68ch] px-6 py-7 sm:px-9"
          >
            {/* Bo'lim shapkasi */}
            <div className="mb-4">
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-micro font-extrabold uppercase tracking-wider text-brand-tint">
                  {t("sectionOf", { n: idx + 1, total: sections.length })}
                </span>
                <span className="inline-flex items-center gap-1 text-micro font-bold text-ink-dim">
                  <Icon icon={Clock} size={11} />
                  {t("minutesN", { n: section.minutes })}
                </span>
                {section.read && (
                  <span className="inline-flex items-center gap-1 text-micro font-bold text-emerald">
                    <Icon icon={Check} size={11} strokeWidth={3} />
                    {t("sectionRead")}
                  </span>
                )}
              </div>
              <h2 className="text-[20px] font-extrabold leading-tight tracking-tight text-ink">{section.title}</h2>
              {section.sourceRef && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-control bg-surface-raised px-2 py-1 text-micro font-bold text-ink-faint">
                  <Icon icon={FileText} size={11} />
                  {t("sourceRef")}: {section.sourceRef}
                </p>
              )}
            </div>

            {/* Bloklar — ketma-ket paydo bo'ladi */}
            <motion.div
              className="space-y-4 leading-[1.75]"
              style={{ fontSize: `${size.px}px` }}
              initial={reduce ? false : "hidden"}
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
              {section.blocks.map((b, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Block block={b} />
                </motion.div>
              ))}
            </motion.div>
          </motion.article>
        </AnimatePresence>
      </div>

      {/* Pastki amal bari */}
      <div className="flex shrink-0 items-center gap-3 border-t border-line px-3 py-2">
        <span className="text-micro font-bold tabular-nums text-ink-faint">
          {t("readCount", { n: readCount, total: sections.length })}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => onActive(idx - 1)}
            disabled={idx === 0}
            className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-note font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Icon icon={ArrowLeft} size={14} />
            {t("prevSection")}
          </button>
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand px-3.5 py-1.5 text-note font-bold text-white transition-colors hover:bg-brand-deep"
          >
            {last ? (finishedLabel ?? t("finishReading")) : t("nextSection")}
            <Icon icon={ArrowRight} size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
