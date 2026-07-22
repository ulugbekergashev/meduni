import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Keyboard } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { LessonSection } from "../api";
import { BlockView } from "./BlockView";

/** 1b — qadam-kartochkalar: bo'lim bloklari bittalab ko'rsatiladi.
 *  Ma'lumot 1a bilan bir xil (yangi backend kerak emas): 1 blok = 1 qadam. */
export function StepCards({
  section,
  step,
  onStep,
  onSectionDone,
  fontPx,
}: {
  section: LessonSection;
  step: number;
  onStep: (n: number) => void;
  /** Oxirgi qadamdan keyin — bo'limni yopib, keyingisiga o'tish. */
  onSectionDone: () => void;
  fontPx: number;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();

  const total = section.blocks.length;
  const idx = Math.max(0, Math.min(total - 1, step));
  const block = section.blocks[idx];
  const isLast = idx === total - 1;

  const prev = () => onStep(idx - 1);
  const next = () => (isLast ? onSectionDone() : onStep(idx + 1));

  // Klaviatura: ← / → . Matn kiritilayotganda aralashmaydi.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, total, isLast]);

  if (!block) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Kartochka */}
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-4 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${section.index}-${idx}`}
            initial={reduce ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[62ch] rounded-card border border-line bg-surface-raised p-5 sm:p-6"
          >
            <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-micro font-extrabold uppercase tracking-wider text-brand-tint">
                {section.title}
              </span>
              <span className="text-micro font-extrabold tabular-nums text-ink-dim">
                {t("stepOf", { n: idx + 1, total })}
              </span>
            </div>

            <div className="leading-[1.75]" style={{ fontSize: `${fontPx}px` }}>
              <BlockView block={block} />
            </div>

            {/* Qadam indikatorlari */}
            <div className="mt-5 flex gap-1">
              {section.blocks.map((_, i) => (
                <button
                  key={i}
                  onClick={() => onStep(i)}
                  aria-label={`${i + 1}`}
                  className={cls(
                    "h-1 flex-1 rounded-pill transition-colors",
                    i < idx ? "bg-emerald" : i === idx ? "bg-brand" : "bg-line"
                  )}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pastki bar — navigatsiya + klaviatura maslahati */}
      <div className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2">
        <span className="hidden items-center gap-1.5 text-micro text-ink-dim sm:inline-flex">
          <Icon icon={Keyboard} size={12} />
          {t("keyboardHint")}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={prev}
            disabled={idx === 0}
            className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-note font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Icon icon={ArrowLeft} size={14} />
            {t("prevStep")}
          </button>
          <button
            onClick={next}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand px-3.5 py-1.5 text-note font-bold text-white transition-colors hover:bg-brand-deep"
          >
            {isLast ? (
              <>
                <Icon icon={Check} size={14} strokeWidth={3} />
                {t("sectionFinish")}
              </>
            ) : (
              <>
                {t("nextStep")}
                <Icon icon={ArrowRight} size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
