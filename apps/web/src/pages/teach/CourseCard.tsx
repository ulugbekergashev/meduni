import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Users } from "lucide-react";
import { Card, Icon } from "@meduni/ui";
import type { TeachCourse } from "./api";

export function CourseCard({ course, avgProgress }: { course: TeachCourse; avgProgress: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();

  return (
    <Card interactive onClick={() => navigate(`/teach/courses/${course.id}`)} className="group flex h-full flex-col gap-4 !p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card-hover border border-line hover:border-brand/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[17px] font-extrabold leading-snug text-ink transition-colors duration-300 group-hover:text-brand-tint">{course.subjectName}</h3>
          <p className="mt-1 text-[13.5px] font-medium text-ink-soft">{course.academicYear}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft/70 text-brand-deep shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
          <Icon icon={BookOpen} size={22} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[13px]">
        <span className="rounded-full bg-brand-soft px-3 py-1 font-bold text-brand-tint shadow-sm">{t("semesterN", { n: course.semester })}</span>
        {course.groups.map((g) => (
          <span key={g.id} className="rounded-full bg-surface-raised border border-line px-3 py-1 font-semibold text-ink-soft shadow-sm">{g.name}</span>
        ))}
      </div>
      <div className="mt-auto space-y-2 pt-2">
        <div className="flex items-center justify-between text-[13.5px] font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><Icon icon={Users} size={15} /> {t("studentsN", { n: course.studentCount })}</span>
          <span className="text-ink">{avgProgress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-line shadow-inner">
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-violet transition-all duration-500 ease-out" style={{ width: `${Math.max(avgProgress, 2)}%` }} />
        </div>
      </div>
    </Card>
  );
}
