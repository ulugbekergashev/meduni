import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { EmptyState, Icon, cls } from "@meduni/ui";
import { BentoCard } from "../../../components/bento";
import type { TeachCourse } from "../api";

/** Bir qatorda ko'rinadigan kurslar — qolgani "Barchasi" ortida. */
const MAX_COURSES = 4;

/** Ustunlar kurslar soniga teng — statik (Tailwind JIT dinamik klassni ko'rmaydi). */
const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** Mening kurslarim — navigatsiya yorlig'i: nom, o'rtacha progress, talabalar. */
export function HomeCoursesCard({
  courses,
  progressOf,
  isLoading,
  isError,
  onRetry,
}: {
  courses: TeachCourse[];
  progressOf: (id: number) => number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();
  const shown = courses.slice(0, MAX_COURSES);

  return (
    <BentoCard
      title={t("myCourses")}
      count={courses.length}
      action={{ label: t("seeAll"), onClick: () => navigate("/teach/courses") }}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      bodyClassName="px-2 pb-2"
    >
      {shown.length === 0 ? (
        <div className="flex items-center justify-center px-2 py-4">
          <EmptyState icon={<Icon icon={BookOpen} size={20} />} text={t("empty")} />
        </div>
      ) : (
        <div className={cls("grid grid-cols-2 gap-1", COLS[shown.length])}>
          {shown.map((c) => {
            const pct = progressOf(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/teach/courses/${c.id}`)}
                className="min-w-0 rounded-control p-2.5 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="block truncate text-note font-semibold text-ink-2">{c.subjectName}</span>
                <span className="mt-1 block text-stat font-semibold tabular-nums text-ink">{pct}%</span>
                <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-pill bg-line">
                  {pct > 0 && <span className="block h-full rounded-pill bg-brand" style={{ width: `${pct}%` }} />}
                </span>
                <span className="mt-1.5 block truncate text-micro text-ink-soft">
                  {t("studentsN", { n: c.studentCount })} · {c.groups.map((g) => g.name).join(", ") || t("semesterN", { n: c.semester })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </BentoCard>
  );
}
