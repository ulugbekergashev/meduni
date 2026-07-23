import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Flame,
  GraduationCap,
  Layers,
  Medal,
  PlayCircle,
  Repeat,
  Sparkles,
  Stethoscope,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Card, EmptyState, Icon, ProgressRing, BarRow, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { HeroCard, HeroTile, RailCard } from "../../components/HeroStats";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import {
  useMyActivity,
  useMyAttendance,
  useMyDashboard,
  useMyGrades,
  useMyProfile,
  useMyRank,
  useMySchedule,
  useMyTasks,
  useReviewDue,
  useSetMyTaskDone,
  type ActivityType,
  type ScheduleItem,
} from "./api";

const ACTIVITY_META: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  topic_completed: { icon: CheckCircle2, tone: "bg-emerald-soft text-emerald" },
  topic_activity: { icon: PlayCircle, tone: "bg-brand-soft text-brand-tint" },
  quiz_passed: { icon: ClipboardList, tone: "bg-blue-soft text-blue" },
  quiz_failed: { icon: ClipboardList, tone: "bg-rose-soft text-rose" },
  case_submitted: { icon: Stethoscope, tone: "bg-violet-soft text-violet" },
  case_graded: { icon: Medal, tone: "bg-emerald-soft text-emerald" },
};

const AUTO_META: Record<string, { icon: LucideIcon; labelKey: string; tone: string }> = {
  study: { icon: PlayCircle, labelKey: "study", tone: "bg-brand-soft text-brand-tint" },
  quiz_todo: { icon: ClipboardList, labelKey: "quizTodo", tone: "bg-blue-soft text-blue" },
  case_todo: { icon: Stethoscope, labelKey: "caseTodo", tone: "bg-rose-soft text-rose" },
  case_graded: { icon: CheckCircle2, labelKey: "caseGraded", tone: "bg-emerald-soft text-emerald" },
  attendance_low: { icon: CalendarCheck2, labelKey: "attendanceLow", tone: "bg-amber-soft text-amber" },
};

function sameLocalDay(dateStr: string, now: Date): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function hhmm(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Bugungi (hali tugamagan) darslar, aks holda birinchi kelgusi kunning darslari. */
function pickSchedule(
  schedule: ScheduleItem[],
  now: Date
): { mode: "today" | "next"; date: string; sessions: ScheduleItem[] } | null {
  const todays = schedule.filter((s) => sameLocalDay(s.date, now));
  const todaysUpcoming = todays.filter((s) => !s.isPast);
  if (todaysUpcoming.length > 0) {
    return { mode: "today", date: now.toISOString(), sessions: todays };
  }
  const future = schedule
    .filter((s) => !s.isPast && new Date(s.date).getTime() > now.getTime() && !sameLocalDay(s.date, now))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (future.length > 0) {
    const first = new Date(future[0].date);
    const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const k = key(first);
    const sessions = future.filter((s) => key(new Date(s.date)) === k);
    return { mode: "next", date: future[0].date, sessions };
  }
  return null;
}

/** Harakat qatori — vazifa yoki topshiriq. */
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
      className={cls("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors", onClick && "hover:bg-surface-raised")}
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function StudentDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "tasks" });
  const { t: tp } = useTranslation(undefined, { keyPrefix: "period" });
  const locale = useLocale();
  const navigate = useNavigate();

  const q = useMyDashboard();
  const profile = useMyProfile();
  const tasksQ = useMyTasks();
  const scheduleQ = useMySchedule();
  const rankQ = useMyRank();
  const activityQ = useMyActivity();
  const attendanceQ = useMyAttendance(undefined, {});
  const gradesQ = useMyGrades();
  const reviewQ = useReviewDue();
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
  const currentIds = new Set(currentCourses.map((c) => c.id));

  // Joriy semestr davomati (byCourse ∩ joriy kurslar).
  const attRows = (attendanceQ.data?.byCourse ?? []).filter((r) => currentIds.has(r.courseId));
  const attMarked = attRows.reduce((s, r) => s + r.marked, 0);
  const attCame = attRows.reduce((s, r) => s + r.present + r.late, 0);
  const attMissed = attRows.reduce((s, r) => s + r.absent, 0);
  const attPct = attMarked > 0 ? Math.round((attCame / attMarked) * 100) : null;

  // Joriy semestr o'zlashtirishi.
  const masteryCourses = (gradesQ.data?.courses ?? []).filter((c) => currentIds.has(c.courseId));
  const masteryVals = masteryCourses.map((c) => c.avgQuiz).filter((v): v is number => v !== null);
  const masteryAvg = masteryVals.length
    ? Math.round(masteryVals.reduce((a, b) => a + b, 0) / masteryVals.length)
    : null;

  const now = new Date();
  const sched = pickSchedule(schedule, now);
  const hasToday = !!d?.resume || auto.length > 0 || assigned.length > 0;
  const today = formatDate(locale === "ru" ? "ru" : "uz", now, "long");

  // Hero subtitle: guruh · semestr · o'quv yili · sana.
  const ctx: string[] = [];
  if (p?.groupName) ctx.push(p.groupName);
  if (p?.semester) ctx.push(tp("semester", { n: p.semester }));
  if (p?.academicYear) ctx.push(p.academicYear);
  const subtitle = ctx.length ? `${ctx.join(" · ")} · ${today}` : today;

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
          <motion.div variants={containerVariants} initial="hidden" animate="show">
            {/* Hero — salom + streak + kontekst + ko'rsatkichlar */}
            <motion.div variants={itemVariants}>
              <HeroCard
                title={`${t("hello")}, ${d.fullName.split(" ")[0]}`}
                subtitle={subtitle}
                left={
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => navigate("/app/courses")}
                      title={t("overall")}
                      className="rounded-full transition-transform hover:scale-105"
                    >
                      <ProgressRing value={overallPct} size={76} stroke={9} label={t("overall")} />
                    </button>
                    <div
                      className={cls(
                        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-body font-bold",
                        d.streak.activeToday ? "bg-amber-soft text-amber" : "bg-surface-raised text-ink-faint"
                      )}
                      title={!d.streak.activeToday && d.streak.days > 0 ? t("streakPausedHint") : undefined}
                    >
                      <Icon icon={Flame} size={16} />
                      {d.streak.days > 0 ? t("streakDays", { count: d.streak.days }) : t("streakStart")}
                    </div>
                  </div>
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
                  value={attPct !== null ? `${attPct}%` : "—"}
                  label={t("summaryAttendance")}
                  tone={attPct !== null && attPct < 75 ? "bg-rose-soft text-rose" : "bg-blue-soft text-blue"}
                  onClick={() => navigate("/app/attendance")}
                />
                <HeroTile
                  icon={BookOpen}
                  value={String(d.courses.length)}
                  label={t("summaryCourses")}
                  tone="bg-brand-soft text-brand-tint"
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
            </motion.div>

            {/* Asosiy maydon: chapda ish, o'ngda kontekst */}
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-4">
                {/* Davom ettirish */}
                {d.resume && (
                  <motion.div
                    variants={itemVariants}
                    className="flex flex-wrap items-center gap-4 rounded-card bg-gradient-to-br from-brand-deep to-brand p-5 text-white shadow-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-note font-bold uppercase tracking-wide text-white/70">{t("continueLabel")}</p>
                      <h2 className="mt-0.5 truncate text-[21px] font-bold leading-tight">{d.resume.topic}</h2>
                      <p className="truncate text-note text-white/85">{d.resume.subjectName}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-pill bg-white/25">
                          <span
                            className="block h-full rounded-pill bg-white"
                            style={{ width: `${Math.max(d.resume.pct, 3)}%` }}
                          />
                        </span>
                        <span className="text-note text-white/85">{d.resume.pct}%</span>
                      </div>
                    </div>
                    <Link to={`/app/topics/${d.resume.topicId}`} className="shrink-0">
                      <button className="flex items-center gap-2 rounded-control bg-white px-4 py-2.5 text-body font-bold text-brand-tint transition-all hover:bg-white/90">
                        <Icon icon={PlayCircle} size={17} />
                        {t("continue")}
                      </button>
                    </Link>
                  </motion.div>
                )}

                {/* Bugungi / keyingi darslar */}
                <motion.div variants={itemVariants}>
                  <Card className="overflow-hidden p-0">
                    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                      <Icon icon={CalendarDays} size={15} className="text-ink-faint" />
                      <p className="flex-1 text-note font-bold uppercase tracking-wide text-ink-soft">
                        {sched?.mode === "next"
                          ? `${t("nextLessons")} · ${formatDate(locale === "ru" ? "ru" : "uz", sched.date, "short")}`
                          : t("todayLessons")}
                      </p>
                      <button
                        onClick={() => navigate("/app/schedule")}
                        className="text-note font-semibold text-brand-tint hover:underline"
                      >
                        {t("openSchedule")}
                      </button>
                    </div>
                    {sched ? (
                      <div className="divide-y divide-line">
                        {sched.sessions.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => navigate("/app/schedule")}
                            className={cls(
                              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised",
                              s.isPast && "opacity-55"
                            )}
                          >
                            <div className="w-12 shrink-0 text-center">
                              <p className="text-body font-bold leading-none tabular-nums text-brand-tint">{hhmm(s.date)}</p>
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
                    ) : (
                      <div className="px-4 py-5">
                        <EmptyState icon={<Icon icon={CalendarDays} size={20} />} text={t("noLessonsWeek")} />
                      </div>
                    )}
                  </Card>
                </motion.div>

                {/* Bugun — vazifalar */}
                <motion.div variants={itemVariants}>
                  <Card className="overflow-hidden p-0">
                    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                      <Icon icon={ClipboardCheck} size={15} className="text-ink-faint" />
                      <p className="flex-1 text-note font-bold uppercase tracking-wide text-ink-soft">{t("todayTitle")}</p>
                      <button
                        onClick={() => navigate("/app/tasks")}
                        className="text-note font-semibold text-brand-tint hover:underline"
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
                </motion.div>

                {/* Davomat + o'zlashtirish */}
                <motion.div variants={itemVariants} className="grid gap-3 sm:grid-cols-2">
                  {/* Davomat */}
                  <button
                    onClick={() => navigate("/app/attendance")}
                    className="flex flex-col rounded-card border border-line bg-surface p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-soft text-blue">
                        <Icon icon={CalendarCheck2} size={16} />
                      </div>
                      <p className="text-note font-bold uppercase tracking-wide text-ink-soft">{t("semesterAttendance")}</p>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <span className={cls("text-stat font-bold tabular-nums", attPct !== null && attPct < 75 ? "text-rose" : "text-ink")}>
                        {attPct !== null ? `${attPct}%` : "—"}
                      </span>
                      {attMissed > 0 && (
                        <span className="mb-1 rounded-pill bg-rose-soft px-2.5 py-0.5 text-note font-bold text-rose">
                          {t("missedN", { count: attMissed })}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* O'zlashtirish */}
                  <button
                    onClick={() => navigate("/app/grades")}
                    className="flex flex-col rounded-card border border-line bg-surface p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-tint">
                        <Icon icon={GraduationCap} size={16} />
                      </div>
                      <p className="text-note font-bold uppercase tracking-wide text-ink-soft">{t("mastery")}</p>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <ProgressRing value={masteryAvg ?? 0} size={56} stroke={7} />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {masteryCourses.slice(0, 3).map((c) => (
                          <BarRow key={c.courseId} label={c.subjectName} value={c.avgQuiz ?? 0} />
                        ))}
                        {masteryCourses.length === 0 && (
                          <p className="text-note text-ink-faint">{t("avgQuizShort")}: —</p>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.div>

                {/* Kurslarga o'tish */}
                <motion.div variants={itemVariants}>
                  <button
                    onClick={() => navigate("/app/courses")}
                    className="flex w-full items-center justify-center gap-2 rounded-card bg-brand px-4 py-3.5 text-body font-bold text-white shadow-card transition-all hover:bg-brand-deep hover:shadow-card-hover"
                  >
                    <Icon icon={BookOpen} size={18} />
                    {t("goToCourses")}
                    <Icon icon={ArrowRight} size={16} />
                  </button>
                </motion.div>
              </div>

              {/* O'ng ustun — takrorlash, bildirishnoma, faollik */}
              <aside className="min-w-0 space-y-4">
                {/* Interval takrorlash — bugun takrorlash kerak bo'lgan kartalar */}
                {reviewQ.data && reviewQ.data.total > 0 && (
                  <motion.div variants={itemVariants}>
                    <RailCard
                      title={t("reviewDueTitle")}
                      icon={Repeat}
                      action={{ label: t("reviewOpen"), onClick: () => navigate("/app/grades?sub=takrorlash") }}
                    >
                      <div className="divide-y divide-line">
                        {reviewQ.data.topics.slice(0, 5).map((tp) => (
                          <button
                            key={tp.topicId}
                            onClick={() => navigate(`/app/grades?sub=takrorlash&topic=${tp.topicId}`)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
                              <Icon icon={Sparkles} size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-body font-semibold text-ink">{tp.topicTitle}</p>
                              <p className="truncate text-note text-ink-faint">{tp.subjectName}</p>
                            </div>
                            <span className="shrink-0 rounded-pill bg-violet-soft px-2 py-0.5 text-note font-bold tabular-nums text-violet">
                              {tp.dueCount}
                            </span>
                          </button>
                        ))}
                      </div>
                    </RailCard>
                  </motion.div>
                )}

                {d.notifications.length > 0 && (
                  <motion.div variants={itemVariants}>
                    <RailCard title={t("notifications")} icon={ClipboardCheck}>
                      <div className="divide-y divide-line">
                        {d.notifications.slice(0, 4).map((n) => (
                          <button
                            key={n.caseAttemptId}
                            onClick={() => navigate(`/app/topics/${n.topicId}?tab=case`)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-soft text-emerald">
                              <Icon icon={ClipboardCheck} size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-body font-semibold text-ink">{t("caseGraded")}</p>
                              <p className="truncate text-note text-ink-faint">{n.topic}</p>
                            </div>
                            {n.score !== null && <span className="shrink-0 text-body font-bold text-emerald">{n.score}</span>}
                          </button>
                        ))}
                      </div>
                    </RailCard>
                  </motion.div>
                )}

                {activity.length > 0 && (
                  <motion.div variants={itemVariants}>
                    <RailCard title={t("recentActivity")} icon={Sparkles}>
                      <div className="divide-y divide-line">
                        {activity.slice(0, 5).map((a, i) => {
                          const m = ACTIVITY_META[a.type];
                          return (
                            <button
                              key={`${a.type}-${a.topicId}-${i}`}
                              onClick={() => navigate(`/app/topics/${a.topicId}`)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                            >
                              <div className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.tone)}>
                                <Icon icon={m.icon} size={13} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-note font-semibold text-ink">{t(`activity.${a.type}`)}</p>
                                <p className="truncate text-note text-ink-faint">{a.topic}</p>
                              </div>
                              {a.score !== null && (
                                <span className="shrink-0 text-note font-bold tabular-nums text-ink-soft">{a.score}%</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </RailCard>
                  </motion.div>
                )}
              </aside>
            </div>
          </motion.div>
        )}
      </AsyncSection>

      {d && d.courses.length === 0 && (
        <p className="mt-3 text-center text-body text-ink-faint">{t("adminWillAdd")}</p>
      )}

      {!d && !q.isLoading && !q.isError && (
        <EmptyState icon={<Icon icon={ArrowRight} size={22} />} text={t("noCourses")} />
      )}
    </div>
  );
}
