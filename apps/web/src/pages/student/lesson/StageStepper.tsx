import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Clock, Lock } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { Lesson } from "../api";
import { overallPct, type LessonView, type StageInfo, type StageKey } from "./stages";

function activeStageKey(view: LessonView): StageKey | null {
  if (view === "overview") return null;
  if (view === "case") return "case";
  if (view === "quiz") return "quiz";
  if (view === "result") return "result";
  return "study";
}

function Marker({ n, state, active }: { n: number; state: StageInfo["state"]; active: boolean }) {
  const base = "flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-micro font-extrabold tabular-nums";
  if (state === "done")
    return (
      <span className={cls(base, "bg-emerald text-white")}>
        <Icon icon={Check} size={11} strokeWidth={3.5} />
      </span>
    );
  if (state === "pendingReview")
    return (
      <span className={cls(base, "bg-amber-soft text-amber")}>
        <Icon icon={Clock} size={10} />
      </span>
    );
  if (state === "soon")
    return (
      <span className={cls(base, "bg-surface-raised text-ink-dim")}>
        <Icon icon={Lock} size={9} />
      </span>
    );
  return <span className={cls(base, active ? "bg-brand text-white" : "bg-surface-raised text-ink-soft")}>{n}</span>;
}

/** Yuqori gorizontal bosqichlar bari (layout v2 — foydalanuvchi: "bosqichlar
 *  tepada bo'lsin"). Bitta ingichka qator; mobil'da gorizontal skroll. */
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
  const current = activeStageKey(view);
  const pct = overallPct(lesson);

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-hide">
        {stages.map((st, i) => {
          const active = current === st.key;
          const clickable = st.state !== "soon";
          return (
            <div key={st.key} className="flex shrink-0 items-center">
              {i > 0 && <Icon icon={ChevronRight} size={12} className="mx-0.5 shrink-0 text-ink-dim" />}
              <button
                onClick={clickable ? () => onSelect(st.key) : undefined}
                disabled={!clickable}
                className={cls(
                  "inline-flex items-center gap-1.5 rounded-control px-2 py-1 transition-colors",
                  active && "bg-brand-soft",
                  clickable && !active && "hover:bg-surface-raised",
                  !clickable && "cursor-default opacity-55"
                )}
              >
                <Marker n={i + 1} state={st.state} active={active} />
                <span className={cls("text-note font-extrabold", active ? "text-brand-tint" : "text-ink-soft")}>
                  {t(`stage_${st.key}`)}
                </span>
                {st.hint && <span className="text-micro font-bold tabular-nums text-ink-dim">{st.hint}</span>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Mavzu jarayoni — bosilsa obzorga qaytadi */}
      <button
        onClick={onOverview}
        title={t("backToOverview")}
        className={cls(
          "flex shrink-0 items-center gap-2 rounded-control px-2 py-1 transition-colors hover:bg-surface-raised",
          view === "overview" && "bg-brand-soft"
        )}
      >
        <div className="h-1.5 w-[90px] overflow-hidden rounded-pill bg-line">
          <div className="h-full rounded-pill bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-note font-extrabold tabular-nums text-ink">{pct}%</span>
      </button>
    </div>
  );
}
