import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, CalendarDays, Users } from "lucide-react";
import { Card, Icon, ProgressBar } from "@meduni/ui";
import type { TeachCourse } from "./api";

export function CourseCard({ course, avgProgress }: { course: TeachCourse; avgProgress: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();

  return (
    <Card interactive onClick={() => navigate(`/teach/courses/${course.id}`)} className="flex h-full flex-col gap-3 !p-0">
      <div className="flex items-start gap-3 border-b border-line px-4 pt-4 pb-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-deep">
          <Icon icon={BookOpen} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-body font-bold leading-snug text-ink">{course.subjectName}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-micro text-ink-faint">
            <Icon icon={CalendarDays} size={13} /> {course.academicYear} · {t("semesterN", { n: course.semester })}
          </p>
        </div>
      </div>

      {course.groups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4">
          {course.groups.slice(0, 4).map((g) => (
            <span key={g.id} className="rounded-pill bg-bg px-2 py-0.5 text-micro font-medium text-ink-soft">{g.name}</span>
          ))}
          {course.groups.length > 4 && <span className="rounded-pill bg-bg px-2 py-0.5 text-micro text-ink-faint">+{course.groups.length - 4}</span>}
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-line px-4 py-3">
        <div className="flex items-center justify-between text-micro font-medium text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><Icon icon={Users} size={14} /> {t("studentsN", { n: course.studentCount })}</span>
          <span className="text-note font-bold tabular-nums text-brand-deep">{avgProgress}%</span>
        </div>
        <ProgressBar value={avgProgress} tone={avgProgress >= 66 ? "emerald" : "brand"} />
      </div>
    </Card>
  );
}
