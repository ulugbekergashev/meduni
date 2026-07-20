import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Search } from "lucide-react";
import { Icon } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { PeriodFilter, PeriodSection, groupByPeriod, usePeriodOptions } from "../../components/PeriodGroups";
import { useTeachCourses, useTeachDashboard, type TeachCourse } from "./api";
import { CourseCard } from "./CourseCard";

export function TeachCoursesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const list = useTeachCourses();
  const dash = useTeachDashboard();
  const courses = useMemo(() => list.data ?? [], [list.data]);
  const avg = (id: number) => dash.data?.courses.find((c) => c.id === id)?.avgProgress ?? 0;

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const options = usePeriodOptions(courses);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (year && c.academicYear !== year) return false;
      if (semester && String(c.semester) !== semester) return false;
      if (!q) return true;
      return (
        c.subjectName.toLowerCase().includes(q) ||
        c.groups.some((g) => g.name.toLowerCase().includes(q))
      );
    });
  }, [courses, search, year, semester]);

  const groups = useMemo(() => groupByPeriod<TeachCourse>(filtered), [filtered]);

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("myCourses")}</h1>
      <p className="mt-1 text-[14px] text-ink-soft">{t("coursesSubtitle")}</p>

      {/* Toolbar — kurslar ko'p bo'lganda kerakli davrni tez topish uchun */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchCourse")}
            className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[14.5px] outline-none focus:border-brand"
          />
        </div>
        <PeriodFilter
          years={options.years}
          semesters={options.semesters}
          year={year}
          semester={semester}
          onYear={setYear}
          onSemester={setSemester}
        />
        <span className="text-note font-semibold text-ink-soft">{t("totalN", { n: filtered.length })}</span>
      </div>

      <div className="mt-6">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={filtered.length === 0}
          emptyIcon={<Icon icon={BookOpen} size={22} />}
          emptyText={courses.length === 0 ? t("empty") : t("noMatch")}
          emptyHint={courses.length === 0 ? undefined : t("noMatchHint")}
          onRetry={() => list.refetch()}
        >
          {groups.map((g, i) => (
            <PeriodSection
              key={g.year}
              group={g}
              defaultOpen={i === 0 || !!year || !!semester || !!search.trim()}
              renderRows={(rows) => (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((c) => (
                    <li key={c.id}>
                      <CourseCard course={c} avgProgress={avg(c.id)} />
                    </li>
                  ))}
                </ul>
              )}
            />
          ))}
        </AsyncSection>
      </div>
    </div>
  );
}
