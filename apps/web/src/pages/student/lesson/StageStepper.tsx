import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Check, Clock, LayoutGrid, Lock } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { Lesson } from "../api";
import { overallPct, type LessonView, type StageInfo, type StageKey } from "./stages";

function activeStageKey(view: LessonView): StageKey | null {
  if (view === "overview") return null;
  if (view === "patient") return "patient";
  if (view === "case") return "case";
  if (view === "quiz") return "quiz";
  if (view === "result") return "result";
  return "study";
}

function Marker({ n, state, active }: { n: number; state: StageInfo["state"]; active: boolean }) {
  const reduce = useReducedMotion();
  const base =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-micro font-extrabold tabular-nums";

  const inner =
    state === "done" ? (
      <span className={cls(base, "bg-emerald text-white")}>
        <Icon icon={Check} size={11} strokeWidth={3.5} />
      </span>
    ) : state === "pendingReview" ? (
      <span className={cls(base, "bg-amber-soft text-amber")}>
        <Icon icon={Clock} size={10} />
      </span>
    ) : state === "soon" ? (
      <span className={cls(base, "bg-surface-raised text-ink-dim")}>
        <Icon icon={Lock} size={9} />
      </span>
    ) : (
      <span className={cls(base, active ? "bg-brand text-white" : "bg-surface-raised text-ink-soft")}>{n}</span>
    );

  // Holat o'zgarganda (masalan test topshirilgach ✓ tug'ilganda) mikro-pop.
  return (
    <motion.span
      key={state}
      initial={reduce ? false : { scale: 0.6 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 460, damping: 24 }}
      className="flex shrink-0"
    >
      {inner}
    </motion.span>
  );
}

/** Foiz — sakramasdan yuradigan hisoblagich. */
function PctCounter({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(pct);
  const spring = useSpring(mv, { stiffness: 90, damping: 22 });
  const rounded = useTransform(spring, (v) => Math.round(v));
  useEffect(() => {
    mv.set(pct);
  }, [pct, mv]);

  if (reduce) return <span className="text-note font-bold tabular-nums text-ink">{pct}%</span>;
  return (
    <span className="text-note font-bold tabular-nums text-ink">
      <motion.span>{rounded}</motion.span>%
    </span>
  );
}

/** Yuqori gorizontal bosqichlar bari. 2026-07-23 soddalashtirildi: har bosqich =
 *  marker + nom, xolos. Raqamli tafsilot (5/5, 67%) endi FAQAT o'z joyida —
 *  o'qilganlik chap TOC'da, test bali natija ekranida (takror signal yo'q). */
export function StageStepper({
  lesson,
  stages,
  view,
  onSelect,
  onOverview,
}: {
  lesson: Lesson;
  stages: StageInfo[];
  view: LessonView;
  onSelect: (key: StageKey) => void;
  onOverview: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const current = activeStageKey(view);
  const pct = overallPct(lesson);

  return (
    <div className="relative shrink-0 border-b border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto scrollbar-hide">
          {stages.map((st, i) => {
            const active = current === st.key;
            const clickable = st.state !== "soon";
            const done = st.state === "done";
            return (
              <div key={st.key} className="flex shrink-0 items-center">
                {/* Bosqichlararo ulagich — "trek" hissi (tugagan qism brand) */}
                {i > 0 && (
                  <span className={cls("mx-0.5 h-[2px] w-4 shrink-0 rounded-full sm:w-6", done || active ? "bg-brand/40" : "bg-line")} />
                )}
                <button
                  onClick={clickable ? () => onSelect(st.key) : undefined}
                  disabled={!clickable}
                  className={cls(
                    "relative inline-flex shrink-0 items-center gap-2 rounded-pill px-2.5 py-1.5 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    clickable && !active && "hover:bg-surface-raised",
                    !clickable && "cursor-default opacity-55",
                    active && reduce && "bg-brand-soft"
                  )}
                >
                  {/* Faol chip fondan fonga "suzib" o'tadi — bosqich almashuvi seziladi */}
                  {active && !reduce && (
                    <motion.span
                      layoutId="stage-active"
                      className="absolute inset-0 rounded-pill bg-brand-soft ring-1 ring-brand/25"
                      transition={{ type: "spring", stiffness: 500, damping: 42 }}
                    />
                  )}
                  <span className="relative z-[1] flex items-center gap-2">
                    <Marker n={i + 1} state={st.state} active={active} />
                    <span className={cls("whitespace-nowrap text-body", active ? "font-bold text-brand-tint" : "font-semibold text-ink-soft")}>
                      {t(`stage_${st.key}`)}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Mavzu jarayoni — mini halqa + agregat raqam, bosilsa obzorga qaytadi */}
        <button
          onClick={onOverview}
          title={t("backToOverview")}
          className={cls(
            "flex shrink-0 items-center gap-2 rounded-pill border border-line px-2.5 py-1 transition-colors hover:bg-surface-raised",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            view === "overview" && "border-brand/40 bg-brand-soft"
          )}
        >
          <span className="grid place-items-center">
            <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-line" />
              <circle
                cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className="text-brand transition-[stroke-dashoffset] duration-500"
                strokeDasharray={2 * Math.PI * 8}
                strokeDashoffset={2 * Math.PI * 8 * (1 - Math.max(0, Math.min(100, pct)) / 100)}
              />
            </svg>
          </span>
          <PctCounter pct={pct} />
          <Icon icon={LayoutGrid} size={13} className="text-ink-faint" />
        </button>
      </div>

      {/* Pastki nozik progress-trek — umumiy % (vizual urg'u) */}
      <div className="h-[3px] w-full bg-surface-raised">
        <div
          className="h-full rounded-r-full bg-gradient-to-r from-brand to-violet transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
