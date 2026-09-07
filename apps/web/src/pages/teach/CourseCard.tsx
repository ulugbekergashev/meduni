import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { Card, Icon, Num, ProgressBar } from "@meduni/ui";
import type { TeachCourse } from "./api";

/**
 * Kurs kartochkasi (2026-09 «Sokin panel»).
 *
 * ⚠️ Har nisbat chizig'i tagida u NIMANING ulushi ekani yozilishi shart —
 * izohsiz chiziq hech narsa anglatmaydi (referens qoidasi). Ilgari faqat
 * "64%" turardi va nimaning 64% ekani ma'lum emas edi.
 */
export function CourseCard({ course, avgProgress }: { course: TeachCourse; avgProgress: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();

  return (
    <Card interactive onClick={() => navigate(`/teach/courses/${course.id}`)} className="flex h-full flex-col !p-0">
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-raised text-ink-soft">
          <Icon icon={BookOpen} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-section font-bold leading-snug text-ink">{course.subjectName}</h3>
          <Num className="mt-0.5 block text-micro text-ink-faint">
            {course.academicYear} · {t("semesterN", { n: course.semester })}
          </Num>
        </div>
      </div>

      {course.groups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-1">
          {course.groups.slice(0, 4).map((g) => (
            <span key={g.id} className="rounded-pill bg-surface-raised px-2 py-0.5 text-micro text-ink-soft">
              {g.name}
            </span>
          ))}
          {course.groups.length > 4 && (
            <span className="rounded-pill bg-surface-raised px-2 py-0.5 text-micro text-ink-faint">
              +{course.groups.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-micro text-ink-soft">{t("statAvgProgress")}</span>
          <Num className="shrink-0 text-micro font-bold text-ink">{avgProgress}%</Num>
        </div>
        <div className="mt-2">
          <ProgressBar value={avgProgress} tone={avgProgress >= 66 ? "emerald" : "brand"} />
        </div>
        <span className="mt-1.5 block truncate text-micro text-ink-faint">
          {t("studentsN", { n: course.studentCount })}
        </span>
      </div>
    </Card>
  );
}
