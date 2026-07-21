import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { BookOpen, CheckCircle2, Layers, PlayCircle, Search, UserRound, Users } from "lucide-react";
import { Card, Icon, ProgressBar, ProgressRing, cls } from "@meduni/ui";
import { HeroCard, HeroTile } from "../../components/HeroStats";
import { AsyncSection } from "../../components/AsyncSection";
import { PeriodFilter, PeriodSection, groupByPeriod, usePeriodOptions } from "../../components/PeriodGroups";
import { useMyCourses, type CourseSummary } from "./api";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function CourseCard({ course }: { course: CourseSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentCourses" });
  const { t: tp } = useTranslation(undefined, { keyPrefix: "period" });
  const navigate = useNavigate();
  const done = course.topicsTotal > 0 && course.topicsCompleted === course.topicsTotal;

  return (
    <motion.div variants={itemVariants} className="h-full">
      <Card
        interactive
        onClick={() => navigate(`/app/courses/${course.id}`)}
        className="flex h-full flex-col gap-4 p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-ink">{course.subjectName}</h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] font-medium text-ink-soft">
              <Icon icon={UserRound} size={14} className="text-ink-faint" /> {course.teacherName}
            </p>
          </div>
          <div
            className={cls(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] shadow-sm",
              done ? "bg-emerald-soft text-emerald" : "bg-brand-soft text-brand-deep"
            )}
          >
            <Icon icon={done ? CheckCircle2 : BookOpen} size={20} />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[12.5px] font-bold">
          <span className="rounded-[6px] bg-brand-soft border border-brand/20 px-2.5 py-0.5 text-brand-deep shadow-sm">
            {tp("semester", { n: course.semester })}
          </span>
          <span className="rounded-[6px] bg-surface border border-line px-2.5 py-0.5 text-ink-soft shadow-sm">{course.academicYear}</span>
          {course.groupName && (
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-surface border border-line px-2.5 py-0.5 text-ink-soft shadow-sm">
              <Icon icon={Users} size={12} className="text-ink-faint" /> {course.groupName}
            </span>
          )}
        </div>

        <div className="space-y-2 mt-auto">
          <ProgressBar value={course.progressPct} tone={done ? "emerald" : "brand"} />
          <div className="flex items-center justify-between text-[13px]">
            <span className={cls("font-bold", done ? "text-emerald" : "text-brand-deep")}>{course.progressPct}%</span>
            <span className="font-semibold text-ink-soft">
              {course.topicsCompleted}/{course.topicsTotal} {t("topics")}
            </span>
          </div>
        </div>

        <div className="pt-2">
          {course.nextTopicId ? (
            <>
              <p className="mb-2.5 truncate text-[13px] font-semibold text-ink-soft">
                <span className="text-ink-faint font-medium">{t("nextTopic")}: </span>
                {course.nextTopic}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/app/topics/${course.nextTopicId}`);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-[14px] font-bold text-white shadow-sm transition-all hover:bg-brand-deep hover:shadow-md hover:-translate-y-[1px]"
              >
                <Icon icon={PlayCircle} size={18} />
                {t("continue")}
              </button>
            </>
          ) : (
            <p className="rounded-[10px] bg-emerald-soft border border-emerald/20 px-4 py-2.5 text-center text-[14px] font-bold text-emerald shadow-sm">
              {done ? t("allDone") : t("noOpenTopic")}
            </p>
          )}
        </div>
      </Card>
    </motion.div>
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

  const avgProgress = courses.length
    ? Math.round(courses.reduce((a, c) => a + c.progressPct, 0) / courses.length)
    : 0;
  const doneCourses = courses.filter((c) => c.topicsTotal > 0 && c.topicsCompleted === c.topicsTotal).length;
  const newest = courses[0];
  const currentCount = courses.filter(
    (c) => newest && c.academicYear === newest.academicYear && c.semester === newest.semester
  ).length;
  const topicsDone = courses.reduce((a, c) => a + c.topicsCompleted, 0);
  const topicsTotal = courses.reduce((a, c) => a + c.topicsTotal, 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants}>
        <HeroCard
          title={t("title")}
          subtitle={t("subtitle")}
          left={
            <div className="flex items-center gap-4">
              <ProgressRing value={avgProgress} size={72} stroke={8} tone="brand" />
              <span className="text-[14px] font-bold text-ink-soft">{t("avgProgress")}</span>
            </div>
          }
        >
          <HeroTile icon={BookOpen} value={String(courses.length)} label={t("statAll")} tone="bg-brand-soft text-brand-deep" />
          <HeroTile
            icon={PlayCircle}
            value={String(currentCount)}
            label={t("statCurrent")}
            tone="bg-blue-soft text-blue"
            onClick={newest ? () => { setYear(newest.academicYear); setSemester(String(newest.semester)); } : undefined}
          />
          <HeroTile icon={Layers} value={`${topicsDone}/${topicsTotal}`} label={t("statTopics")} tone="bg-violet-soft text-violet" />
          <HeroTile icon={CheckCircle2} value={String(doneCourses)} label={t("statDone")} tone="bg-emerald-soft text-emerald" />
        </HeroCard>
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Icon icon={Search} size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-[10px] border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-brand shadow-sm transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 bg-surface p-1 rounded-[12px] border border-line shadow-sm">
          <PeriodFilter
            years={options.years}
            semesters={options.semesters}
            year={year}
            semester={semester}
            onYear={setYear}
            onSemester={setSemester}
          />
        </div>
        <span className="text-[13px] font-bold text-ink-soft ml-2">{t("totalN", { n: filtered.length })}</span>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-2">
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
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      </motion.div>
    </motion.div>
  );
}
