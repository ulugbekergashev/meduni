import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, CalendarCheck, CalendarDays, CheckCircle2, ClipboardCheck, FileClock, FileStack, Layers, TrendingUp, Users, UserX, Users2 } from "lucide-react";
import { Card, Icon, Spinner } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { pickName, useLocale } from "../../lib/useLocale";
import { useMe } from "../../lib/auth";
import { useTeachCourses, useTeachDashboard } from "./api";
import { CourseCard } from "./CourseCard";

function StatTile({ icon, value, label, tone }: { icon: typeof Users; value: string | number; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon icon={icon} size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[22px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-0.5 truncate text-[12px] text-ink-soft">{label}</p>
      </div>
    </div>
  );
}

function TaskRow({ icon, tone, count, label, onClick }: { icon: typeof ClipboardCheck; tone: string; count: number; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-3 rounded-control border p-3 text-left transition-all ${tone} ${onClick ? "hover:-translate-y-0.5 hover:shadow-sm" : "cursor-default"}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/60">
        <Icon icon={icon} size={17} />
      </div>
      <span className="text-[26px] font-bold tabular-nums leading-none">{count}</span>
      <span className="text-[13.5px] font-medium">{label}</span>
    </button>
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
  const today = new Date().toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ", { day: "numeric", month: "long", year: "numeric" });
  const firstCourseId = courses[0]?.id;
  const noTasks = tasks && tasks.casesToReview === 0 && tasks.contentToApprove === 0 && tasks.studentsBehind === 0;

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">
        {t("hello")}, {me?.full_name?.split(" ")[0]}
      </h1>
      <p className="mt-0.5 text-[13px] text-ink-faint">{today}</p>

      {/* Tasks */}
      <section className="mt-6">
        <h2 className="mb-3 text-section font-bold text-ink">{t("tasks")}</h2>
        {dash.isLoading ? (
          <div className="flex h-24 items-center justify-center"><Spinner size={22} /></div>
        ) : noTasks ? (
          <Card className="flex items-center gap-3 border-emerald/40 bg-emerald-soft">
            <Icon icon={CheckCircle2} size={22} className="text-emerald" />
            <p className="text-[14px] font-semibold text-emerald">{t("allDone")}</p>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-3">
            <TaskRow icon={ClipboardCheck} tone="border-amber/30 bg-amber-soft text-amber" count={tasks?.casesToReview ?? 0} label={t("casesToReview")} onClick={() => navigate("/teach/cases/review")} />
            <TaskRow icon={FileClock} tone="border-blue/30 bg-blue-soft text-blue" count={tasks?.contentToApprove ?? 0} label={t("contentToApprove")} onClick={firstCourseId ? () => navigate(`/teach/courses/${firstCourseId}/topics`) : undefined} />
            <TaskRow icon={UserX} tone="border-rose/30 bg-rose-soft text-rose" count={tasks?.studentsBehind ?? 0} label={t("studentsBehind")} onClick={firstCourseId ? () => navigate(`/teach/courses/${firstCourseId}/progress`) : undefined} />
          </div>
        )}
      </section>

      {/* My statistics */}
      {dash.data?.stats && (
        <section className="mt-8">
          <h2 className="mb-3 text-section font-bold text-ink">{t("myStats")}</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <StatTile icon={Users} value={dash.data.stats.students} label={t("statStudents")} tone="bg-blue-soft text-blue" />
            <StatTile icon={Layers} value={`${dash.data.stats.publishedTopics}/${dash.data.stats.totalTopics}`} label={t("statTopics")} tone="bg-emerald-soft text-emerald" />
            <StatTile icon={FileStack} value={dash.data.stats.publishedContent} label={t("statContent")} tone="bg-violet-soft text-violet" />
            <StatTile icon={ClipboardCheck} value={dash.data.stats.casesReviewed} label={t("statReviewed")} tone="bg-amber-soft text-amber" />
            <StatTile icon={TrendingUp} value={`${dash.data.stats.avgProgress}%`} label={t("statAvgProgress")} tone="bg-brand-soft text-brand-deep" />
            <StatTile icon={CalendarCheck} value={dash.data.stats.avgAttendance !== null ? `${dash.data.stats.avgAttendance}%` : "—"} label={t("statAttendance")} tone="bg-blue-soft text-blue" />
          </div>

          {/* Groups taught */}
          {dash.data.stats.groups.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft">
                <Icon icon={Users2} size={15} /> {t("myGroups")}:
              </span>
              {dash.data.stats.groups.map((g) => (
                <span key={g} className="rounded-pill bg-slate-100 px-2.5 py-0.5 text-[12.5px] font-medium text-ink-soft">{g}</span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Upcoming sessions */}
      {dash.data?.upcomingSessions && dash.data.upcomingSessions.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-section font-bold text-ink">{t("upcoming")}</h2>
          <div className="space-y-2">
            {dash.data.upcomingSessions.map((s) => (
              <button key={s.id} onClick={() => navigate(`/teach/courses/${s.courseId}/sessions`)} className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                  <Icon icon={CalendarDays} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{s.title ?? pickName(locale, s.subjectNameUz, s.subjectNameRu)}</p>
                  <p className="truncate text-[12px] text-ink-faint">{pickName(locale, s.subjectNameUz, s.subjectNameRu)}{s.room ? ` · ${s.room}` : ""}</p>
                </div>
                <span className="shrink-0 text-[12.5px] font-medium text-ink-soft">{new Date(s.date).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ", { day: "2-digit", month: "short" })}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Courses preview (full list lives in the Courses module) */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-section font-bold text-ink">{t("myCourses")}</h2>
          <button onClick={() => navigate("/teach/courses")} className="text-[13px] font-semibold text-brand-deep hover:underline">{t("seeAll")} →</button>
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
