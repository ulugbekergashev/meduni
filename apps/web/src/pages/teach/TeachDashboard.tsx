import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Trophy, UserX, type LucideIcon } from "lucide-react";
import { BarRow, Button, Icon, ProgressRing, cls } from "@meduni/ui";
import { BentoCard, BentoRow, MetricTile, PageHeader } from "../../components/bento";
import { Disclosure } from "../../components/Disclosure";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useMe } from "../../lib/auth";
import { useTaskBoard, useTeacherLessons, useTeachCourses, useTeachDashboard, type DerivedLesson, type RankedStudent } from "./api";
import { LessonsBlock, dayKey, type LessonMode } from "./home/LessonsBlock";
import { TasksBlock, urgentTasks } from "./home/TasksBlock";
import { MakeupBlock } from "./home/MakeupBlock";
import { StarterCard } from "./home/StarterCard";
import { TeachHero } from "./home/TeachHero";
import { TodayLessonsCard, pickTeachDay } from "./home/TodayLessonsCard";
import { HomeGroupsCard } from "./home/HomeGroupsCard";
import { HomeCoursesCard } from "./home/HomeCoursesCard";
import { RollCallModal } from "./course/attendance/RollCallModal";
import type { RollCallTarget } from "./tasks/TaskItemRow";

/** Bugungi va kelgusi darslar oynasi — "keyingi darslar" kartasi uchun. */
const LOOKAHEAD_DAYS = 7;

/** Kun vaqtiga qarab salom: tong (<12), kun (<18), kech. */
function greetingKey(now: Date): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const h = now.getHours();
  if (h < 12) return "goodMorning";
  if (h < 18) return "goodAfternoon";
  return "goodEvening";
}

/** Reyting kartasi — eng yuqori yoki orqada qolgan talabalar. */
function RankingCard({ title, icon, tone, rows, emptyText, onPick }: {
  title: string; icon: LucideIcon; tone: string; rows: RankedStudent[]; emptyText: string; onPick: (id: number) => void;
}) {
  return (
    <BentoCard title={<span className={cls("inline-flex items-center gap-2", tone)}><Icon icon={icon} size={16} /> {title}</span>} bodyClassName="px-2 pb-3">
      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-note text-ink-soft">{emptyText}</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r, i) => (
            <li key={r.id}>
              <BentoRow
                lead={<span className={cls("w-6 shrink-0 text-right font-data text-micro font-semibold tabular-nums", i < 3 ? "text-brand-tint" : "text-ink-soft")}>{i + 1}</span>}
                title={r.fullName}
                right={<span className={r.behind ? "text-rose" : undefined}>{r.overallPct}%</span>}
                onClick={() => onPick(r.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}

/**
 * O'QITUVCHI BOSH SAHIFASI — "bugun nima qilaman" (Dizayn v3, 2026-10).
 *
 * Bento: hero (eng muhim bitta ish — yo'qlama yoki eng eski vazifa) + o'ngda
 * bugungi darslar; ostida harakat beradigan ko'rsatkichlar, "Bugun bajarish
 * kerak" ro'yxati, guruhlar; pastda (so'ralganda) haftalik/oylik jadval,
 * yig'ilgan analitika va kurslar.
 *
 * Eski manzillar (`/teach/tasks`, `/teach/schedule`) ishlayveradi: ular
 * `?focus=` bilan shu sahifaga yo'naltiriladi va kerakli blok ochilib,
 * o'ziga skroll qiladi. ⚠️ Backend vazifalari aynan shu deep-linklarni beradi.
 */
export function TeachDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const locale = useLocale();
  const lang = locale === "ru" ? "ru" : "uz";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: me } = useMe();
  const dash = useTeachDashboard();
  const list = useTeachCourses();
  const board = useTaskBoard();
  const courses = list.data ?? [];
  const now = new Date();
  const todayKey = dayKey(now);
  const until = new Date(now);
  until.setDate(until.getDate() + LOOKAHEAD_DAYS);
  const upcoming = useTeacherLessons({ from: todayKey, to: dayKey(until) });

  const focus = params.get("focus");
  const [scheduleMode, setScheduleMode] = useState<LessonMode | null>(focus === "lessons" ? "week" : null);
  const [tasksOpen, setTasksOpen] = useState(focus === "tasks");
  const [roll, setRoll] = useState<RollCallTarget | null>(null);

  // Deep-linkdan kelinganda kerakli blokka skroll.
  useEffect(() => {
    if (!focus) return;
    const id = focus === "tasks" ? "block-tasks" : "block-lessons";
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    const p = new URLSearchParams(params);
    p.delete("focus");
    setParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const stats = dash.data?.stats;
  const publishedPct = stats && stats.totalTopics > 0 ? Math.round((stats.publishedTopics / stats.totalTopics) * 100) : 0;
  const openTasks = board.data ? board.data.stats.toDo : null;
  const casesToReview = dash.data?.tasks.casesToReview ?? null;

  const day = useMemo(() => pickTeachDay(upcoming.data ?? [], todayKey), [upcoming.data, todayKey]);
  // Hero: bugungi, yo'qlamasi to'liq bo'lmagan birinchi dars (vaqt bo'yicha).
  const heroLesson: DerivedLesson | null =
    day?.mode === "today" ? (day.lessons.find((l) => l.status !== "FULL" && l.rosterSize > 0) ?? null) : null;
  const urgent = useMemo(() => urgentTasks(board.data?.items ?? [], 1), [board.data]);
  const heroTask = heroLesson ? null : (urgent[0] ?? null);
  const openNonDone = (board.data?.items ?? []).filter((i) => i.status !== "done").length;

  const openSchedule = (mode: LessonMode = "week") => {
    setScheduleMode(mode);
    requestAnimationFrame(() => document.getElementById("block-lessons")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const markLesson = (l: DerivedLesson) =>
    setRoll({
      courseId: l.courseId,
      date: l.dayKey,
      startTime: l.startTime,
      groupId: l.groupId,
      heading: `${l.courseName} · ${formatDate(lang, new Date(`${l.dayKey}T00:00:00`), "short")} · ${l.startTime}`,
    });

  const subtitle = [formatDate(lang, now, "long")];
  if (openTasks !== null && openTasks > 0) subtitle.push(t("todayWork", { n: openTasks }));

  return (
    <div className="space-y-3 pb-8">
      <PageHeader
        className="mb-0"
        title={`${t(greetingKey(now))}, ${me?.full_name?.split(" ")[0] ?? ""}`}
        subtitle={subtitle.join(" · ")}
        right={
          <>
            <Button size="md" icon={<Icon icon={Plus} size={15} />} onClick={() => navigate("/teach/courses?new=1")}>
              {t("newCourse")}
            </Button>
          </>
        }
      />

      {/* Birinchi kirish — hali hech narsa chop etilmagan bo'lsa */}
      {dash.data && (
        <StarterCard
          coursesCount={courses.length}
          totalTopics={dash.data.stats.totalTopics}
          publishedTopics={dash.data.stats.publishedTopics}
          firstCourseId={courses[0]?.id}
        />
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <TeachHero
            lesson={heroLesson}
            task={heroTask}
            waitingCount={Math.max(0, openNonDone - 1)}
            avgProgress={stats ? stats.avgProgress : null}
            onRollCall={setRoll}
          />
        </div>

        <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <TodayLessonsCard
            sched={day}
            isLoading={upcoming.isLoading}
            isError={upcoming.isError}
            onRetry={() => upcoming.refetch()}
            onMark={markLesson}
            onOpenSchedule={() => openSchedule("week")}
          />
        </div>

        {/* Ko'rsatkichlar — har biri boshqa sahifaga olib boradi (STAT DIETASI) */}
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:col-start-1 xl:row-start-2">
          <MetricTile
            label={t("tileReview")}
            value={casesToReview}
            size="stat"
            tone={casesToReview ? "violet" : "plain"}
            sub={casesToReview ? t("tileReviewSub") : t("tileReviewNone")}
            onClick={() => navigate("/teach/cases/review")}
          />
          <MetricTile
            label={t("tileStudents")}
            value={stats?.students ?? null}
            size="stat"
            sub={t("tileCoursesN", { n: courses.length })}
            onClick={() => navigate("/teach/groups")}
          />
          <MetricTile
            className="col-span-2 sm:col-span-1"
            label={t("statTopics")}
            value={stats ? `${stats.publishedTopics}/${stats.totalTopics}` : null}
            size="stat"
            sub={stats ? t("tileTopicsCaption", { n: stats.totalTopics, pct: publishedPct }) : undefined}
            onClick={() => navigate("/teach/courses")}
          />
        </div>

        <div id="block-tasks" className="min-w-0 scroll-mt-4 xl:col-start-1 xl:row-start-3">
          <TasksBlock expanded={tasksOpen} onExpand={setTasksOpen} />
        </div>

        <div className="flex min-w-0 flex-col gap-3 xl:col-start-2 xl:row-start-3">
          {/* Otrabotka navbati — bo'sh bo'lsa blok chizilmaydi (F3) */}
          <MakeupBlock />
          <HomeGroupsCard />
        </div>
      </div>

      {/* Haftalik/oylik jadval — "Jadval" bosilganda yoki /teach/schedule deep-linkidan */}
      <div id="block-lessons" className="scroll-mt-4">
        {scheduleMode && <LessonsBlock mode={scheduleMode} onMode={setScheduleMode} onClose={() => setScheduleMode(null)} />}
      </div>

      <HomeCoursesCard
        courses={courses}
        progressOf={(id) => dash.data?.courses.find((d) => d.id === id)?.avgProgress ?? 0}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
      />

      {/* Analitika — sukut bo'yicha YIG'ILGAN */}
      {stats && (
        <Disclosure label={t("analytics")} storageKey="meduni.teach.homeAnalytics">
          <div className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-3">
              {[
                { ring: stats.avgProgress, tone: "brand" as const, label: t("statAvgProgress"), sub: t("statStudentsN", { n: stats.students }) },
                { ring: stats.avgAttendance ?? 0, tone: "blue" as const, label: t("statAttendance"), sub: stats.avgAttendance === null ? "—" : undefined },
                { ring: publishedPct, tone: "emerald" as const, label: t("statTopics"), sub: `${stats.publishedTopics}/${stats.totalTopics}` },
              ].map((m) => (
                <BentoCard key={m.label}>
                  <div className="flex items-center gap-4">
                    <ProgressRing value={m.ring} tone={m.tone} size={64} stroke={7} />
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-ink">{m.label}</p>
                      {m.sub && <p className="mt-0.5 text-note text-ink-soft">{m.sub}</p>}
                    </div>
                  </div>
                </BentoCard>
              ))}
            </div>

            {dash.data && dash.data.courses.length > 0 && (
              <BentoCard title={t("byCourse")}>
                <div className="space-y-1">
                  {dash.data.courses.map((c) => (
                    <BarRow key={c.id} label={c.subjectName} value={c.avgProgress} onClick={() => navigate(`/teach/courses/${c.id}/progress`)} />
                  ))}
                </div>
              </BentoCard>
            )}

            {dash.data && (dash.data.ranking.top.length > 0 || dash.data.ranking.behind.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <RankingCard title={t("rankTop")} icon={Trophy} tone="text-emerald" rows={dash.data.ranking.top} emptyText={t("rankEmpty")} onPick={(id) => navigate(`/teach/students/${id}`)} />
                <RankingCard title={t("rankBehind")} icon={UserX} tone="text-rose" rows={dash.data.ranking.behind} emptyText={t("rankNoBehind")} onPick={(id) => navigate(`/teach/students/${id}`)} />
              </div>
            )}
          </div>
        </Disclosure>
      )}

      {roll && (
        <RollCallModal
          courseId={roll.courseId}
          date={roll.date}
          startTime={roll.startTime}
          groupId={roll.groupId ?? undefined}
          heading={roll.heading}
          onClose={() => setRoll(null)}
        />
      )}
    </div>
  );
}
