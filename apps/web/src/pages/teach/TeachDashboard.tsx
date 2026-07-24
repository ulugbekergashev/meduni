import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  BookOpen, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, FileClock,
  ListChecks, Trophy, Users2, UserX, type LucideIcon,
} from "lucide-react";
import { BarRow, Button, Card, Icon, ProgressBar, ProgressRing, Spinner, StatCard, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useMe } from "../../lib/auth";
import { useTeacherLessons, useTeachCourses, useTeachDashboard, type DerivedLesson, type RankedStudent } from "./api";
import { RollCallModal } from "./course/attendance/RollCallModal";
import { CourseCard } from "./CourseCard";

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Tez o'tish kartasi — ikonka-chip + yorliq. */
function QuickAction({ icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone: string; onClick: () => void }) {
  return (
    <Card interactive onClick={onClick} className="flex items-center gap-3">
      <div className={cls("flex h-11 w-11 shrink-0 items-center justify-center rounded-control", tone)}>
        <Icon icon={icon} size={20} />
      </div>
      <span className="text-note font-semibold text-ink">{label}</span>
      <Icon icon={ChevronRight} size={16} className="ml-auto text-ink-faint" />
    </Card>
  );
}

/** Reyting kartasi — eng yuqori yoki orqada qolgan talabalar. */
function RankingCard({ title, icon, tone, rows, emptyText, onPick }: {
  title: string; icon: LucideIcon; tone: string; rows: RankedStudent[]; emptyText: string; onPick: (id: number) => void;
}) {
  return (
    <Card className="flex flex-col !p-0">
      <p className={cls("flex items-center gap-2 border-b border-line px-4 py-3 text-note font-bold", tone)}>
        <Icon icon={icon} size={17} /> {title}
      </p>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-note text-ink-faint">{emptyText}</p>
      ) : (
        <div className="divide-y divide-line">
          {rows.map((r, i) => (
            <button key={r.id} onClick={() => onPick(r.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg">
              <span className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-bold tabular-nums", i < 3 ? "bg-brand-soft text-brand-deep" : "bg-bg text-ink-faint")}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-note font-semibold text-ink">{r.fullName}</span>
              <ProgressBar value={r.overallPct} className="hidden w-24 shrink-0 sm:block" tone={r.behind ? "rose" : "emerald"} />
              <span className="w-10 shrink-0 text-right text-note font-bold tabular-nums text-ink-soft">{r.overallPct}%</span>
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
  const todayKey = dayKeyLocal(new Date());
  const todaySessions = useTeacherLessons({ from: todayKey, to: todayKey });
  const [mark, setMark] = useState<DerivedLesson | null>(null);
  const tasks = dash.data?.tasks;
  const stats = dash.data?.stats;
  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");
  const firstCourseId = courses[0]?.id;
  const noTasks = tasks && tasks.casesToReview === 0 && tasks.contentToApprove === 0 && tasks.studentsBehind === 0;
  const publishedPct = stats && stats.totalTopics > 0 ? Math.round((stats.publishedTopics / stats.totalTopics) * 100) : 0;

  return (
    <div className="space-y-4 pb-8">
      {/* Hero — gradient urg'u band (faqat aksent) */}
      <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-deep via-brand to-violet px-6 py-6 text-white shadow-card sm:px-8">
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-h1 font-extrabold leading-tight">{t("hello")}, {me?.full_name?.split(" ")[0]}</h1>
            <p className="mt-1 text-note text-white/85">{today}</p>
          </div>
          {stats && (
            <div className="flex gap-2.5">
              {[
                { v: stats.students, l: t("statStudents") },
                { v: stats.courses, l: t("qaCourses") },
                { v: stats.groupList.length, l: t("qaGroups") },
              ].map((s) => (
                <div key={s.l} className="min-w-[76px] rounded-control bg-white/15 px-3 py-2">
                  <p className="text-stat font-extrabold leading-none tabular-nums">{s.v}</p>
                  <p className="mt-1 text-micro font-semibold uppercase tracking-wider text-white/85">{s.l}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tez o'tish */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <QuickAction icon={ListChecks} label={t("qaTasks")} tone="bg-brand-soft text-brand-deep" onClick={() => navigate("/teach/tasks")} />
        <QuickAction icon={ClipboardCheck} label={t("qaReview")} tone="bg-amber-soft text-amber" onClick={() => navigate("/teach/cases/review")} />
        <QuickAction icon={BookOpen} label={t("qaCourses")} tone="bg-blue-soft text-blue" onClick={() => navigate("/teach/courses")} />
        <QuickAction icon={Users2} label={t("qaGroups")} tone="bg-violet-soft text-violet" onClick={() => navigate("/teach/groups")} />
      </div>

      {/* Bugungi darslar */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-section font-bold text-ink">{t("todayLessons")}</h2>
          <button onClick={() => navigate("/teach/schedule")} className="inline-flex items-center gap-0.5 text-note font-semibold text-brand-deep hover:text-brand">{t("allLessons")} <Icon icon={ChevronRight} size={14} /></button>
        </div>
        {todaySessions.isLoading ? (
          <div className="flex h-20 items-center justify-center"><Spinner size={22} /></div>
        ) : (todaySessions.data?.length ?? 0) === 0 ? (
          <Card className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-bg text-ink-faint"><Icon icon={CalendarDays} size={20} /></div>
            <p className="text-note font-medium text-ink-soft">{t("noTodayLessons")}</p>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {todaySessions.data!.map((s) => (
              <Card key={s.slotId + s.dayKey} className="flex items-center gap-3">
                <div className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-control", s.status === "FULL" ? "bg-emerald-soft text-emerald" : s.status === "PARTIAL" ? "bg-amber-soft text-amber" : "bg-brand-soft text-brand-deep")}>
                  <Icon icon={CalendarDays} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-note font-bold text-ink">{s.startTime} · {s.courseName}</p>
                  <p className="truncate text-micro text-ink-soft">{s.groupName ? `${s.groupName} · ` : ""}{s.room ? `${s.room} · ` : ""}{s.markedCount}/{s.rosterSize}</p>
                </div>
                <Button size="sm" variant={s.status === "FULL" ? "ghost" : "primary"} icon={<Icon icon={ClipboardCheck} size={15} />} onClick={() => setMark(s)}>{t("markAttendance")}</Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {mark && (
        <RollCallModal
          courseId={mark.courseId}
          date={mark.dayKey}
          startTime={mark.startTime}
          groupId={mark.groupId ?? undefined}
          heading={`${mark.startTime} · ${mark.courseName}${mark.groupName ? ` · ${mark.groupName}` : ""}`}
          onClose={() => setMark(null)}
        />
      )}

      {/* Vazifalar */}
      <section className="space-y-2.5">
        <h2 className="text-section font-bold text-ink">{t("tasks")}</h2>
        {dash.isLoading ? (
          <div className="flex h-24 items-center justify-center"><Spinner size={24} className="text-brand" /></div>
        ) : noTasks ? (
          <Card className="flex items-center gap-3 border-emerald/30 bg-emerald-soft">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-emerald/15 text-emerald"><Icon icon={CheckCircle2} size={20} /></div>
            <p className="text-note font-bold text-emerald">{t("allDone")}</p>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-3">
            <StatCard compact icon={ClipboardCheck} tone="bg-amber-soft text-amber" value={tasks?.casesToReview ?? 0} label={t("casesToReview")} onClick={() => navigate("/teach/cases/review")} />
            <StatCard compact icon={FileClock} tone="bg-blue-soft text-blue" value={tasks?.contentToApprove ?? 0} label={t("contentToApprove")} onClick={() => navigate("/teach/tasks")} />
            <StatCard compact icon={UserX} tone={(tasks?.studentsBehind ?? 0) > 0 ? "bg-rose-soft text-rose" : "bg-bg text-ink-faint"} value={tasks?.studentsBehind ?? 0} label={t("studentsBehind")} onClick={firstCourseId ? () => navigate(`/teach/courses/${firstCourseId}/progress`) : undefined} />
          </div>
        )}
      </section>

      {/* Analitika */}
      {stats && (
        <section className="space-y-2.5">
          <h2 className="text-section font-bold text-ink">{t("analytics")}</h2>
          <div className="grid gap-2.5 lg:grid-cols-3">
            {[
              { ring: stats.avgProgress, tone: "brand" as const, label: t("statAvgProgress"), sub: t("statStudentsN", { n: stats.students }) },
              { ring: stats.avgAttendance ?? 0, tone: "blue" as const, label: t("statAttendance"), sub: stats.avgAttendance === null ? "—" : undefined },
              { ring: publishedPct, tone: "emerald" as const, label: t("statTopics"), sub: `${stats.publishedTopics}/${stats.totalTopics}` },
            ].map((m) => (
              <Card key={m.label} className="flex items-center gap-4">
                <ProgressRing value={m.ring} tone={m.tone} size={64} stroke={7} />
                <div className="min-w-0">
                  <p className="text-body font-bold text-ink">{m.label}</p>
                  {m.sub && <p className="mt-0.5 text-note text-ink-soft">{m.sub}</p>}
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-2.5 lg:grid-cols-2">
            {dash.data && dash.data.courses.length > 0 && (
              <Card className="!p-0">
                <p className="border-b border-line px-4 py-3 text-note font-semibold uppercase tracking-wider text-ink-soft">{t("byCourse")}</p>
                <div className="space-y-1 p-3">
                  {dash.data.courses.map((c) => (
                    <BarRow key={c.id} label={c.subjectName} value={c.avgProgress} onClick={() => navigate(`/teach/courses/${c.id}/progress`)} />
                  ))}
                </div>
              </Card>
            )}

            {dash.data?.upcomingSessions && dash.data.upcomingSessions.length > 0 && (
              <Card className="!p-0">
                <p className="border-b border-line px-4 py-3 text-note font-semibold uppercase tracking-wider text-ink-soft">{t("upcoming")}</p>
                <div className="divide-y divide-line">
                  {dash.data.upcomingSessions.map((s) => (
                    <button key={s.id} onClick={() => navigate(s.groupId ? `/teach/groups/${s.groupId}?tab=sessions` : `/teach/courses/${s.courseId}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-deep"><Icon icon={CalendarDays} size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-note font-bold text-ink">{s.title ?? s.subjectName}</p>
                        <p className="truncate text-micro text-ink-soft">{s.subjectName}{s.room ? ` · ${s.room}` : ""}</p>
                      </div>
                      <span className="shrink-0 rounded-pill bg-bg px-2.5 py-0.5 text-micro font-semibold text-ink-soft">{formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {dash.data && (dash.data.ranking.top.length > 0 || dash.data.ranking.behind.length > 0) && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <RankingCard title={t("rankTop")} icon={Trophy} tone="text-emerald" rows={dash.data.ranking.top} emptyText={t("rankEmpty")} onPick={(id) => navigate(`/teach/students/${id}`)} />
              <RankingCard title={t("rankBehind")} icon={UserX} tone="text-rose" rows={dash.data.ranking.behind} emptyText={t("rankNoBehind")} onPick={(id) => navigate(`/teach/students/${id}`)} />
            </div>
          )}

          {stats.groupList.length > 0 && (
            <Card className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wider text-ink-soft"><Icon icon={Users2} size={15} /> {t("myGroups")}:</span>
              {stats.groupList.map((g) => (
                <button key={g.id} onClick={() => navigate(`/teach/groups/${g.id}`)} className="rounded-pill bg-bg px-3 py-1 text-micro font-semibold text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep">{g.name}</button>
              ))}
            </Card>
          )}
        </section>
      )}

      {/* Kurslar */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-section font-bold text-ink">{t("myCourses")}</h2>
          <button onClick={() => navigate("/teach/courses")} className="inline-flex items-center gap-0.5 text-note font-semibold text-brand-deep hover:text-brand">{t("seeAll")} <Icon icon={ChevronRight} size={14} /></button>
        </div>
        <AsyncSection isLoading={list.isLoading} isError={list.isError} isEmpty={courses.length === 0} emptyIcon={<Icon icon={BookOpen} size={24} />} emptyText={t("empty")} onRetry={() => list.refetch()}>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 3).map((c) => (
              <li key={c.id}><CourseCard course={c} avgProgress={dash.data?.courses.find((d) => d.id === c.id)?.avgProgress ?? 0} /></li>
            ))}
          </ul>
        </AsyncSection>
      </section>
    </div>
  );
}
