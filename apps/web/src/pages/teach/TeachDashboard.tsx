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
import { useState } from "react";
import { BarRow, Button, Icon, ProgressBar, ProgressRing, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useMe } from "../../lib/auth";
import { useTeacherSessions, useTeachCourses, useTeachDashboard, type RankedStudent, type TeacherSession } from "./api";
import { AttendanceModal } from "./course/attendance/AttendanceModal";
import { CourseCard } from "./CourseCard";

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function QuickAction({ icon, label, chip, onClick }: { icon: LucideIcon; label: string; chip: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-4 overflow-hidden rounded-[20px] border border-line bg-surface p-5 text-left shadow-sm ring-1 ring-line transition-all duration-300 hover:-translate-y-1 hover:bg-surface-raised hover:shadow-md`}
    >
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-10 transition-opacity duration-500 group-hover:opacity-30 ${chip}`} />
      <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-white shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[10deg] ${chip}`}>
        <Icon icon={icon} size={22} />
      </div>
      <span className="relative z-10 text-[16px] font-bold text-ink transition-colors duration-300 group-hover:text-brand-tint">{label}</span>
    </button>
  );
}

function HeroStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="relative min-w-[80px] rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-transform duration-500 hover:-translate-y-1 hover:scale-105 hover:bg-white/20">
      <p className="text-[32px] font-black leading-none tabular-nums text-white drop-shadow-md">{value}</p>
      <p className="mt-1.5 text-[12.5px] font-bold uppercase tracking-wider text-white/90">{label}</p>
    </div>
  );
}

function TaskRow({ icon, tone, count, label, onClick }: { icon: LucideIcon; tone: string; count: number; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`group flex w-full items-center gap-4 rounded-[20px] border border-line bg-surface p-5 text-left shadow-sm ring-1 ring-line transition-all duration-300 ${onClick ? "hover:-translate-y-1 hover:bg-surface-raised hover:shadow-md" : "cursor-default"}`}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 shadow-sm ${tone}`}>
        <Icon icon={icon} size={24} />
      </div>
      <div className="flex flex-col">
        <span className="text-[28px] font-black tabular-nums leading-none text-ink drop-shadow-sm transition-colors group-hover:text-brand-tint">{count}</span>
        <span className="mt-1 text-[14px] font-semibold text-ink-soft transition-colors group-hover:text-ink">{label}</span>
      </div>
    </button>
  );
}

function MetricCard({ ring, tone, label, sublabel }: { ring: number; tone: "brand" | "blue" | "emerald"; label: string; sublabel?: string }) {
  return (
    <div className="group flex items-center gap-5 rounded-[20px] border border-line bg-surface p-6 shadow-sm ring-1 ring-line transition-all duration-300 hover:-translate-y-1 hover:bg-surface-raised hover:shadow-md">
      <div className="transition-transform duration-500 group-hover:scale-110">
        <ProgressRing value={ring} tone={tone} />
      </div>
      <div className="min-w-0">
        <p className="text-[17px] font-extrabold text-ink transition-colors group-hover:text-brand-tint">{label}</p>
        {sublabel && <p className="mt-1 text-[13.5px] font-medium text-ink-soft">{sublabel}</p>}
      </div>
    </div>
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
    <div className="group flex flex-col rounded-[24px] border border-line bg-surface p-6 shadow-sm ring-1 ring-line transition-all duration-300 hover:bg-surface-raised hover:shadow-md">
      <p className={`mb-5 flex items-center gap-2.5 text-[15.5px] font-black uppercase tracking-widest ${tone}`}>
        <Icon icon={icon} size={20} /> {title}
      </p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[15px] font-medium text-ink-faint bg-white/30 rounded-2xl border border-dashed border-black/10">{emptyText}</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r, i) => (
              <button
                key={r.id}
                onClick={() => onPick(r.id)}
                className="group/row flex w-full items-center gap-4 rounded-[16px] bg-surface-raised px-4 py-3 text-left ring-1 ring-line transition-all duration-300 hover:bg-surface-glass hover:shadow-sm hover:ring-brand/20 hover:pl-5"
              >
              <div className={cls(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-black tabular-nums transition-transform duration-300 group-hover/row:scale-110 group-hover/row:rotate-[10deg]",
                i === 0 ? "bg-gradient-to-br from-yellow-300 to-yellow-600 text-white shadow-md ring-2 ring-yellow-500/20" :
                i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-sm ring-2 ring-slate-400/20" :
                i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-700 text-white shadow-sm ring-2 ring-orange-500/20" :
                "bg-surface-raised text-ink-soft ring-1 ring-line"
              )}>
                {i + 1}
              </div>
              <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-ink group-hover/row:text-brand-tint transition-colors">{r.fullName}</span>
              <ProgressBar value={r.overallPct} className="hidden w-28 shrink-0 sm:block" tone={r.behind ? "rose" : "emerald"} />
              <span className="w-12 shrink-0 text-right text-[15.5px] font-black tabular-nums text-ink-soft">{r.overallPct}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
  const todayKey = dayKeyLocal(new Date());
  const todaySessions = useTeacherSessions({ from: todayKey, to: todayKey });
  const [mark, setMark] = useState<TeacherSession | null>(null);
  const tasks = dash.data?.tasks;
  const stats = dash.data?.stats;
  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");
  const firstCourseId = courses[0]?.id;
  const noTasks = tasks && tasks.casesToReview === 0 && tasks.contentToApprove === 0 && tasks.studentsBehind === 0;
  const publishedPct = stats && stats.totalTopics > 0 ? Math.round((stats.publishedTopics / stats.totalTopics) * 100) : 0;

  return (
    <div className="relative z-0 space-y-8 pb-10">
      {/* Dynamic Background elements for glassmorphism pop */}
      <div className="pointer-events-none fixed left-0 top-0 -z-10 h-full w-full overflow-hidden bg-bg">
        <div className="absolute left-[10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-brand/5 blur-[100px]" />
        <div className="absolute bottom-[20%] right-[-5%] h-[600px] w-[600px] rounded-full bg-violet-400/5 blur-[120px]" />
      </div>

      {/* Hero band: greeting + date + at-a-glance numbers */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-deep via-brand to-violet p-8 text-white shadow-[0_20px_60px_rgb(0,0,0,0.15)] ring-1 ring-white/20 sm:p-12">
        <div className="absolute -right-32 -top-32 h-[400px] w-[400px] rounded-full bg-white/10 blur-[80px]" />
        <div className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-brand-tint/30 blur-[60px]" />
        
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
          <div className="min-w-0 max-w-xl">
            <h1 className="text-[40px] font-black leading-tight tracking-tight drop-shadow-lg sm:text-[48px]">
              {t("hello")}, {me?.full_name?.split(" ")[0]}
            </h1>
            <p className="mt-2 text-[18px] font-medium text-white/90 drop-shadow-md">{today}</p>
          </div>
          {stats && (
            <div className="flex flex-wrap gap-5">
              <HeroStat value={stats.students} label={t("statStudents")} />
              <HeroStat value={stats.courses} label={t("qaCourses")} />
              <HeroStat value={stats.groupList.length} label={t("qaGroups")} />
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction icon={ListChecks} label={t("qaTasks")} chip="bg-gradient-to-br from-brand to-brand-deep" onClick={() => navigate("/teach/tasks")} />
        <QuickAction icon={ClipboardCheck} label={t("qaReview")} chip="bg-gradient-to-br from-amber-400 to-amber-600" onClick={() => navigate("/teach/cases/review")} />
        <QuickAction icon={BookOpen} label={t("qaCourses")} chip="bg-gradient-to-br from-blue-400 to-blue-600" onClick={() => navigate("/teach/courses")} />
        <QuickAction icon={Users2} label={t("qaGroups")} chip="bg-gradient-to-br from-violet-400 to-violet-600" onClick={() => navigate("/teach/groups")} />
      </div>

      {/* Bugungi darslar — login qilib srazu yo'qlama qilish uchun */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[22px] font-black text-ink drop-shadow-sm">{t("todayLessons")}</h2>
          <button onClick={() => navigate("/teach/schedule")} className="rounded-full bg-surface-raised px-5 py-2 text-[14.5px] font-bold text-brand shadow-sm ring-1 ring-line transition-all hover:bg-brand-soft hover:ring-brand/20">
            {t("allLessons")} &rarr;
          </button>
        </div>
        {todaySessions.isLoading ? (
          <div className="flex h-24 items-center justify-center"><Spinner size={24} /></div>
        ) : (todaySessions.data?.length ?? 0) === 0 ? (
          <div className="flex items-center gap-4 rounded-[24px] border border-line bg-surface p-6 shadow-sm ring-1 ring-line">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-bg text-ink-faint">
              <Icon icon={CalendarDays} size={24} />
            </div>
            <p className="text-[15px] font-semibold text-ink-soft">{t("noTodayLessons")}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todaySessions.data!.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-sm ring-1 ring-line">
                <div className={cls("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]", s.status === "FULL" ? "bg-emerald-soft text-emerald" : s.status === "PARTIAL" ? "bg-amber-soft text-amber" : "bg-brand-soft text-brand-deep")}>
                  <Icon icon={CalendarDays} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-ink">{s.title ?? s.courseName}</p>
                  <p className="truncate text-[13px] text-ink-soft">{s.courseName}{s.groupName ? ` · ${s.groupName}` : ""} · {s.markedCount}/{s.rosterSize}</p>
                </div>
                <Button size="sm" variant={s.status === "FULL" ? "ghost" : "primary"} icon={<Icon icon={ClipboardCheck} size={15} />} onClick={() => setMark(s)}>
                  {t("markAttendance")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {mark && (
        <AttendanceModal courseId={mark.courseId} sessionId={mark.id} groupId={mark.groupId ?? undefined} onClose={() => setMark(null)} />
      )}

      {/* Tasks */}
      <section>
        <h2 className="mb-4 text-[22px] font-black text-ink drop-shadow-sm">{t("tasks")}</h2>
        {dash.isLoading ? (
          <div className="flex h-32 items-center justify-center"><Spinner size={28} className="text-brand" /></div>
        ) : noTasks ? (
          <div className="flex items-center gap-4 rounded-[24px] border border-emerald/20 bg-emerald-50/50 p-6 shadow-sm backdrop-blur-xl ring-1 ring-emerald/10">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-emerald-100/80 text-emerald-600">
              <Icon icon={CheckCircle2} size={24} />
            </div>
            <p className="text-[16px] font-bold text-emerald-800">{t("allDone")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <TaskRow icon={ClipboardCheck} tone="bg-amber-100/50 text-amber-600 ring-1 ring-amber-200/50" count={tasks?.casesToReview ?? 0} label={t("casesToReview")} onClick={() => navigate("/teach/cases/review")} />
            <TaskRow icon={FileClock} tone="bg-blue-100/50 text-blue-600 ring-1 ring-blue-200/50" count={tasks?.contentToApprove ?? 0} label={t("contentToApprove")} onClick={() => navigate("/teach/tasks")} />
            <TaskRow icon={UserX} tone="bg-rose-100/50 text-rose-600 ring-1 ring-rose-200/50" count={tasks?.studentsBehind ?? 0} label={t("studentsBehind")} onClick={firstCourseId ? () => navigate(`/teach/courses/${firstCourseId}/progress`) : undefined} />
          </div>
        )}
      </section>

      {/* Analytics */}
      {stats && (
        <section>
          <h2 className="mb-4 text-[22px] font-black text-ink drop-shadow-sm">{t("analytics")}</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricCard ring={stats.avgProgress} tone="brand" label={t("statAvgProgress")} sublabel={t("statStudentsN", { n: stats.students })} />
            <MetricCard ring={stats.avgAttendance ?? 0} tone="blue" label={t("statAttendance")} sublabel={stats.avgAttendance === null ? "—" : undefined} />
            <MetricCard ring={publishedPct} tone="emerald" label={t("statTopics")} sublabel={`${stats.publishedTopics}/${stats.totalTopics}`} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Per-course progress bars */}
            {dash.data && dash.data.courses.length > 0 && (
              <div className="rounded-[24px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-black/5">
                <p className="mb-4 text-[15px] font-black uppercase tracking-widest text-ink-soft">{t("byCourse")}</p>
                <div className="space-y-1">
                  {dash.data.courses.map((c) => (
                    <BarRow
                      key={c.id}
                      label={c.subjectName}
                      value={c.avgProgress}
                      onClick={() => navigate(`/teach/courses/${c.id}/progress`)}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Upcoming sessions */}
            {dash.data?.upcomingSessions && dash.data.upcomingSessions.length > 0 && (
              <div className="rounded-[24px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-black/5">
                <p className="mb-4 text-[15px] font-black uppercase tracking-widest text-ink-soft">{t("upcoming")}</p>
                <div className="space-y-3">
                  {dash.data.upcomingSessions.map((s) => (
                    <button key={s.id} onClick={() => navigate(s.groupId ? `/teach/groups/${s.groupId}?tab=sessions` : `/teach/courses/${s.courseId}`)} className="group flex w-full items-center gap-4 rounded-[16px] border border-white/50 bg-white/50 p-4 text-left shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:bg-white/80 hover:shadow-md">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft text-brand-deep shadow-inner ring-1 ring-brand/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                        <Icon icon={CalendarDays} size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-bold text-ink transition-colors duration-300 group-hover:text-brand-tint">{s.title ?? s.subjectName}</p>
                        <p className="mt-0.5 truncate text-[14px] font-medium text-ink-soft">{s.subjectName}{s.room ? ` · ${s.room}` : ""}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[13.5px] font-bold text-ink-soft shadow-sm ring-1 ring-black/5">{formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reyting: eng yuqori / orqada qolganlar */}
          {dash.data && (dash.data.ranking.top.length > 0 || dash.data.ranking.behind.length > 0) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <RankingCard
                title={t("rankTop")}
                icon={Trophy}
                tone="text-emerald-500"
                rows={dash.data.ranking.top}
                emptyText={t("rankEmpty")}
                onPick={(id) => navigate(`/teach/students/${id}`)}
              />
              <RankingCard
                title={t("rankBehind")}
                icon={UserX}
                tone="text-rose-500"
                rows={dash.data.ranking.behind}
                emptyText={t("rankNoBehind")}
                onPick={(id) => navigate(`/teach/students/${id}`)}
              />
            </div>
          )}

          {/* Clickable group chips */}
          {stats.groupList.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2.5 rounded-[20px] bg-surface p-5 ring-1 ring-line">
              <span className="inline-flex items-center gap-2 text-[14px] font-bold text-ink-soft uppercase tracking-wider">
                <Icon icon={Users2} size={16} /> {t("myGroups")}:
              </span>
              {stats.groupList.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/teach/groups/${g.id}`)}
                  className="rounded-full bg-surface-raised px-4 py-1.5 text-[14px] font-bold text-ink-soft shadow-sm ring-1 ring-line transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-soft hover:text-brand-deep hover:shadow-md hover:ring-brand/20"
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Courses preview */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[22px] font-black text-ink drop-shadow-sm">{t("myCourses")}</h2>
          <button onClick={() => navigate("/teach/courses")} className="rounded-full bg-surface-raised px-5 py-2 text-[14.5px] font-bold text-brand shadow-sm ring-1 ring-line transition-all hover:bg-brand-soft hover:ring-brand/20">
            {t("seeAll")} &rarr;
          </button>
        </div>
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={courses.length === 0}
          emptyIcon={<Icon icon={BookOpen} size={24} />}
          emptyText={t("empty")}
          onRetry={() => list.refetch()}
        >
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 3).map((c) => (
              <li key={c.id}>
                <CourseCard course={c} avgProgress={dash.data?.courses.find((d) => d.id === c.id)?.avgProgress ?? 0} />
              </li>
            ))}
          </ul>
        </AsyncSection>
      </section>
    </div>
  );
}
