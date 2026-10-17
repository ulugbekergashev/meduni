import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Icon } from "@meduni/ui";
import type { TeachCourse } from "./api";

/**
 * Kurs kartochkasi (Dizayn v3 «Pastel bento»): oq, radius 16, soyasiz.
 *
 * ⚠️ Har nisbat chizig'i tagida u NIMANING ulushi ekani yozilishi shart —
 * izohsiz chiziq hech narsa anglatmaydi.
 */
export function CourseCard({ course, avgProgress }: { course: TeachCourse; avgProgress: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/teach/courses/${course.id}`)}
      className="group flex h-full w-full min-w-0 flex-col rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-tint">
          <Icon icon={BookOpen} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-section font-semibold leading-snug text-ink">{course.subjectName}</span>
          <span className="mt-0.5 block font-data text-micro text-ink-soft">
            {course.academicYear} · {t("semesterN", { n: course.semester })}
          </span>
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface">
          <Icon icon={ArrowUpRight} size={13} />
        </span>
      </span>

      {course.groups.length > 0 && (
        <span className="mt-3 flex flex-wrap gap-1.5">
          {course.groups.slice(0, 4).map((g) => (
            <span key={g.id} className="rounded-pill bg-surface-raised px-2 py-0.5 text-micro font-semibold text-ink-2">
              {g.name}
            </span>
          ))}
          {course.groups.length > 4 && (
            <span className="rounded-pill bg-surface-raised px-2 py-0.5 text-micro text-ink-soft">+{course.groups.length - 4}</span>
          )}
        </span>
      )}

      <span className="mt-auto block pt-4">
        <span className="flex items-end justify-between gap-2">
          <span className="text-stat font-semibold tabular-nums text-ink">{avgProgress}%</span>
          <span className="truncate pb-1 text-micro text-ink-soft">{t("studentsN", { n: course.studentCount })}</span>
        </span>
        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-pill bg-line">
          {avgProgress > 0 && <span className="block h-full rounded-pill bg-brand" style={{ width: `${avgProgress}%` }} />}
        </span>
        <span className="mt-1.5 block truncate text-micro text-ink-soft">{t("statAvgProgress")}</span>
      </span>
    </button>
  );
}
