import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronRight, Clock, Lock, PlayCircle } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { Lesson } from "../api";
import { overallPct, type StageInfo, type StageKey } from "./stages";

function Marker({ n, state }: { n: number; state: StageInfo["state"] }) {
  const base = "flex h-8 w-8 shrink-0 items-center justify-center rounded-control";
  if (state === "done")
    return (
      <div className={cls(base, "bg-emerald text-white")}>
        <Icon icon={Check} size={15} strokeWidth={3} />
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
      <div className={cls(base, "bg-surface-raised text-ink-dim")}>
        <Icon icon={Lock} size={13} />
      </div>
    );
  return (
    <div className={cls(base, "bg-surface-raised text-note font-extrabold tabular-nums text-ink-soft")}>{n}</div>
  );
}

/** Kirish landing'i (layout v2): avval bosqichlar ko'rinadi, "Boshlash /
 *  Davom ettirish" bosilgach o'quv jarayoni ochiladi. */
export function LessonOverview({
  lesson,
  stages,
  onStage,
  onResume,
}: {
  lesson: Lesson;
  stages: StageInfo[];
  onStage: (key: StageKey) => void;
  onResume: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const pct = overallPct(lesson);
  const started = pct > 0;

  /** Bosqich ostidagi haqiqiy raqamlar (dizayn: "5 bo'lim · 2/5 o'qildi"). */
  function sub(st: StageInfo): string | null {
    switch (st.key) {
      case "study": {
        const secs = lesson.sections ?? [];
        if (secs.length)
          return t("sectionsReadN", { n: secs.length, read: secs.filter((x) => x.read).length, total: secs.length });
        return null;
      }
      case "quiz": {
        const q = lesson.tabs.quiz;
        if (!q) return null;
        // Ball o'ng chetdagi katta raqamda — bu yerda takrorlanmaydi.
        return `${t("questionsN", { n: q.questionCount })} · ${t("passIsN", { n: q.passThreshold })}`;
      }
      case "case": {
        if (st.state === "pendingReview") return t("stagePending");
        if (st.state === "done" && st.hint) return `${t("finalBreakdownCase")}: ${st.hint}`;
        return t("casesN", { n: 1 });
      }
      case "result":
        return st.state === "soon" ? t("overviewResultLocked") : t("overviewResultOpen");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 py-6">
      {/* Mavzu sarlavhasi + meta */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-micro font-extrabold uppercase tracking-wider text-brand-tint">
          {t("topic")} {lesson.orderIndex} · {lesson.subjectName}
        </p>
        <h2 className="mt-1 text-h1 font-extrabold text-ink">{lesson.title}</h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-note text-ink-dim">
          {lesson.estimatedMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon icon={Clock} size={12} />
              {t("estimatedTime")}: ~{lesson.estimatedMinutes} daq
            </span>
          )}
          {started && (
            <span className="font-bold tabular-nums text-ink-soft">{t("topicProgress")}: {pct}%</span>
          )}
        </div>
      </motion.div>

      {/* Bosqichlar ro'yxati */}
      <motion.ol
        className="mt-4 overflow-hidden rounded-card border border-line"
        initial={reduce ? false : "hidden"}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        {stages.map((st, i) => {
          const clickable = st.state !== "soon";
          const subLine = sub(st);
          const Wrapper = clickable ? "button" : "div";
          return (
            <motion.li
              key={st.key}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="border-b border-line last:border-b-0"
            >
              <Wrapper
                onClick={clickable ? () => onStage(st.key) : undefined}
                className={cls(
                  "group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  clickable ? "hover:bg-surface-raised" : "cursor-default opacity-55"
                )}
              >
                <Marker n={i + 1} state={st.state} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold text-ink">{t(`stage_${st.key}`)}</p>
                  {subLine && <p className="truncate text-micro text-ink-dim">{subLine}</p>}
                </div>
                {st.key === "quiz" && st.hint && (
                  <span className="shrink-0 text-body font-extrabold tabular-nums text-ink">{st.hint}</span>
                )}
                {clickable && (
                  <Icon
                    icon={ChevronRight}
                    size={15}
                    className="shrink-0 text-ink-dim transition-transform duration-150 group-hover:translate-x-0.5"
                  />
                )}
              </Wrapper>
            </motion.li>
          );
        })}
      </motion.ol>

      {/* Bitta katta CTA */}
      <motion.button
        onClick={onResume}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        transition={{ delay: 0.15, duration: 0.25 }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-body font-extrabold text-white transition-colors hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Icon icon={PlayCircle} size={17} />
        {started ? t("overviewResume") : t("overviewStart")}
        <Icon icon={ArrowRight} size={15} />
      </motion.button>
    </div>
  );
}
