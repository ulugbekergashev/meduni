import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  ListChecks,
  Trophy,
  Users2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { BarRow, Card, Icon, ProgressBar, ProgressRing, Spinner } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useMe } from "../../lib/auth";
import { useTeachCourses, useTeachDashboard, type RankedStudent } from "./api";
import { CourseCard } from "./CourseCard";

function QuickAction({ icon, label, tone, chip, onClick }: { icon: LucideIcon; label: string; tone: string; chip: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3.5 rounded-card border p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${tone}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-white ${chip}`}>
        <Icon icon={icon} size={20} />
      </div>
      <span className="text-[15.5px] font-semibold text-ink">{label}</span>
    </button>
  );
}

function HeroStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="min-w-[72px]">
      <p className="text-[26px] font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[13.5px] font-medium text-white/70">{label}</p>
    </div>
  );
}

function TaskRow({ icon, tone, count, label, onClick }: { icon: LucideIcon; tone: string; count: number; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-3 rounded-control border p-3 text-left transition-all ${tone} ${onClick ? "hover:-translate-y-0.5 hover:shadow-sm" : "cursor-default"}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/60">
        <Icon icon={icon} size={17} />
      </div>
      <span className="text-[24px] font-bold tabular-nums leading-none">{count}</span>
      <span className="text-body font-medium">{label}</span>
    </button>
  );
}

function MetricCard({ ring, tone, label, sublabel }: { ring: number; tone: "brand" | "blue" | "emerald"; label: string; sublabel?: string }) {
  return (
    <Card className="flex items-center gap-4">
      <ProgressRing value={ring} tone={tone} />
      <div className="min-w-0">
        <p className="text-body font-semibold text-ink">{label}</p>
        {sublabel && <p className="mt-0.5 text-note text-ink-faint">{sublabel}</p>}
      </div>
    </Card>
  );
}

/** Reyting kartasi — eng yuqori yoki orqada qolgan talabalar (o'qituvchi ko'rinishi). */
function RankingCard({
  title,
  icon,
  tone,
  rows,
  emptyText,
  onPick,
}: {
  title: string;
  icon: LucideIcon;
  tone: string;
  rows: RankedStudent[];
  emptyText: string;
  onPick: (id: number) => void;
}) {
  return (
    <Card>
      <p className={`mb-2.5 flex items-center gap-1.5 text-note font-bold uppercase tracking-wide ${tone}`}>
        <Icon icon={icon} size={14} /> {title}
      </p>
      {rows.length === 0 ? (
        <p className="py-2 text-note text-ink-faint">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <button
              key={r.id}
              onClick={() => onPick(r.id)}
              className="flex w-full items-center gap-2.5 rounded-control px-1.5 py-1 text-left transition-colors hover:bg-bg"
            >
              <span className="w-4 shrink-0 text-note font-bold tabular-nums text-ink-faint">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-body text-ink">{r.fullName}</span>
              <ProgressBar value={r.overallPct} className="hidden w-20 shrink-0 sm:block" tone={r.behind ? "rose" : "emerald"} />
              <span className="w-9 shrink-0 text-right text-note font-bold tabular-nums text-ink-soft">{r.overallPct}%</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TeachDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const locale = useLocale();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const dash = useTeachDashboard();
  const list = useTeachCourses();
  const courses = list.data ?? [];
  const tasks = dash.data?.tasks;
  const stats = dash.data?.stats;
  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");
  const firstCourseId = courses[0]?.id;
  const noTasks = tasks && tasks.casesToReview === 0 && tasks.contentToApprove === 0 && tasks.studentsBehind === 0;
  const publishedPct = stats && stats.totalTopics > 0 ? Math.round((stats.publishedTopics / stats.totalTopics) * 100) : 0;

  return (
    <div>
      {/* Hero band: greeting + date + at-a-glance numbers */}
      <div className="rounded-card bg-gradient-to-br from-brand-deep to-brand p-4 text-white shadow-card sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">
              {t("hello")}, {me?.full_name?.split(" ")[0]}
            </h1>
            <p className="mt-1 text-[14.5px] font-medium text-white/70">{today}</p>
          </div>
          {stats && (
            <div className="flex gap-3">
              <HeroStat value={stats.students} label={t("statStudents")} />
              <HeroStat value={stats.courses} label={t("qaCourses")} />
              <HeroStat value={stats.groupList.length} label={t("qaGroups")} />
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction icon={ListChecks} label={t("qaTasks")} tone="border-brand/20 bg-brand-soft" chip="bg-brand" onClick={() => navigate("/teach/tasks")} />
        <QuickAction icon={ClipboardCheck} label={t("qaReview")} tone="border-amber/20 bg-amber-soft" chip="bg-amber" onClick={() => navigate("/teach/cases/review")} />
        <QuickAction icon={BookOpen} label={t("qaCourses")} tone="border-blue/20 bg-blue-soft" chip="bg-blue" onClick={() => navigate("/teach/courses")} />
        <QuickAction icon={Users2} label={t("qaGroups")} tone="border-violet/20 bg-violet-soft" chip="bg-violet" onClick={() => navigate("/teach/groups")} />
      </div>

      {/* Tasks */}
      <section className="mt-4">
        <h2 className="mb-3 text-section font-bold text-ink">{t("tasks")}</h2>
        {dash.isLoading ? (
          <div className="flex h-24 items-center justify-center"><Spinner size={22} /></div>
        ) : noTasks ? (
          <Card className="flex items-center gap-3 border-emerald/40 bg-emerald-soft">
            <Icon icon={CheckCircle2} size={22} className="text-emerald" />
            <p className="text-[15px] font-semibold text-emerald">{t("allDone")}</p>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-3">
            <TaskRow icon={ClipboardCheck} tone="border-amber/30 bg-amber-soft text-amber" count={tasks?.casesToReview ?? 0} label={t("casesToReview")} onClick={() => navigate("/teach/cases/review")} />
            <TaskRow icon={FileClock} tone="border-blue/30 bg-blue-soft text-blue" count={tasks?.contentToApprove ?? 0} label={t("contentToApprove")} onClick={() => navigate("/teach/tasks")} />
            <TaskRow icon={UserX} tone="border-rose/30 bg-rose-soft text-rose" count={tasks?.studentsBehind ?? 0} label={t("studentsBehind")} onClick={firstCourseId ? () => navigate(`/teach/courses/${firstCourseId}/progress`) : undefined} />
          </div>
        )}
      </section>

      {/* Analytics */}
      {stats && (
        <section className="mt-4">
          <h2 className="mb-3 text-section font-bold text-ink">{t("analytics")}</h2>
          <div className="grid gap-2.5 lg:grid-cols-3">
            <MetricCard ring={stats.avgProgress} tone="brand" label={t("statAvgProgress")} sublabel={t("statStudentsN", { n: stats.students })} />
            <MetricCard ring={stats.avgAttendance ?? 0} tone="blue" label={t("statAttendance")} sublabel={stats.avgAttendance === null ? "—" : undefined} />
            <MetricCard ring={publishedPct} tone="emerald" label={t("statTopics")} sublabel={`${stats.publishedTopics}/${stats.totalTopics}`} />
          </div>

          {/* Per-course progress bars */}
          {dash.data && dash.data.courses.length > 0 && (
            <Card className="mt-2.5">
              <p className="mb-2 text-[13.5px] font-semibold text-ink-soft">{t("byCourse")}</p>
              <div className="space-y-0.5">
                {dash.data.courses.map((c) => (
                  <BarRow
                    key={c.id}
                    label={c.subjectName}
                    value={c.avgProgress}
                    onClick={() => navigate(`/teach/courses/${c.id}/progress`)}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Reyting: eng yuqori / orqada qolganlar */}
          {dash.data && (dash.data.ranking.top.length > 0 || dash.data.ranking.behind.length > 0) && (
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              <RankingCard
                title={t("rankTop")}
                icon={Trophy}
                tone="text-emerald"
                rows={dash.data.ranking.top}
                emptyText={t("rankEmpty")}
                onPick={(id) => navigate(`/teach/students/${id}`)}
              />
              <RankingCard
                title={t("rankBehind")}
                icon={UserX}
                tone="text-rose"
                rows={dash.data.ranking.behind}
                emptyText={t("rankNoBehind")}
                onPick={(id) => navigate(`/teach/students/${id}`)}
              />
            </div>
          )}

          {/* Clickable group chips */}
          {stats.groupList.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-note font-semibold text-ink-soft">
                <Icon icon={Users2} size={15} /> {t("myGroups")}:
              </span>
              {stats.groupList.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/teach/groups/${g.id}`)}
                  className="rounded-pill bg-bg px-2.5 py-0.5 text-note font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep"
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Upcoming sessions */}
      {dash.data?.upcomingSessions && dash.data.upcomingSessions.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-3 text-section font-bold text-ink">{t("upcoming")}</h2>
          <div className="space-y-2">
            {dash.data.upcomingSessions.map((s) => (
              <button key={s.id} onClick={() => navigate(s.groupId ? `/teach/groups/${s.groupId}?tab=sessions` : `/teach/courses/${s.courseId}`)} className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                  <Icon icon={CalendarDays} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-ink">{s.title ?? s.subjectName}</p>
                  <p className="truncate text-note text-ink-faint">{s.subjectName}{s.room ? ` · ${s.room}` : ""}</p>
                </div>
                <span className="shrink-0 text-note font-medium text-ink-soft">{formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Courses preview */}
      <section className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-section font-bold text-ink">{t("myCourses")}</h2>
          <button onClick={() => navigate("/teach/courses")} className="text-body font-semibold text-brand-deep hover:underline">{t("seeAll")} →</button>
        </div>
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={courses.length === 0}
          emptyIcon={<Icon icon={BookOpen} size={22} />}
          emptyText={t("empty")}
          onRetry={() => list.refetch()}
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 3).map((c) => (
              <li key={c.id}><CourseCard course={c} avgProgress={dash.data?.courses.find((d) => d.id === c.id)?.avgProgress ?? 0} /></li>
            ))}
          </ul>
        </AsyncSection>
      </section>
    </div>
  );
}
