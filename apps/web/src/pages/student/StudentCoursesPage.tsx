import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, CheckCircle2, PlayCircle, RotateCcw, Search, TrendingUp, Users } from "lucide-react";
import { Button, Icon, cls } from "@meduni/ui";
import { BentoCard, HeaderChip, MetricTile, PageHeader } from "../../components/bento";
import { Disclosure } from "../../components/Disclosure";
import { AsyncSection } from "../../components/AsyncSection";
import { PeriodFilter, PeriodSection, groupByPeriod, usePeriodOptions } from "../../components/PeriodGroups";
import { Line, SearchField } from "./parts/bento";
import { useMyCourses, type CourseSummary } from "./api";

/**
 * Kurs qatori. Qatorning o'zi — kursga o'tish tugmasi; "Davom" esa YONIDA
 * alohida tugma (ichma-ich `<button>` yo'q).
 */
function CourseRow({ course }: { course: CourseSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentCourses" });
  const navigate = useNavigate();
  const done = course.topicsTotal > 0 && course.topicsCompleted === course.topicsTotal;

  return (
    <li className="flex min-w-0 items-center gap-2 rounded-control px-2 transition-colors hover:bg-surface-raised">
      <button
        type="button"
        onClick={() => navigate(`/app/courses/${course.id}`)}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-control py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span
          className={cls(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            done ? "bg-emerald-soft text-emerald" : "bg-brand-soft text-brand-deep"
          )}
        >
          <Icon icon={done ? CheckCircle2 : BookOpen} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">{course.subjectName}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-micro text-ink-soft">
            <span className="truncate">{course.teacherName}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0 tabular-nums">
              {course.topicsCompleted}/{course.topicsTotal} {t("topics")}
            </span>
            {course.groupName && (
              <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
                <span aria-hidden>·</span>
                <Icon icon={Users} size={11} />
                {course.groupName}
              </span>
            )}
          </span>
          <Line value={course.progressPct} tone={done ? "emerald" : "brand"} className="mt-2 max-w-sm" />
        </span>
        <span className={cls("shrink-0 text-section font-semibold tabular-nums", done ? "text-emerald" : "text-ink")}>
          {course.progressPct}%
        </span>
        <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface sm:flex">
          <Icon icon={ArrowRight} size={13} />
        </span>
      </button>
      {course.nextTopicId && (
        <Button
          size="sm"
          icon={<Icon icon={PlayCircle} size={14} />}
          onClick={() => navigate(`/app/topics/${course.nextTopicId}`)}
          aria-label={t("continueShort")}
          title={course.nextTopic ?? undefined}
          className="shrink-0"
        >
          <span className="hidden sm:inline">{t("continueShort")}</span>
        </Button>
      )}
    </li>
  );
}

function CourseList({ rows, title }: { rows: CourseSummary[]; title?: string }) {
  return (
    <BentoCard title={title} count={title ? rows.length : undefined} bodyClassName="px-2 pb-2">
      <ul className="divide-y divide-line-soft">
        {rows.map((c) => (
          <CourseRow key={c.id} course={c} />
        ))}
      </ul>
    </BentoCard>
  );
}

/** "Kurslarim" — talabaning asosiy moduli: kurslar ro'yxat ko'rinishida,
 *  sukut bo'yicha joriy semestr filtri bilan. */
export function StudentCoursesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "studentCourses" });
  const { t: tp } = useTranslation(undefined, { keyPrefix: "period" });
  const q = useMyCourses();
  const courses = useMemo(() => q.data ?? [], [q.data]);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const options = usePeriodOptions(courses);

  // Sukut bo'yicha joriy semestr — foydalanuvchi filtrga tegmaguncha.
  const touched = useRef(false);
  const newest = courses[0];
  useEffect(() => {
    if (touched.current || !newest) return;
    setYear(newest.academicYear);
    setSemester(String(newest.semester));
  }, [newest]);

  const onYear = (v: string) => {
    touched.current = true;
    setYear(v);
  };
  const onSemester = (v: string) => {
    touched.current = true;
    setSemester(v);
  };
  const backToCurrent = () => {
    if (!newest) return;
    setYear(newest.academicYear);
    setSemester(String(newest.semester));
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (year && c.academicYear !== year) return false;
      if (semester && String(c.semester) !== semester) return false;
      if (!needle) return true;
      return c.subjectName.toLowerCase().includes(needle) || c.teacherName.toLowerCase().includes(needle);
    });
  }, [courses, search, year, semester]);

  const specificPeriod = !!year && !!semester;
  const groups = useMemo(() => groupByPeriod(filtered), [filtered]);
  const filtering = !!search.trim() || !!year || !!semester;
  const isCurrentDefault =
    !!newest && year === newest.academicYear && semester === String(newest.semester) && !search.trim();

  const avgProgress = courses.length
    ? Math.round(courses.reduce((a, c) => a + c.progressPct, 0) / courses.length)
    : 0;
  const doneCourses = courses.filter((c) => c.topicsTotal > 0 && c.topicsCompleted === c.topicsTotal).length;
  const currentCount = courses.filter(
    (c) => newest && c.academicYear === newest.academicYear && c.semester === newest.semester
  ).length;
  const topicsDone = courses.reduce((a, c) => a + c.topicsCompleted, 0);
  const topicsTotal = courses.reduce((a, c) => a + c.topicsTotal, 0);

  return (
    <div className="space-y-3">
      <PageHeader
        className="mb-0"
        title={t("title")}
        subtitle={t("summaryLine", { all: courses.length, done: doneCourses, topicsDone, topicsTotal })}
        right={
          courses.length > 0 && (
            <HeaderChip icon={<Icon icon={TrendingUp} size={15} />}>
              {t("avgProgress")}
              <b className="font-data tabular-nums text-ink">{avgProgress}%</b>
            </HeaderChip>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        {/* STAT DIETASI: yagona tile — u FILTR (joriy semestrga qaytaradi). */}
        <MetricTile
          size="stat"
          tone="brand"
          label={t("currentSemesterTile")}
          value={currentCount}
          sub={newest ? `${newest.academicYear} · ${tp("semester", { n: newest.semester })}` : undefined}
          selected={isCurrentDefault}
          onClick={newest ? backToCurrent : undefined}
        />

        <BentoCard bodyClassName="flex flex-col justify-center gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              className="min-w-[200px] flex-1"
              value={search}
              onChange={setSearch}
              placeholder={t("searchPlaceholder")}
              icon={<Icon icon={Search} size={16} />}
            />
            {!isCurrentDefault && newest && (
              <Button variant="ghost" size="sm" className="rounded-pill" icon={<Icon icon={RotateCcw} size={14} />} onClick={backToCurrent}>
                {t("backToCurrent")}
              </Button>
            )}
            <span className="ml-auto shrink-0 rounded-pill bg-surface-raised px-2.5 py-1 text-micro font-semibold tabular-nums text-ink-soft">
              {t("totalN", { n: filtered.length })}
            </span>
          </div>
          {/* Davr filtri — sukut bo'yicha joriy semestr ochiladi, ya'ni bu
              boshqaruv kamdan-kam kerak. Yig'ib qo'yildi (faol filtr soni bilan). */}
          <Disclosure
            label={t("periodFilter")}
            count={(year ? 1 : 0) + (semester ? 1 : 0)}
            storageKey="meduni.student.coursesPeriod"
          >
            <div className="flex flex-wrap items-center gap-2">
              <PeriodFilter
                years={options.years}
                semesters={options.semesters}
                year={year}
                semester={semester}
                onYear={onYear}
                onSemester={onSemester}
              />
            </div>
          </Disclosure>
        </BentoCard>
      </div>

      <AsyncSection
        isLoading={q.isLoading}
        isError={q.isError}
        isEmpty={filtered.length === 0}
        emptyIcon={<Icon icon={BookOpen} size={22} />}
        emptyText={courses.length === 0 ? t("empty") : t("noMatch")}
        emptyHint={courses.length === 0 ? t("emptyHint") : undefined}
        onRetry={() => q.refetch()}
      >
        {specificPeriod ? (
          <CourseList rows={filtered} title={`${year} · ${tp("semester", { n: Number(semester) })}`} />
        ) : (
          groups.map((g, i) => (
            <PeriodSection
              key={g.year}
              group={g}
              defaultOpen={i === 0 || filtering}
              renderRows={(rows) => <CourseList rows={rows} />}
            />
          ))
        )}
      </AsyncSection>
    </div>
  );
}
