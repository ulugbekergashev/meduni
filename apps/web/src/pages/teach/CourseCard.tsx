import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Users } from "lucide-react";
import { Card, Icon } from "@meduni/ui";
import type { TeachCourse } from "./api";

export function CourseCard({ course, avgProgress }: { course: TeachCourse; avgProgress: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();

  return (
    <Card interactive onClick={() => navigate(`/teach/courses/${course.id}`)} className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[16px] font-bold leading-snug text-ink">{course.subjectName}</h3>
          <p className="mt-0.5 text-[12px] text-ink-faint">{course.academicYear}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          <Icon icon={BookOpen} size={18} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[12px]">
        <span className="rounded-pill bg-brand-soft px-2 py-0.5 font-semibold text-brand-deep">{t("semesterN", { n: course.semester })}</span>
        {course.groups.map((g) => (
          <span key={g.id} className="rounded-pill bg-bg px-2 py-0.5 text-ink-soft">{g.name}</span>
        ))}
      </div>
      <div className="mt-auto space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[12.5px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><Icon icon={Users} size={14} /> {t("studentsN", { n: course.studentCount })}</span>
          <span className="font-semibold text-ink">{avgProgress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg">
          <div className="h-full rounded-pill bg-gradient-to-r from-brand to-brand-deep transition-all" style={{ width: `${Math.max(avgProgress, 2)}%` }} />
        </div>
      </div>
    </Card>
  );
}
