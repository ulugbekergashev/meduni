import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Layers,
  PlayCircle,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { Card, EmptyState, Icon, ProgressRing, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { PeriodSection, groupByPeriod } from "../../components/PeriodGroups";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import {
  useMyDashboard,
  useMyProfile,
  useMySchedule,
  useMyTasks,
  useSetMyTaskDone,
  type CourseSummary,
} from "./api";

function ProgressBar({ pct, tone = "brand" }: { pct: number; tone?: "brand" | "white" }) {
  return (
    <div className={tone === "white" ? "h-2 w-full overflow-hidden rounded-pill bg-white/25" : "h-2 w-full overflow-hidden rounded-pill bg-bg"}>
      <div
        className={tone === "white" ? "h-full rounded-pill bg-white transition-all" : "h-full rounded-pill bg-brand transition-all"}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

function CourseCard({ course }: { course: CourseSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const navigate = useNavigate();
  const next = course.nextTopicId ? course.nextTopic : null;

  return (
    <Card interactive onClick={() => navigate(`/app/courses/${course.id}`)} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-section font-bold text-ink">{course.subjectName}</h3>
          <p className="truncate text-[13.5px] text-ink-faint">{course.teacherName}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          <Icon icon={BookOpen} size={18} />
        </div>
      </div>

      <div className="space-y-1.5">
        <ProgressBar pct={course.progressPct} />
        <div className="flex items-center justify-between text-[13px] text-ink-soft">
          <span>{course.progressPct}%</span>
          <span>
            {course.topicsCompleted}/{course.topicsTotal} {t("topics")}
          </span>
        </div>
      </div>

      {next && (
        <p className="truncate text-[13.5px] text-ink-soft">
          <span className="text-ink-faint">{t("nextTopic")}: </span>
          {next}
        </p>
      )}
    </Card>
  );
}

function SummaryTile({ icon, value, label, tone }: { icon: LucideIcon; value: string; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[18px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-ink-soft">{label}</p>
      </div>
    </div>
  );
}

/** "Bugun" ro'yxatining bitta qatori — vazifa, topshiriq yoki dars. */
function ActionRow({
  icon,
  tone,
  title,
  sub,
  right,
  onClick,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  sub?: string;
  right?: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cls(
        "flex w-full items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left shadow-card transition-all",
        onClick && "hover:-translate-y-0.5 hover:shadow-card-hover"
      )}
    >
      <div className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{title}</p>
        {sub && <p className="truncate text-[13px] text-ink-faint">{sub}</p>}
      </div>
      {right && <span className="shrink-0 text-[13px] font-semibold text-ink-soft">{right}</span>}
      {onClick && <Icon icon={ArrowRight} size={15} className="shrink-0 text-ink-faint" />}
    </Wrapper>
  );
}

const AUTO_META: Record<string, { icon: LucideIcon; labelKey: string; tone: string }> = {
  study: { icon: PlayCircle, labelKey: "study", tone: "bg-brand-soft text-brand-deep" },
  quiz_todo: { icon: ClipboardList, labelKey: "quizTodo", tone: "bg-blue-soft text-blue" },
  case_todo: { icon: Stethoscope, labelKey: "caseTodo", tone: "bg-rose-soft text-rose" },
  case_graded: { icon: CheckCircle2, labelKey: "caseGraded", tone: "bg-emerald-soft text-emerald" },
  attendance_low: { icon: CalendarCheck2, labelKey: "attendanceLow", tone: "bg-amber-soft text-amber" },
};

export function StudentDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "tasks" });
  const locale = useLocale();
  const navigate = useNavigate();

  const q = useMyDashboard();
  const profile = useMyProfile();
  const tasksQ = useMyTasks();
  const scheduleQ = useMySchedule();
  const done = useSetMyTaskDone();

  const d = q.data;
  const p = profile.data;
  const auto = tasksQ.data?.auto ?? [];
  const assigned = tasksQ.data?.assigned ?? []; // backend faqat OPEN qaytaradi
  const schedule = scheduleQ.data ?? [];
  const overallPct =
    d && d.courses.length > 0
      ? Math.round(d.courses.reduce((sum, c) => sum + c.progressPct, 0) / d.courses.length)
      : 0;

  const hasToday = !!d?.resume || auto.length > 0 || assigned.length > 0 || schedule.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <AsyncSection
        isLoading={q.isLoading}
        isError={q.isError}
        isEmpty={!!d && d.courses.length === 0}
        emptyIcon={<Icon icon={GraduationCap} size={22} />}
        emptyText={t("noCourses")}
        onRetry={() => q.refetch()}
      >
        {d && (
          <>
            <h1 className="text-h1 font-bold text-ink">
              {t("hello")}, {d.fullName.split(" ")[0]}
            </h1>

            {/* Overall summary: ring + tiles */}
            {d.courses.length > 0 && (
              <Card className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-4 !p-5">
                <ProgressRing value={overallPct} size={96} stroke={10} label={t("overall")} />
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                  <SummaryTile
                    icon={Layers}
                    value={`${d.courses.reduce((s, c) => s + c.topicsCompleted, 0)}/${d.courses.reduce((s, c) => s + c.topicsTotal, 0)}`}
                    label={t("summaryTopics")}
                    tone="bg-emerald-soft text-emerald"
                  />
                  <SummaryTile
                    icon={CalendarCheck2}
                    value={p?.attendancePct !== null && p?.attendancePct !== undefined ? `${p.attendancePct}%` : "—"}
                    label={t("summaryAttendance")}
                    tone={
                      p?.attendancePct !== null && p?.attendancePct !== undefined && p.attendancePct < 75
                        ? "bg-rose-soft text-rose"
                        : "bg-blue-soft text-blue"
                    }
                  />
                  <SummaryTile
                    icon={BookOpen}
                    value={String(d.courses.length)}
                    label={t("summaryCourses")}
                    tone="bg-brand-soft text-brand-deep"
                  />
                </div>
              </Card>
            )}

            {/* BUGUN — harakat markazi: davom ettirish + vazifalar + jadval */}
            <section className="mt-7">
              <h2 className="mb-3 text-section font-bold text-ink">{t("todayTitle")}</h2>

              {d.resume && (
                <div className="rounded-card bg-gradient-to-br from-brand-deep to-brand p-5 text-white shadow-md">
                  <p className="text-[13.5px] font-medium uppercase tracking-wide text-white/70">{t("continueLabel")}</p>
                  <p className="mt-1 text-[14px] text-white/85">{d.resume.subjectName}</p>
                  <h3 className="mt-0.5 text-[20px] font-bold leading-tight">{d.resume.topic}</h3>
                  <div className="mt-3">
                    <ProgressBar pct={d.resume.pct} tone="white" />
                    <p className="mt-1.5 text-[13px] text-white/80">
                      {d.resume.pct}% {t("done")}
                    </p>
                  </div>
                  <Link to={`/app/topics/${d.resume.topicId}`} className="mt-4 block">
                    <button className="flex w-full items-center justify-center gap-2 rounded-control bg-white px-4 py-3 text-[16px] font-bold text-brand-deep transition-all hover:bg-white/90">
                      <Icon icon={PlayCircle} size={19} />
                      {t("continue")}
                    </button>
                  </Link>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {/* O'qituvchi topshiriqlari — birinchi navbatda */}
                {assigned.map((a) => (
                  <ActionRow
                    key={`as${a.id}`}
                    icon={ClipboardCheck}
                    tone="bg-violet-soft text-violet"
                    title={a.title}
                    sub={
                      a.dueDate
                        ? `${tt("dueShort")}: ${formatDate(locale === "ru" ? "ru" : "uz", a.dueDate, "short")}`
                        : tt("fromTeacher")
                    }
                    right={done.isPending && done.variables === a.id ? "…" : tt("markDone")}
                    onClick={() => done.mutate(a.id)}
                  />
                ))}

                {/* Avto o'quv vazifalari — to'g'ridan kerakli tabga */}
                {auto.map((task) => {
                  const meta = AUTO_META[task.type];
                  if (!meta) return null;
                  return (
                    <ActionRow
                      key={task.type}
                      icon={meta.icon}
                      tone={meta.tone}
                      title={tt(meta.labelKey)}
                      sub={task.type === "attendance_low" ? `${task.count}%` : `${task.count}`}
                      onClick={() => navigate(task.link)}
                    />
                  );
                })}

                {/* Kelgusi darslar */}
                {schedule.slice(0, 3).map((s) => (
                  <ActionRow
                    key={`sc${s.id}`}
                    icon={CalendarDays}
                    tone="bg-bg text-ink-soft"
                    title={s.title ?? s.courseName}
                    sub={[s.courseName, s.room].filter(Boolean).join(" · ")}
                    right={formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")}
                  />
                ))}

                {!hasToday && !tasksQ.isLoading && (
                  <Card className="flex items-center gap-3 border-emerald/40 bg-emerald-soft">
                    <Icon icon={Sparkles} size={22} className="text-emerald" />
                    <p className="text-body font-semibold text-emerald">{tt("studentAllDone")}</p>
                  </Card>
                )}
              </div>
            </section>

            {/* Notifications */}
            {d.notifications.length > 0 && (
              <div className="mt-8">
                <h2 className="text-section font-bold text-ink">{t("notifications")}</h2>
                <div className="mt-3 space-y-2">
                  {d.notifications.map((n) => (
                    <Link key={n.caseAttemptId} to={`/app/topics/${n.topicId}?tab=case`}>
                      <Card interactive className="flex items-center gap-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-soft text-emerald">
                          <Icon icon={ClipboardCheck} size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] font-semibold text-ink">{t("caseGraded")}</p>
                          <p className="truncate text-[13px] text-ink-soft">{n.topic}</p>
                        </div>
                        {n.score !== null && <span className="text-[16px] font-bold text-emerald">{n.score}</span>}
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* My courses — davrlar bo'yicha: joriy semestr ochiq, eskilari arxiv */}
            <div className="mt-8">
              <h2 className="text-section font-bold text-ink">{t("myCourses")}</h2>
              <div className="mt-3">
                {groupByPeriod(d.courses).map((g, i) => (
                  <PeriodSection
                    key={g.year}
                    group={g}
                    defaultOpen={i === 0}
                    renderRows={(rows) => (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {rows.map((c) => (
                          <CourseCard key={c.id} course={c} />
                        ))}
                      </div>
                    )}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </AsyncSection>

      {d && d.courses.length === 0 && (
        <p className="mt-3 text-center text-[14px] text-ink-faint">{t("adminWillAdd")}</p>
      )}

      {!d && !q.isLoading && !q.isError && (
        <EmptyState icon={<Icon icon={ArrowRight} size={22} />} text={t("noCourses")} />
      )}
    </div>
  );
}
