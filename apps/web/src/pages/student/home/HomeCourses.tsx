import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cls } from "@meduni/ui";
import { BentoCard } from "../../../components/bento";
import type { CourseSummary } from "../api";

/** Bir qatorda ko'rinadigan kurslar — qolgani "Barchasi" ortida. */
const MAX_COURSES = 4;

/** Ustunlar kurslar soniga teng — 2 kursda yarim karta bo'sh qolmasin.
 *  Statik yozilgan: Tailwind JIT dinamik klass nomini ko'rmaydi. */
const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** Joriy semestr kurslari — har biri nomi, progress va mavzular soni bilan. */
export function HomeCourses({ courses }: { courses: CourseSummary[] }) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const navigate = useNavigate();
  const shown = courses.slice(0, MAX_COURSES);

  return (
    <BentoCard
      title={t("coursesTitle")}
      meta={t("currentSemester")}
      action={{
        label: courses.length > MAX_COURSES ? t("allCoursesN", { count: courses.length }) : t("allTasks"),
        onClick: () => navigate("/app/courses"),
      }}
      bodyClassName="px-2 pb-2"
    >
      <div className={cls("grid grid-cols-2 gap-1", COLS[shown.length])}>
        {shown.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => navigate(`/app/courses/${c.id}`)}
            className="min-w-0 rounded-control p-2.5 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span className="block truncate text-note font-semibold text-ink-2">{c.subjectName}</span>
            <span className="mt-1 block text-stat font-semibold tabular-nums text-ink">{c.progressPct}%</span>
            <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-pill bg-line">
              {c.progressPct > 0 && (
                <span className="block h-full rounded-pill bg-brand" style={{ width: `${c.progressPct}%` }} />
              )}
            </span>
            <span className="mt-1.5 block truncate text-micro text-ink-soft">
              {t("topicsOfCourse", { done: c.topicsCompleted, total: c.topicsTotal })}
            </span>
          </button>
        ))}
      </div>
    </BentoCard>
  );
}
