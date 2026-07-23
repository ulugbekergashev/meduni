import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Users, CalendarDays } from "lucide-react";
import { Icon } from "@meduni/ui";
import type { TeachCourse } from "./api";

export function CourseCard({ course, avgProgress }: { course: TeachCourse; avgProgress: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/teach/courses/${course.id}`)}
      className="group relative flex h-full w-full flex-col gap-5 overflow-hidden rounded-[24px] bg-surface p-6 text-left shadow-sm ring-1 ring-line transition-all duration-300 hover:-translate-y-1 hover:bg-surface-raised hover:shadow-md"
    >
      {/* Decorative gradient blobs */}
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-brand/10 blur-2xl transition-opacity duration-500 group-hover:bg-brand/20 group-hover:opacity-100" />
      <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl transition-opacity duration-500 group-hover:bg-violet-400/20 group-hover:opacity-100" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[18px] font-black leading-snug tracking-tight text-ink transition-colors duration-300 group-hover:text-brand-deep">
            {course.subjectName}
          </h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft">
            <Icon icon={CalendarDays} size={14} className="text-brand-tint" />
            {course.academicYear}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-brand-soft to-white text-brand shadow-inner ring-1 ring-white/60 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[10deg] group-hover:text-brand-deep">
          <Icon icon={BookOpen} size={24} />
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap gap-2 text-[13px]">
        <span className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 font-bold text-brand-deep shadow-sm ring-1 ring-brand/20">
          {t("semesterN", { n: course.semester })}
        </span>
        {course.groups.map((g) => (
          <span
            key={g.id}
            className="rounded-full bg-surface-raised px-3 py-1 font-semibold text-ink-soft shadow-sm ring-1 ring-line transition-colors group-hover:bg-surface-glass group-hover:text-ink"
          >
            {g.name}
          </span>
        ))}
      </div>

      <div className="relative z-10 mt-auto space-y-2.5 pt-4">
        <div className="flex items-center justify-between text-[13.5px] font-bold text-ink-soft transition-colors group-hover:text-ink">
          <span className="inline-flex items-center gap-1.5">
            <Icon icon={Users} size={16} className="text-brand-tint" />
            {t("studentsN", { n: course.studentCount })}
          </span>
          <span className="text-[15px] font-black tabular-nums text-brand-deep">{avgProgress}%</span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-black/5 shadow-inner">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand via-brand-tint to-violet transition-all duration-700 ease-out"
            style={{ width: `${Math.max(avgProgress, 2)}%` }}
          />
        </div>
      </div>
    </button>
  );
}
