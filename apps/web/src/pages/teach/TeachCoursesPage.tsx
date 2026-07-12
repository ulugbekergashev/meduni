import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { Icon } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useTeachCourses, useTeachDashboard } from "./api";
import { CourseCard } from "./CourseCard";

export function TeachCoursesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const list = useTeachCourses();
  const dash = useTeachDashboard();
  const courses = list.data ?? [];
  const avg = (id: number) => dash.data?.courses.find((c) => c.id === id)?.avgProgress ?? 0;

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("myCourses")}</h1>
      <p className="mt-1 text-[13px] text-ink-soft">{t("coursesSubtitle")}</p>

      <div className="mt-6">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={courses.length === 0}
          emptyIcon={<Icon icon={BookOpen} size={22} />}
          emptyText={t("empty")}
          onRetry={() => list.refetch()}
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id}><CourseCard course={c} avgProgress={avg(c.id)} /></li>
            ))}
          </ul>
        </AsyncSection>
      </div>
    </div>
  );
}
