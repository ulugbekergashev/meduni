import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Flame, GraduationCap, Trophy } from "lucide-react";
import { Icon } from "@meduni/ui";
import { HeaderChip, MetricTile, PageHeader } from "../../components/bento";
import { AsyncSection } from "../../components/AsyncSection";
import { CheckInCard } from "./CheckInCard";
import { useLocale } from "../../lib/useLocale";
import { isLowAttendance } from "../../lib/attendance";
import { formatDate } from "../../lib/date";
import { HomeHero } from "./home/HomeHero";
import { TodayCard, type DaySchedule } from "./home/TodayCard";
import { HomeTasks } from "./home/HomeTasks";
import { HomeCourses } from "./home/HomeCourses";
import { TutorCard } from "./home/TutorCard";
import {
  useMyAttendance,
  useMyDashboard,
  useMyGrades,
  useMyProfile,
  useMyRank,
  useMySchedule,
  useMyTasks,
  useReviewDue,
  useSetMyTaskDone,
  type ScheduleItem,
} from "./api";

function sameLocalDay(dateStr: string, now: Date): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** Bugungi (hali tugamagan) darslar, aks holda birinchi kelgusi kunning darslari. */
function pickSchedule(schedule: ScheduleItem[], now: Date): DaySchedule | null {
  const todays = schedule.filter((s) => sameLocalDay(s.date, now));
  if (todays.some((s) => !s.isPast)) return { mode: "today", date: now.toISOString(), sessions: todays };
  const future = schedule
    .filter((s) => !s.isPast && new Date(s.date).getTime() > now.getTime() && !sameLocalDay(s.date, now))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (future.length === 0) return null;
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const k = key(new Date(future[0].date));
  return { mode: "next", date: future[0].date, sessions: future.filter((s) => key(new Date(s.date)) === k) };
}

/** Kun vaqtiga qarab salom: tong (<12), kun (<18), kech. */
function greetingKey(now: Date): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const h = now.getHours();
  if (h < 12) return "goodMorning";
  if (h < 18) return "goodAfternoon";
  return "goodEvening";
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/**
 * Talaba bosh sahifasi — "bugun nima qilaman" (2026-10 maket).
 * Chapda: davom ettirish → ko'rsatkichlar + vazifalar → joriy kurslar.
 * O'ngda: bugungi darslar va AI-tutor.
 */
export function StudentDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const { t: tp } = useTranslation(undefined, { keyPrefix: "period" });
  const locale = useLocale();
  const navigate = useNavigate();

  const q = useMyDashboard();
  const profile = useMyProfile();
  const tasksQ = useMyTasks();
  const scheduleQ = useMySchedule();
  const rankQ = useMyRank();
  const attendanceQ = useMyAttendance(undefined, {});
  const gradesQ = useMyGrades();
  const reviewQ = useReviewDue();
  const done = useSetMyTaskDone();

  const d = q.data;
  const p = profile.data;
  const rank = rankQ.data;
  const now = new Date();

  const overallPct = average((d?.courses ?? []).map((c) => c.progressPct)) ?? 0;
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
  const attBars = (attendanceQ.data?.byMonth ?? []).filter((m) => m.marked > 0).map((m) => m.pct);

  // Joriy semestr o'zlashtirishi (testlar o'rtachasi, kurs kesimida).
  const masteryVals = (gradesQ.data?.courses ?? [])
    .filter((c) => currentIds.has(c.courseId))
    .map((c) => c.avgQuiz)
    .filter((v): v is number => v !== null);
  const masteryAvg = average(masteryVals);

  const resumeCourse = d?.resume ? d.courses.find((c) => c.id === d.resume!.courseId) : undefined;
  const nextCourse = currentCourses.find((c) => c.nextTopicId !== null);
  const tutorTopic = d?.resume
    ? { id: d.resume.topicId, title: d.resume.topic }
    : nextCourse?.nextTopicId
      ? { id: nextCourse.nextTopicId, title: nextCourse.nextTopic ?? "" }
      : null;

  const lang = locale === "ru" ? "ru" : "uz";
  const ctx: string[] = [];
  if (p?.groupName) ctx.push(p.groupName);
  if (p?.semester) ctx.push(tp("semester", { n: p.semester }));
  if (p?.academicYear) ctx.push(p.academicYear);
  ctx.push(formatDate(lang, now, "long"));

  return (
    <AsyncSection
      isLoading={q.isLoading}
      isError={q.isError}
      isEmpty={!!d && d.courses.length === 0}
      emptyIcon={<Icon icon={GraduationCap} size={22} />}
      emptyText={t("noCourses")}
      emptyHint={t("adminWillAdd")}
      onRetry={() => q.refetch()}
    >
      {d && (
        <div className="space-y-3">
          <PageHeader
            className="mb-0"
            title={`${t(greetingKey(now))}, ${d.fullName.split(" ")[0]}`}
            subtitle={ctx.join(" · ")}
            right={
              <>
                <HeaderChip
                  tone={d.streak.activeToday ? "amber" : "plain"}
                  icon={<Icon icon={Flame} size={15} />}
                  title={!d.streak.activeToday && d.streak.days > 0 ? t("streakPausedHint") : undefined}
                >
                  {d.streak.days > 0 ? t("streakDays", { count: d.streak.days }) : t("streakStart")}
                </HeaderChip>
                {rank?.rank && (
                  <HeaderChip icon={<Icon icon={Trophy} size={15} />} onClick={() => navigate("/app/grades")}>
                    {t("summaryRank")}
                    <b className="font-data tabular-nums text-ink">
                      {rank.rank}/{rank.total}
                    </b>
                  </HeaderChip>
                )}
              </>
            }
          />

          {/* FaceID davomat — vaqt oynasi ochiq dars bo'lsagina ko'rinadi */}
          <CheckInCard />

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 xl:col-start-1 xl:row-start-1">
              <HomeHero resume={d.resume} course={resumeCourse} overallPct={overallPct} />
            </div>

            <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
              <TodayCard
                sched={pickSchedule(scheduleQ.data ?? [], now)}
                isLoading={scheduleQ.isLoading}
                isError={scheduleQ.isError}
                onRetry={() => scheduleQ.refetch()}
              />
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] xl:col-start-1 xl:row-start-2">
              <MetricTile
                label={t("mastery")}
                value={masteryAvg}
                percent
                sub={t("masterySub")}
                tone="violet"
                bars={masteryVals}
                onClick={() => navigate("/app/grades")}
              />
              <MetricTile
                label={t("semesterAttendance")}
                value={attPct}
                percent
                sub={attMissed > 0 ? t("missedN", { count: attMissed }) : t("attendanceSub")}
                tone={isLowAttendance(attPct) ? "rose" : "amber"}
                bars={attBars}
                onClick={() => navigate("/app/attendance")}
              />
              <HomeTasks
                className="col-span-2 lg:col-span-1"
                assigned={tasksQ.data?.assigned ?? []}
                auto={tasksQ.data?.auto ?? []}
                review={reviewQ.data?.topics ?? []}
                notifications={d.notifications}
                isLoading={tasksQ.isLoading}
                isError={tasksQ.isError}
                onRetry={() => tasksQ.refetch()}
                onDone={(id) => done.mutate(id)}
                doneId={done.isPending ? (done.variables ?? null) : null}
              />
            </div>

            <div className="min-w-0 xl:col-start-1 xl:row-start-3">
              <HomeCourses courses={currentCourses} />
            </div>

            <div className="min-w-0 xl:col-start-2 xl:row-start-3">
              <TutorCard topic={tutorTopic} />
            </div>
          </div>
        </div>
      )}
    </AsyncSection>
  );
}
