import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Clock, ListChecks, Lock } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { Panel } from "./Panel";
import type { LessonView, StageInfo, StageKey } from "./stages";

/** Faol ko'rinishga mos keluvchi bosqich. */
function activeStageKey(view: LessonView): StageKey {
  if (view === "case") return "case";
  if (view === "quiz") return "quiz";
  if (view === "result") return "result";
  return "study";
}

function Bubble({ n, state, active }: { n: number; state: StageInfo["state"]; active: boolean }) {
  const base = "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold transition-all duration-200";
  if (state === "done")
    return (
      <div className={cls(base, "bg-emerald text-white shadow-md shadow-emerald/20")}>
        <Icon icon={Check} size={16} strokeWidth={3} />
      </div>
    );
  if (state === "pendingReview")
    return (
      <div className={cls(base, "bg-amber-soft text-amber border border-amber/30")}>
        <Icon icon={Clock} size={15} />
      </div>
    );
  if (state === "soon")
    return (
      <div className={cls(base, "bg-bg text-ink-faint border border-line opacity-50")}>
        <Icon icon={Lock} size={14} />
      </div>
    );
  return (
    <div
      className={cls(
        base,
        "text-[14px] tabular-nums",
        active
          ? "bg-gradient-to-tr from-brand to-brand-deep text-white shadow-md shadow-brand/30 scale-105"
          : "bg-surface border border-line text-ink-soft"
      )}
    >
      {n}
    </div>
  );
}

export function StageRail({
  stages,
  view,
  onSelect,
}: {
  stages: StageInfo[];
  view: LessonView;
  onSelect: (key: StageKey) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const current = activeStageKey(view);

  function sub(st: StageInfo): string | null {
    if (st.key === "flashcards") return t("stageSoon");
    if (st.state === "pendingReview") return t("stagePending");
    if (st.key === "quiz" && st.hint) return `${t("bestScore")}: ${st.hint}`;
    if (st.key === "case" && st.state === "done" && st.hint) return `${t("finalBreakdownCase")}: ${st.hint}`;
    return null;
  }

  return (
    <Panel title={t("stageProgress")} icon={ListChecks} bodyClassName="p-2 space-y-1">
      <ol className="relative space-y-1.5 before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-line/60">
        {stages.map((st, i) => {
          const active = current === st.key;
          const clickable = st.key !== "flashcards" && st.state !== "soon";
          const subLine = sub(st);
          const Wrapper = clickable ? "button" : "div";
          return (
            <li key={st.key} className="relative z-10">
              <Wrapper
                onClick={clickable ? () => onSelect(st.key) : undefined}
                className={cls(
                  "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-200",
                  active && "bg-brand-soft/80 border border-brand/30 shadow-sm backdrop-blur-md",
                  clickable && !active && "hover:bg-bg/80 border border-transparent hover:border-line",
                  !clickable && "cursor-default opacity-50 border border-transparent"
                )}
              >
                <Bubble n={i + 1} state={st.state} active={active} />
                <div className="min-w-0 flex-1">
                  <p className={cls("truncate text-[14.5px] font-extrabold tracking-tight", active ? "text-brand-deep" : "text-ink")}>
                    {t(`stage_${st.key}`)}
                  </p>
                  {subLine && <p className="truncate text-[12px] font-medium text-ink-faint">{subLine}</p>}
                </div>
                {clickable && (
                  <Icon
                    icon={ChevronRight}
                    size={16}
                    className={cls("shrink-0 transition-transform", active ? "text-brand-deep translate-x-0.5" : "text-ink-faint")}
                  />
                )}
              </Wrapper>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
