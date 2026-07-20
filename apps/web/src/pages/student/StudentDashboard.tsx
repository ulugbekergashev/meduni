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
  DoorOpen,
  GraduationCap,
  Layers,
  Medal,
  PlayCircle,
  Sparkles,
  Stethoscope,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Card, EmptyState, Icon, ProgressBar, ProgressRing, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { HeroCard, HeroTile, RailCard } from "../../components/HeroStats";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import {
  useMyActivity,
  useMyDashboard,
  useMyProfile,
  useMyRank,
  useMySchedule,
  useMyTasks,
  useSetMyTaskDone,
  type ActivityType,
  type CourseSummary,
} from "./api";

const ACTIVITY_META: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  topic_completed: { icon: CheckCircle2, tone: "bg-emerald-soft text-emerald" },
  topic_activity: { icon: PlayCircle, tone: "bg-brand-soft text-brand-deep" },
  quiz_passed: { icon: ClipboardList, tone: "bg-blue-soft text-blue" },
  quiz_failed: { icon: ClipboardList, tone: "bg-rose-soft text-rose" },
  case_submitted: { icon: Stethoscope, tone: "bg-violet-soft text-violet" },
  case_graded: { icon: Medal, tone: "bg-emerald-soft text-emerald" },
};

const AUTO_META: Record<string, { icon: LucideIcon; labelKey: string; tone: string }> = {
  study: { icon: PlayCircle, labelKey: "study", tone: "bg-brand-soft text-brand-deep" },
  quiz_todo: { icon: ClipboardList, labelKey: "quizTodo", tone: "bg-blue-soft text-blue" },
  case_todo: { icon: Stethoscope, labelKey: "caseTodo", tone: "bg-rose-soft text-rose" },
  case_graded: { icon: CheckCircle2, labelKey: "caseGraded", tone: "bg-emerald-soft text-emerald" },
  attendance_low: { icon: CalendarCheck2, labelKey: "attendanceLow", tone: "bg-amber-soft text-amber" },
};

/** Harakat qatori — vazifa, topshiriq yoki dars. */
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
      className={cls("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors", onClick && "hover:bg-bg")}
    >
      <div className={cls("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold text-ink">{title}</p>
        {sub && <p className="truncate text-note text-ink-faint">{sub}</p>}
      </div>
      {right && <span className="shrink-0 text-note font-semibold text-ink-soft">{right}</span>}
      {onClick && <Icon icon={ArrowRight} size={15} className="shrink-0 text-ink-faint" />}
    </Wrapper>
  );
}

function CourseCard({ course }: { course: CourseSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const navigate = useNavigate();

  return (
    <Card interactive onClick={() => navigate(`/app/courses/${course.id}`)} className="flex flex-col gap-2.5 !p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-body font-bold text-ink">{course.subjectName}</h3>
          <p className="truncate text-note text-ink-faint">{course.teacherName}</p>
        </div>
        <span className="shrink-0 text-[17px] font-bold tabular-nums text-brand-deep">{course.progressPct}%</span>
      </div>
      <ProgressBar value={course.progressPct} />
      <div className="flex items-center justify-between gap-2 text-note text-ink-soft">
        <span>
          {course.topicsCompleted}/{course.topicsTotal} {t("topics")}
        </span>
        {course.nextTopicId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/topics/${course.nextTopicId}`);
            }}
            className="inline-flex items-center gap-1 font-semibold text-brand-deep hover:underline"
          >
            {t("continue")} <Icon icon={ArrowRight} size={13} />
          </button>
        )}
      </div>
    </Card>
  );
}

export function StudentDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "tasks" });
  const locale = useLocale();
  const navigate = useNavigate();

  const q = useMyDashboard();
  const profile = useMyProfile();
  const tasksQ = useMyTasks();
  const scheduleQ = useMySchedule();
  const rankQ = useMyRank();
  const activityQ = useMyActivity();
  const done = useSetMyTaskDone();

  const d = q.data;
  const p = profile.data;
  const auto = tasksQ.data?.auto ?? [];
  const assigned = tasksQ.data?.assigned ?? [];
  const schedule = scheduleQ.data ?? [];
  const rank = rankQ.data;
  const activity = activityQ.data ?? [];

  const overallPct =
    d && d.courses.length > 0
      ? Math.round(d.courses.reduce((sum, c) => sum + c.progressPct, 0) / d.courses.length)
      : 0;
  const newest = d?.courses[0];
  const currentCourses = (d?.courses ?? []).filter(
    (c) => newest && c.academicYear === newest.academicYear && c.semester === newest.semester
  );
  const hasToday = !!d?.resume || auto.length > 0 || assigned.length > 0;
  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");

  return (
    <div>
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
            {/* Hero — salom + xulosa, butun kenglik */}
            <HeroCard
              title={`${t("hello")}, ${d.fullName.split(" ")[0]}`}
              subtitle={today}
              left={
                <button
                  onClick={() => navigate("/app/courses")}
                  title={t("overall")}
                  className="rounded-full transition-transform hover:scale-105"
                >
                  <ProgressRing value={overallPct} size={72} stroke={8} label={t("overall")} />
                </button>
              }
            >
                <HeroTile
                  icon={Layers}
                  value={`${d.courses.reduce((s, c) => s + c.topicsCompleted, 0)}/${d.courses.reduce((s, c) => s + c.topicsTotal, 0)}`}
                  label={t("summaryTopics")}
                  tone="bg-emerald-soft text-emerald"
                  onClick={() => navigate("/app/courses")}
                />
                <HeroTile
                  icon={CalendarCheck2}
                  value={p?.attendancePct !== null && p?.attendancePct !== undefined ? `${p.attendancePct}%` : "—"}
                  label={t("summaryAttendance")}
                  tone={
                    p?.attendancePct !== null && p?.attendancePct !== undefined && p.attendancePct < 75
                      ? "bg-rose-soft text-rose"
                      : "bg-blue-soft text-blue"
                  }
                  onClick={() => navigate("/app/attendance")}
                />
                <HeroTile
                  icon={BookOpen}
                  value={String(d.courses.length)}
                  label={t("summaryCourses")}
                  tone="bg-brand-soft text-brand-deep"
                  onClick={() => navigate("/app/courses")}
                />
                <HeroTile
                  icon={Trophy}
                  value={rank?.rank ? `${rank.rank}/${rank.total}` : "—"}
                  label={t("summaryRank")}
                  tone="bg-amber-soft text-amber"
                  onClick={() => navigate("/app/grades")}
                />
            </HeroCard>

            {/* Asosiy maydon: chapda ish, o'ngda kontekst */}
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-5">
                {/* Davom ettirish — ixcham gorizontal */}
                {d.resume && (
                  <div className="flex flex-wrap items-center gap-4 rounded-card bg-gradient-to-br from-brand-deep to-brand p-4 text-white shadow-md">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-bold uppercase tracking-wide text-white/70">
                        {t("continueLabel")}
                      </p>
                      <h2 className="mt-0.5 truncate text-[19px] font-bold leading-tight">{d.resume.topic}</h2>
                      <p className="truncate text-note text-white/85">{d.resume.subjectName}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-pill bg-white/25">
                          <span
                            className="block h-full rounded-pill bg-white"
                            style={{ width: `${Math.max(d.resume.pct, 3)}%` }}
                          />
                        </span>
                        <span className="text-[12.5px] text-white/85">{d.resume.pct}%</span>
                      </div>
                    </div>
                    <Link to={`/app/topics/${d.resume.topicId}`} className="shrink-0">
                      <button className="flex items-center gap-2 rounded-control bg-white px-4 py-2.5 text-body font-bold text-brand-deep transition-all hover:bg-white/90">
                        <Icon icon={PlayCircle} size={17} />
                        {t("continue")}
                      </button>
                    </Link>
                  </div>
                )}

                {/* Bugun — konkret vazifa qatorlari */}
                <Card className="p-0">
                  <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                    <p className="flex-1 text-note font-bold uppercase tracking-wide text-ink-soft">{t("todayTitle")}</p>
                    <button
                      onClick={() => navigate("/app/tasks")}
                      className="text-note font-semibold text-brand-deep hover:underline"
                    >
                      {t("seeAllCourses")}
                    </button>
                  </div>
                  {hasToday ? (
                    <div className="divide-y divide-line">
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
                      {auto.flatMap((task) => {
                        const meta = AUTO_META[task.type];
                        if (!meta) return [];
                        const items = task.items ?? [];
                        if (items.length === 0)
                          return [
                            <ActionRow
                              key={task.type}
                              icon={meta.icon}
                              tone={meta.tone}
                              title={tt(meta.labelKey)}
                              sub={`${task.count}%`}
                              onClick={() => navigate(task.link)}
                            />,
                          ];
                        return items.map((it, i) => (
                          <ActionRow
                            key={`${task.type}-${i}`}
                            icon={meta.icon}
                            tone={meta.tone}
                            title={`${tt(meta.labelKey)}: ${it.topicTitle}`}
                            sub={it.courseName}
                            right={it.value !== undefined && it.value !== null ? String(it.value) : undefined}
                            onClick={() => navigate(it.link)}
                          />
                        ));
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-5">
                      <Icon icon={Sparkles} size={20} className="text-emerald" />
                      <p className="text-body font-semibold text-emerald">{tt("studentAllDone")}</p>
                    </div>
                  )}
                </Card>

                {/* Joriy semestr kurslari */}
                {currentCourses.length > 0 && (
                  <div>
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <h2 className="text-section font-bold text-ink">{t("currentCourses")}</h2>
                      <Link to="/app/courses" className="text-note font-semibold text-brand-deep hover:underline">
                        {t("seeAllCourses")} →
                      </Link>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {currentCourses.slice(0, 6).map((c) => (
                        <CourseCard key={c.id} course={c} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* O'ng ustun — jadval, bildirishnoma, faollik */}
              <aside className="min-w-0 space-y-5">
                <RailCard
                  title={t("upcomingLessons")}
                  icon={CalendarDays}
                  action={{ label: t("seeAllCourses"), onClick: () => navigate("/app/schedule") }}
                >
                  {schedule.length === 0 ? (
                    <p className="px-4 py-4 text-note text-ink-faint">{t("noLessons")}</p>
                  ) : (
                    <div className="divide-y divide-line">
                      {schedule.slice(0, 4).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => navigate("/app/schedule")}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg"
                        >
                          <div className="w-10 shrink-0 text-center">
                            <p className="text-[16px] font-bold leading-none tabular-nums text-brand-deep">
                              {new Date(s.date).getDate()}
                            </p>
                            <p className="mt-0.5 text-[11.5px] tabular-nums text-ink-faint">
                              {`${String(new Date(s.date).getHours()).padStart(2, "0")}:${String(new Date(s.date).getMinutes()).padStart(2, "0")}`}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1 border-l border-line pl-3">
                            <p className="truncate text-body font-semibold text-ink">{s.title ?? s.courseName}</p>
                            <p className="flex items-center gap-1.5 truncate text-note text-ink-faint">
                              {s.courseName}
                              {s.room && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Icon icon={DoorOpen} size={11} /> {s.room}
                                </span>
                              )}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </RailCard>

                {d.notifications.length > 0 && (
                  <RailCard title={t("notifications")} icon={ClipboardCheck}>
                    <div className="divide-y divide-line">
                      {d.notifications.slice(0, 4).map((n) => (
                        <button
                          key={n.caseAttemptId}
                          onClick={() => navigate(`/app/topics/${n.topicId}?tab=case`)}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-bg"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-soft text-emerald">
                            <Icon icon={ClipboardCheck} size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body font-semibold text-ink">{t("caseGraded")}</p>
                            <p className="truncate text-note text-ink-faint">{n.topic}</p>
                          </div>
                          {n.score !== null && (
                            <span className="shrink-0 text-body font-bold text-emerald">{n.score}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </RailCard>
                )}

                {activity.length > 0 && (
                  <RailCard title={t("recentActivity")} icon={Sparkles}>
                    <div className="divide-y divide-line">
                      {activity.slice(0, 5).map((a, i) => {
                        const m = ACTIVITY_META[a.type];
                        return (
                          <button
                            key={`${a.type}-${a.topicId}-${i}`}
                            onClick={() => navigate(`/app/topics/${a.topicId}`)}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-bg"
                          >
                            <div className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.tone)}>
                              <Icon icon={m.icon} size={13} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-note font-semibold text-ink">{t(`activity.${a.type}`)}</p>
                              <p className="truncate text-[12.5px] text-ink-faint">{a.topic}</p>
                            </div>
                            {a.score !== null && (
                              <span className="shrink-0 text-note font-bold tabular-nums text-ink-soft">{a.score}%</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </RailCard>
                )}
              </aside>
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
