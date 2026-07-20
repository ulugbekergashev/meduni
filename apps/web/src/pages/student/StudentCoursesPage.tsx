import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, CheckCircle2, PlayCircle, Search, UserRound, Users } from "lucide-react";
import { Card, Icon, ProgressBar, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { PeriodFilter, PeriodSection, groupByPeriod, usePeriodOptions } from "../../components/PeriodGroups";
import { useMyCourses, type CourseSummary } from "./api";

function CourseCard({ course }: { course: CourseSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentCourses" });
  const { t: tp } = useTranslation(undefined, { keyPrefix: "period" });
  const navigate = useNavigate();
  const done = course.topicsTotal > 0 && course.topicsCompleted === course.topicsTotal;

  return (
    <Card
      interactive
      onClick={() => navigate(`/app/courses/${course.id}`)}
      className="flex h-full flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-section font-bold leading-snug text-ink">{course.subjectName}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-note text-ink-faint">
            <Icon icon={UserRound} size={13} /> {course.teacherName}
          </p>
        </div>
        <div
          className={cls(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            done ? "bg-emerald-soft text-emerald" : "bg-brand-soft text-brand-deep"
          )}
        >
          <Icon icon={done ? CheckCircle2 : BookOpen} size={18} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[13px]">
        <span className="rounded-pill bg-brand-soft px-2 py-0.5 font-semibold text-brand-deep">
          {tp("semester", { n: course.semester })}
        </span>
        <span className="rounded-pill bg-bg px-2 py-0.5 text-ink-soft">{course.academicYear}</span>
        {course.groupName && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-bg px-2 py-0.5 text-ink-soft">
            <Icon icon={Users} size={12} /> {course.groupName}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <ProgressBar value={course.progressPct} tone={done ? "emerald" : "brand"} />
        <div className="flex items-center justify-between text-[13px] text-ink-soft">
          <span className="font-semibold text-ink">{course.progressPct}%</span>
          <span>
            {course.topicsCompleted}/{course.topicsTotal} {t("topics")}
          </span>
        </div>
      </div>

      <div className="mt-auto pt-1">
        {course.nextTopicId ? (
          <>
            <p className="mb-2 truncate text-note text-ink-soft">
              <span className="text-ink-faint">{t("nextTopic")}: </span>
              {course.nextTopic}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/app/topics/${course.nextTopicId}`);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-control bg-brand px-3 py-2 text-body font-bold text-white transition-all hover:bg-brand-deep"
            >
              <Icon icon={PlayCircle} size={16} />
              {t("continue")}
            </button>
          </>
        ) : (
          <p className="rounded-control bg-emerald-soft px-3 py-2 text-center text-note font-semibold text-emerald">
            {done ? t("allDone") : t("noOpenTopic")}
          </p>
        )}
      </div>
    </Card>
  );
}

/** "Kurslarim" — talabaning asosiy moduli: barcha kurslar davrlar bo'yicha. */
export function StudentCoursesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "studentCourses" });
  const q = useMyCourses();
  const courses = useMemo(() => q.data ?? [], [q.data]);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const options = usePeriodOptions(courses);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (year && c.academicYear !== year) return false;
      if (semester && String(c.semester) !== semester) return false;
      if (!needle) return true;
      return (
        c.subjectName.toLowerCase().includes(needle) ||
        c.teacherName.toLowerCase().includes(needle)
      );
    });
  }, [courses, search, year, semester]);

  const groups = useMemo(() => groupByPeriod(filtered), [filtered]);
  const filtering = !!search.trim() || !!year || !!semester;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-body text-ink-soft">{t("subtitle")}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
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
          isLoading={q.isLoading}
          isError={q.isError}
          isEmpty={filtered.length === 0}
          emptyIcon={<Icon icon={BookOpen} size={22} />}
          emptyText={courses.length === 0 ? t("empty") : t("noMatch")}
          emptyHint={courses.length === 0 ? t("emptyHint") : undefined}
          onRetry={() => q.refetch()}
        >
          {groups.map((g, i) => (
            <PeriodSection
              key={g.year}
              group={g}
              defaultOpen={i === 0 || filtering}
              renderRows={(rows) => (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((c) => (
                    <li key={c.id}>
                      <CourseCard course={c} />
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
