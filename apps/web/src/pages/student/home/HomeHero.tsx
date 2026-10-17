import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, PlayCircle } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { CourseSummary, Resume } from "../api";

/** Segmentli chiziq juda ko'p mavzuda o'qilmay qoladi — undan keyin yaxlit chiziq. */
const MAX_SEGMENTS = 24;

/** Mavzular chizig'i: har mavzu bitta segment — tugaganlar to'q, joriysi yarim. */
function TopicTrack({ done, total }: { done: number; total: number }) {
  if (total <= 0) return null;
  if (total > MAX_SEGMENTS) {
    const pct = Math.round((done / total) * 100);
    return (
      <span className="block h-1.5 w-full overflow-hidden rounded-pill bg-ink/10">
        <span className="block h-full rounded-pill bg-ink" style={{ width: `${pct}%` }} />
      </span>
    );
  }
  return (
    <span className="flex w-full gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cls(
            "h-1.5 flex-1 rounded-pill",
            i < done ? "bg-ink" : i === done ? "bg-ink/40" : "bg-ink/10"
          )}
        />
      ))}
    </span>
  );
}

const darkPill =
  "inline-flex h-10 items-center gap-2 rounded-pill bg-ink px-4 text-note font-semibold text-surface transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

/**
 * Bosh sahifaning yagona yoritilgan yuzasi — "qayerda to'xtadim".
 * Mavzu yo'q bo'lsa (hammasi tugagan) umumiy progress va kurslarga yo'l.
 */
export function HomeHero({
  resume,
  course,
  overallPct,
}: {
  resume: Resume | null;
  course: CourseSummary | undefined;
  overallPct: number;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const navigate = useNavigate();

  const done = course?.topicsCompleted ?? 0;
  const total = course?.topicsTotal ?? 0;
  const pct = resume ? resume.pct : overallPct;

  return (
    <section className="flex h-full flex-col gap-4 rounded-card bg-brand-soft p-5 sm:flex-row sm:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="inline-flex max-w-full items-center gap-1.5 self-start truncate rounded-pill bg-surface/70 px-2.5 py-1 text-micro font-semibold text-brand-deep">
          <Icon icon={resume ? PlayCircle : BookOpen} size={13} />
          {resume ? `${t("continueLabel")} · ${resume.subjectName}` : t("overall")}
        </span>
        <h2 className="mt-3 truncate text-h1 font-semibold text-ink">
          {resume ? resume.topic : t("allDone")}
        </h2>
        {resume && total > 0 && (
          <p className="mt-1 truncate text-note text-ink-2">
            {t("topicsOfCourse", { done, total })}
          </p>
        )}
        <div className="mt-auto pt-4">
          {resume && total > 0 && (
            <div className="mb-4 max-w-md">
              <TopicTrack done={done} total={total} />
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate(resume ? `/app/topics/${resume.topicId}` : "/app/courses")}
            className={darkPill}
          >
            {resume ? t("continue") : t("goToCourses")}
            <Icon icon={ArrowRight} size={16} />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-row items-end justify-between gap-2 border-t border-ink/10 pt-3 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0 sm:text-right">
        <p className="text-display font-semibold tabular-nums text-ink">{pct}%</p>
        <p className="text-micro text-ink-2">{resume ? t("topicDone") : t("overallProgress")}</p>
      </div>
    </section>
  );
}
