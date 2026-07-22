import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Clock, ListChecks, Lock } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { Lesson } from "../api";
import { Panel } from "./Panel";
import { overallPct, type LessonView, type StageInfo, type StageKey } from "./stages";

/** Faol ko'rinishga mos keluvchi bosqich. */
function activeStageKey(view: LessonView): StageKey {
  if (view === "case") return "case";
  if (view === "quiz") return "quiz";
  if (view === "result") return "result";
  return "study";
}

function Bubble({ n, state, active }: { n: number; state: StageInfo["state"]; active: boolean }) {
  const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-control";
  if (state === "done")
    return (
      <div className={cls(base, "bg-emerald text-white")}>
        <Icon icon={Check} size={14} strokeWidth={3} />
      </div>
    );
  if (state === "pendingReview")
    return (
      <div className={cls(base, "bg-amber-soft text-amber")}>
        <Icon icon={Clock} size={13} />
      </div>
    );
  if (state === "soon")
    return (
      <div className={cls(base, "bg-surface-raised text-ink-dim")}>
        <Icon icon={Lock} size={12} />
      </div>
    );
  return (
    <div
      className={cls(
        base,
        "text-note font-extrabold tabular-nums",
        active ? "bg-brand text-white" : "bg-surface-raised text-ink-soft"
      )}
    >
      {n}
    </div>
  );
}

export function StageRail({
  lesson,
  stages,
  view,
  onSelect,
}: {
  lesson: Lesson;
  stages: StageInfo[];
  view: LessonView;
  onSelect: (key: StageKey) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const current = activeStageKey(view);
  const pct = overallPct(lesson);

  /** Bosqich ostidagi haqiqiy raqamlar (dizayn: "6 bo'lim · 2/6 o'qildi"). */
  function sub(st: StageInfo): string | null {
    switch (st.key) {
      case "study": {
        const secs = lesson.sections ?? [];
        if (secs.length) {
          return t("sectionsReadN", {
            n: secs.length,
            read: secs.filter((x) => x.read).length,
            total: secs.length,
          });
        }
        return null;
      }
      case "quiz": {
        const q = lesson.tabs.quiz;
        if (!q) return null;
        if (st.hint) return `${t("bestScore")}: ${st.hint}`;
        return `${t("questionsN", { n: q.questionCount })} · ${t("passIsN", { n: q.passThreshold })}`;
      }
      case "case": {
        if (st.state === "pendingReview") return t("stagePending");
        if (st.state === "done" && st.hint) return `${t("finalBreakdownCase")}: ${st.hint}`;
        return t("casesN", { n: 1 });
      }
      case "flashcards":
        return t("stageSoon");
      case "result":
        return st.state === "soon" ? t("stageSoon") : null;
    }
  }

  return (
    <Panel
      title={t("stageProgress")}
      icon={ListChecks}
      bodyClassName="flex flex-col p-2"
    >
      {/* Umumiy jarayon — segmentli (dizayn: 4 segment) */}
      <div className="mb-2 rounded-control bg-surface-raised px-2.5 py-2">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-micro font-extrabold uppercase tracking-wider text-ink-dim">{t("topicProgress")}</span>
          <span className="text-note font-extrabold tabular-nums text-ink">{pct}%</span>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => {
            const seg = Math.max(0, Math.min(100, pct - i * 25)) / 25;
            return (
              <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-pill bg-line">
                <div
                  className="h-full rounded-pill bg-brand transition-[width] duration-500"
                  style={{ width: `${seg * 100}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bosqichlar */}
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
                  "flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors",
                  // Chuqurlik FAQAT shu yerda — faol qatorda, juda vazmin.
                  active && "bg-brand-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                  clickable && !active && "hover:bg-surface-raised",
                  !clickable && "cursor-default opacity-55"
                )}
              >
                <Bubble n={i + 1} state={st.state} active={active} />
                <div className="min-w-0 flex-1">
                  <p className={cls("truncate text-note font-extrabold", active ? "text-brand-tint" : "text-ink")}>
                    {t(`stage_${st.key}`)}
                  </p>
                  {subLine && <p className="truncate text-micro text-ink-dim">{subLine}</p>}
                </div>
                {clickable && <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-dim" />}
              </Wrapper>
            </li>
          );
        })}
      </ol>

      {/* Taxminiy vaqt */}
      {lesson.estimatedMinutes > 0 && (
        <div className="mt-auto flex items-center gap-1.5 border-t border-line px-2 pt-2 text-micro text-ink-dim">
          <Icon icon={Clock} size={11} />
          {t("estimatedTime")}: <span className="font-bold tabular-nums text-ink-soft">~{lesson.estimatedMinutes} daq</span>
        </div>
      )}
    </Panel>
  );
}
