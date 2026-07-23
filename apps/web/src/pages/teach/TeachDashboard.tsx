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
import { BarRow, Card, Icon, ProgressBar, ProgressRing, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useMe } from "../../lib/auth";
import { useTeachCourses, useTeachDashboard, type RankedStudent } from "./api";
import { CourseCard } from "./CourseCard";

function QuickAction({ icon, label, chip, onClick }: { icon: LucideIcon; label: string; chip: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-5 text-left shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card-hover hover:border-brand/30 bg-surface`}
    >
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-10 transition-opacity duration-300 group-hover:opacity-30 ${chip}`} />
      <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${chip}`}>
        <Icon icon={icon} size={22} />
      </div>
      <span className="relative z-10 text-[16px] font-bold text-ink transition-colors duration-300 group-hover:text-brand-tint">{label}</span>
    </button>
  );
}

function HeroStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="relative min-w-[72px] rounded-2xl bg-white/10 p-3.5 backdrop-blur-md border border-white/10 shadow-lg transition-transform hover:scale-105">
      <p className="text-[28px] font-black leading-none tabular-nums text-white drop-shadow-md">{value}</p>
      <p className="mt-1 text-[13px] font-bold uppercase tracking-wider text-white/80">{label}</p>
    </div>
  );
}

function TaskRow({ icon, tone, count, label, onClick }: { icon: LucideIcon; tone: string; count: number; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left shadow-sm transition-all duration-300 ${onClick ? "hover:-translate-y-1 hover:border-brand/30 hover:shadow-md hover:pl-5" : "cursor-default"}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${tone}`}>
        <Icon icon={icon} size={22} />
      </div>
      <div className="flex flex-col">
        <span className="text-[26px] font-black tabular-nums leading-none text-ink drop-shadow-sm transition-colors group-hover:text-brand-tint">{count}</span>
        <span className="mt-0.5 text-[14px] font-semibold text-ink-soft transition-colors group-hover:text-ink">{label}</span>
      </div>
    </button>
  );
}

function MetricCard({ ring, tone, label, sublabel }: { ring: number; tone: "brand" | "blue" | "emerald"; label: string; sublabel?: string }) {
  return (
    <Card className="group flex items-center gap-5 !p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover border border-line hover:border-brand/30">
      <div className="transition-transform duration-500 group-hover:scale-110">
        <ProgressRing value={ring} tone={tone} />
      </div>
      <div className="min-w-0">
        <p className="text-[16px] font-extrabold text-ink transition-colors group-hover:text-brand-tint">{label}</p>
        {sublabel && <p className="mt-1 text-[13.5px] font-medium text-ink-faint">{sublabel}</p>}
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
    <Card className="group flex flex-col hover:border-brand/30 transition-colors duration-300">
      <p className={`mb-4 flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-widest ${tone}`}>
        <Icon icon={icon} size={18} /> {title}
      </p>
      {rows.length === 0 ? (
        <p className="py-5 text-center text-[14.5px] font-medium text-ink-faint bg-surface-raised rounded-xl border border-dashed border-line">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <button
              key={r.id}
              onClick={() => onPick(r.id)}
              className="group/row flex w-full items-center gap-3.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all hover:bg-surface-raised hover:border-line hover:shadow-sm hover:pl-4"
            >
              <div className={cls(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black tabular-nums transition-transform group-hover/row:scale-110 group-hover/row:rotate-6",
                i === 0 ? "bg-gradient-to-br from-yellow-300 to-yellow-600 text-white shadow-md ring-2 ring-yellow-500/20" :
                i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-sm ring-2 ring-slate-400/20" :
                i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-700 text-white shadow-sm ring-2 ring-orange-500/20" :
                "bg-bg text-ink-soft border border-line"
              )}>
                {i + 1}
              </div>
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink group-hover/row:text-brand-tint transition-colors">{r.fullName}</span>
              <ProgressBar value={r.overallPct} className="hidden w-24 shrink-0 sm:block" tone={r.behind ? "rose" : "emerald"} />
              <span className="w-10 shrink-0 text-right text-[14.5px] font-bold tabular-nums text-ink-soft">{r.overallPct}%</span>
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
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-brand-deep via-brand to-violet p-6 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:p-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-brand-tint/40 blur-3xl" />
        
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
          <div className="min-w-0">
            <h1 className="text-[32px] font-black leading-tight tracking-tight drop-shadow-md">
              {t("hello")}, {me?.full_name?.split(" ")[0]}
            </h1>
            <p className="mt-1.5 text-[16px] font-medium text-white/80">{today}</p>
          </div>
          {stats && (
            <div className="flex flex-wrap gap-4">
              <HeroStat value={stats.students} label={t("statStudents")} />
              <HeroStat value={stats.courses} label={t("qaCourses")} />
              <HeroStat value={stats.groupList.length} label={t("qaGroups")} />
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction icon={ListChecks} label={t("qaTasks")} chip="bg-brand" onClick={() => navigate("/teach/tasks")} />
        <QuickAction icon={ClipboardCheck} label={t("qaReview")} chip="bg-amber" onClick={() => navigate("/teach/cases/review")} />
        <QuickAction icon={BookOpen} label={t("qaCourses")} chip="bg-blue" onClick={() => navigate("/teach/courses")} />
        <QuickAction icon={Users2} label={t("qaGroups")} chip="bg-violet" onClick={() => navigate("/teach/groups")} />
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
              <button key={s.id} onClick={() => navigate(s.groupId ? `/teach/groups/${s.groupId}?tab=sessions` : `/teach/courses/${s.courseId}`)} className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-md hover:pl-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                  <Icon icon={CalendarDays} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold text-ink transition-colors duration-300 group-hover:text-brand-tint">{s.title ?? s.subjectName}</p>
                  <p className="mt-0.5 truncate text-[14px] font-medium text-ink-soft">{s.subjectName}{s.room ? ` · ${s.room}` : ""}</p>
                </div>
                <span className="shrink-0 text-[14.5px] font-bold text-ink-soft">{formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")}</span>
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
