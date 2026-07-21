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
  const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full";
  if (state === "done")
    return (
      <div className={cls(base, "bg-emerald text-white")}>
        <Icon icon={Check} size={14} strokeWidth={3} />
      </div>
    );
  if (state === "pendingReview")
    return (
      <div className={cls(base, "bg-amber-soft text-amber")}>
        <Icon icon={Clock} size={14} />
      </div>
    );
  if (state === "soon")
    return (
      <div className={cls(base, "bg-bg text-ink-faint")}>
        <Icon icon={Lock} size={13} />
      </div>
    );
  return (
    <div className={cls(base, "text-[13px] font-bold tabular-nums", active ? "bg-brand text-white" : "bg-bg text-ink-soft")}>
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
    <Panel title={t("stageProgress")} icon={ListChecks} bodyClassName="p-1.5">
      <ol className="space-y-0.5">
        {stages.map((st, i) => {
          const active = current === st.key;
          const clickable = st.key !== "flashcards" && st.state !== "soon";
          const subLine = sub(st);
          const Wrapper = clickable ? "button" : "div";
          return (
            <li key={st.key}>
              <Wrapper
                onClick={clickable ? () => onSelect(st.key) : undefined}
                className={cls(
                  "flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition-colors",
                  active && "bg-brand-soft",
                  clickable && !active && "hover:bg-bg",
                  !clickable && "cursor-default opacity-60"
                )}
              >
                <Bubble n={i + 1} state={st.state} active={active} />
                <div className="min-w-0 flex-1">
                  <p className={cls("truncate text-note font-bold", active ? "text-brand-deep" : "text-ink")}>
                    {t(`stage_${st.key}`)}
                  </p>
                  {subLine && <p className="truncate text-[12px] text-ink-faint">{subLine}</p>}
                </div>
                {clickable && <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-faint" />}
              </Wrapper>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
