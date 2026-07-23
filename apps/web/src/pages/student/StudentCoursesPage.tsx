import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { BookOpen, CheckCircle2, ChevronRight, Layers, PlayCircle, RotateCcw, Search, Users } from "lucide-react";
import { Card, Icon, ProgressBar, ProgressRing, cls } from "@meduni/ui";
import { HeroCard, HeroTile } from "../../components/HeroStats";
import { AsyncSection } from "../../components/AsyncSection";
import { PeriodFilter, PeriodSection, groupByPeriod, usePeriodOptions } from "../../components/PeriodGroups";
import { useMyCourses, type CourseSummary } from "./api";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

function CourseRow({ course }: { course: CourseSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentCourses" });
  const navigate = useNavigate();
  const done = course.topicsTotal > 0 && course.topicsCompleted === course.topicsTotal;

  return (
    <div
      onClick={() => navigate(`/app/courses/${course.id}`)}
      className="group flex cursor-pointer items-center gap-5 px-5 py-4 transition-all duration-300 hover:bg-surface-raised hover:pl-6"
    >
      <div
        className={cls(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110",
          done ? "bg-emerald-soft text-emerald" : "bg-brand-soft text-brand-tint"
        )}
      >
        <Icon icon={done ? CheckCircle2 : BookOpen} size={22} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-bold text-ink">{course.subjectName}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate text-note text-ink-faint">
          <span className="truncate">{course.teacherName}</span>
          <span className="text-line">·</span>
          <span className="whitespace-nowrap">
            {course.topicsCompleted}/{course.topicsTotal} {t("topics")}
          </span>
          {course.groupName && (
            <>
              <span className="text-line">·</span>
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                <Icon icon={Users} size={11} /> {course.groupName}
              </span>
            </>
          )}
        </p>
        <div className="mt-2 max-w-[400px]">
          <ProgressBar value={course.progressPct} tone={done ? "emerald" : "brand"} />
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className={cls("text-[18px] font-bold tabular-nums", done ? "text-emerald" : "text-brand-tint")}>
          {course.progressPct}%
        </span>
        {course.nextTopicId ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/topics/${course.nextTopicId}`);
            }}
            className="inline-flex items-center gap-2 rounded-control border border-brand/20 bg-brand-soft/50 px-4 py-2 text-body font-bold text-brand-tint backdrop-blur-sm transition-all duration-300 hover:border-brand/40 hover:bg-brand-soft hover:shadow-sm hover:scale-105"
          >
            <Icon icon={PlayCircle} size={16} />
            <span className="hidden sm:inline">{t("continueShort")}</span>
          </button>
        ) : done ? (
          <span title={t("allDone")} className="drop-shadow-sm">
            <Icon icon={CheckCircle2} size={22} className="text-emerald" />
          </span>
        ) : null}
        <Icon icon={ChevronRight} size={20} className="text-ink-faint transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </div>
  );
}

function CourseList({ rows }: { rows: CourseSummary[] }) {
  return (
    <Card className="divide-y divide-line overflow-hidden p-0">
      {rows.map((c) => (
        <CourseRow key={c.id} course={c} />
      ))}
    </Card>
  );
}

/** "Kurslarim" — talabaning asosiy moduli: kurslar ro'yxat ko'rinishida,
 *  sukut bo'yicha joriy semestr filtri bilan. */
export function StudentCoursesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "studentCourses" });
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
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={itemVariants}>
        <HeroCard
          title={t("title")}
          subtitle={t("subtitle")}
          left={
            <div className="flex items-center gap-4">
              <ProgressRing value={avgProgress} size={64} stroke={8} tone="brand" />
              <span className="text-note font-bold text-ink-soft">{t("avgProgress")}</span>
            </div>
          }
        >
          <HeroTile icon={BookOpen} value={String(courses.length)} label={t("statAll")} tone="bg-brand-soft text-brand-tint" />
          <HeroTile
            icon={PlayCircle}
            value={String(currentCount)}
            label={t("statCurrent")}
            tone="bg-blue-soft text-blue"
            selected={isCurrentDefault}
            onClick={newest ? backToCurrent : undefined}
          />
          <HeroTile icon={Layers} value={`${topicsDone}/${topicsTotal}`} label={t("statTopics")} tone="bg-violet-soft text-violet" />
          <HeroTile icon={CheckCircle2} value={String(doneCourses)} label={t("statDone")} tone="bg-emerald-soft text-emerald" />
        </HeroCard>
      </motion.div>

      <motion.div variants={itemVariants} className="sticky top-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-surface-glass px-5 py-4 shadow-sm backdrop-blur-xl border border-white/50">
        <div className="relative min-w-[240px] flex-1">
          <Icon icon={Search} size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-control border border-line bg-surface/60 py-3 pl-11 pr-4 text-body font-medium outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10 hover:border-line-raised hover:bg-surface/90"
          />
        </div>
        <div className="flex items-center gap-2 rounded-control border border-line bg-surface/60 p-1.5 backdrop-blur-sm transition-all hover:bg-surface/90">
          <PeriodFilter
            years={options.years}
            semesters={options.semesters}
            year={year}
            semester={semester}
            onYear={onYear}
            onSemester={onSemester}
          />
        </div>
        {!isCurrentDefault && newest && (
          <button
            onClick={backToCurrent}
            className="inline-flex items-center gap-2 rounded-control border border-line bg-surface/60 px-4 py-2.5 text-body font-semibold text-brand-tint backdrop-blur-sm transition-all hover:border-brand-soft hover:bg-brand-soft hover:shadow-sm"
          >
            <Icon icon={RotateCcw} size={16} />
            {t("backToCurrent")}
          </button>
        )}
        <span className="ml-auto text-body font-bold text-ink-soft drop-shadow-sm">{t("totalN", { n: filtered.length })}</span>
      </motion.div>

      <motion.div variants={itemVariants}>
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
            <CourseList rows={filtered} />
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
      </motion.div>
    </motion.div>
  );
}
