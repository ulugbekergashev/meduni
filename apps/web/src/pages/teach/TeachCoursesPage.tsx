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
    <div className="relative z-0 min-h-[80vh] space-y-6 pb-10">
      {/* Background blobs for premium feel */}
      <div className="pointer-events-none fixed left-0 top-0 -z-10 h-full w-full overflow-hidden bg-bg">
        <div className="absolute right-[5%] top-[10%] h-[500px] w-[500px] rounded-full bg-brand/5 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[-10%] h-[400px] w-[400px] rounded-full bg-violet-400/5 blur-[120px]" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-black tracking-tight text-ink drop-shadow-sm sm:text-[40px]">{t("myCourses")}</h1>
        <p className="text-[16px] font-medium text-ink-soft">{t("coursesSubtitle")}</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-line bg-surface p-4 shadow-sm ring-1 ring-line">
        <div className="relative min-w-[240px] flex-1">
          <Icon icon={Search} size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchCourse")}
            className="w-full rounded-[16px] border-none bg-surface-raised py-3 pl-11 pr-4 text-[15px] font-semibold text-ink shadow-sm ring-1 ring-line transition-all focus:bg-surface-glass focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
        <div className="flex items-center gap-3">
          <PeriodFilter
            years={options.years}
            semesters={options.semesters}
            year={year}
            semester={semester}
            onYear={setYear}
            onSemester={setSemester}
          />
          <span className="hidden rounded-full bg-surface-raised px-4 py-2 text-[14px] font-bold text-brand-deep shadow-sm ring-1 ring-line sm:inline-block">
            {t("totalN", { n: filtered.length })}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={filtered.length === 0}
          emptyIcon={<Icon icon={BookOpen} size={28} className="text-brand-soft" />}
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
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
