import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, CalendarDays, ChevronRight, Trophy, Users2, UserX, type LucideIcon } from "lucide-react";
import { BarRow, Card, Icon, ListRow, Num, ProgressBar, ProgressRing, StatCard, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { Disclosure } from "../../components/Disclosure";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useMe } from "../../lib/auth";
import { useTaskBoard, useTeacherLessons, useTeachCourses, useTeachDashboard, type RankedStudent } from "./api";
import { LessonsBlock, dayKey, type LessonMode } from "./home/LessonsBlock";
import { TasksBlock } from "./home/TasksBlock";
import { StarterCard } from "./home/StarterCard";
import { CourseCard } from "./CourseCard";

/** Reyting kartasi — eng yuqori yoki orqada qolgan talabalar. */
function RankingCard({ title, icon, tone, rows, emptyText, onPick }: {
  title: string; icon: LucideIcon; tone: string; rows: RankedStudent[]; emptyText: string; onPick: (id: number) => void;
}) {
  return (
    <Card className="flex flex-col !p-0">
      <p className={cls("flex items-center gap-2 px-4 pb-3 pt-3.5 text-section font-bold", tone)}>
        <Icon icon={icon} size={16} /> {title}
      </p>
      {rows.length === 0 ? (
        <p className="border-t border-line-soft px-4 py-6 text-center text-note text-ink-faint">{emptyText}</p>
      ) : (
        rows.map((r, i) => (
          <ListRow
            key={r.id}
            onClick={() => onPick(r.id)}
            lead={<Num className={cls("w-5 text-right text-micro font-bold", i < 3 ? "text-brand-deep" : "text-ink-faint")}>{i + 1}</Num>}
            title={r.fullName}
            value={
              <span className="flex items-center gap-2.5">
                <ProgressBar value={r.overallPct} className="hidden w-24 shrink-0 sm:block" tone={r.behind ? "rose" : "emerald"} />
                <Num className={cls("w-9 text-right text-micro font-bold", r.behind ? "text-rose" : "text-ink-soft")}>{r.overallPct}%</Num>
              </span>
            }
          />
        ))
      )}
    </Card>
  );
}

/**
 * O'QITUVCHI BOSH SAHIFASI — BITTA sahifa, tablarsiz (2026-08-03, buyurtmachi:
 * "vazifalar va darslarimni ham bugun ichida bo'lsin va bu tablarni yo'qot,
 * faqat aqlli qilgin, prosta qoyib qoymasdan").
 *
 * Ilgari uchta alohida sahifa bor edi (Bugun / Mening vazifalarim / Darslarim)
 * va ular ikkinchi darajali tab-tasmada turardi. Endi hammasi shu yerda, lekin
 * TO'KIB TASHLANMAGAN — har blok o'z ichida kengayadi:
 *   Darslar  — Bugun ⇄ Hafta ⇄ Oy (sahifa almashmaydi)
 *   Vazifalar — 5 ta shoshilinch ⇄ to'liq bort (ro'yxat ALMASHADI, qo'shilmaydi)
 *   Analitika — yig'ilgan (o'zgarmadi)
 *
 * Eski manzillar (`/teach/tasks`, `/teach/schedule`) ishlayveradi: ular
 * `?focus=` bilan shu sahifaga yo'naltiriladi va kerakli blok ochilib,
 * o'ziga skroll qiladi. ⚠️ Backend vazifalari aynan shu deep-linklarni beradi
 * (tasks/service.ts) — ularni buzib bo'lmaydi.
 */
export function TeachDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const { t: ttasks } = useTranslation(undefined, { keyPrefix: "tasks" });
  const locale = useLocale();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: me } = useMe();
  const dash = useTeachDashboard();
  const list = useTeachCourses();
  const board = useTaskBoard();
  const courses = list.data ?? [];
  const todayKey = dayKey(new Date());
  const todayLessons = useTeacherLessons({ from: todayKey, to: todayKey });

  const focus = params.get("focus");
  const [lessonMode, setLessonMode] = useState<LessonMode>(focus === "lessons" ? "week" : "today");
  const [tasksOpen, setTasksOpen] = useState(focus === "tasks");

  // Deep-linkdan kelinganda kerakli blokka skroll (aks holda foydalanuvchi
  // sahifa tepasida qolib, nima o'zgarganini tushunmaydi).
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(focus === "tasks" ? "block-tasks" : "block-lessons");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    const p = new URLSearchParams(params);
    p.delete("focus");
    setParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const stats = dash.data?.stats;
  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");
  const firstCourseId = courses[0]?.id;
  const publishedPct = stats && stats.totalTopics > 0 ? Math.round((stats.publishedTopics / stats.totalTopics) * 100) : 0;

  const lessonsToday = todayLessons.data ? todayLessons.data.length : null;
  const pendingToday = (todayLessons.data ?? []).filter((l) => l.status !== "FULL").length;
  const openTasks = board.data ? board.data.stats.toDo : null;
  const overdue = board.data?.stats.overdue ?? 0;

  const goLessons = () => {
    setLessonMode("today");
    document.getElementById("block-lessons")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const goTasks = (open: boolean) => {
    setTasksOpen(open);
    document.getElementById("block-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Salom + bugungi ish hajmi.
          ⚠️ 2026-09: gradient karta OLIB TASHLANDI. U ekrandagi eng baland
          ovozli blok edi, lekin eng kam ma'lumot berardi; raqamlar esa oq
          chiplarda "bezak" bo'lib turardi. Endi ular oddiy ko'rsatkich
          kartochkalari — har biri bosiladi va tegishli blokka olib boradi. */}
      <div className="min-w-0">
        <h1 className="truncate text-h1 font-bold text-ink">{t("hello")}, {me?.full_name?.split(" ")[0]}</h1>
        <p className="mt-1 text-note text-ink-soft">
          {today}
          {openTasks !== null && openTasks > 0 && <> · {t("todayWork", { n: openTasks })}</>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label={t("tileLessons")}
          value={lessonsToday ?? "—"}
          sub={pendingToday > 0 ? t("tileLessonsPending", { n: pendingToday }) : t("tileLessonsAllMarked")}
          subTone={pendingToday > 0 ? "warn" : undefined}
          onClick={goLessons}
        />
        <StatCard
          label={t("tileTasks")}
          value={openTasks ?? "—"}
          accent={overdue > 0}
          sub={overdue > 0 ? t("tileTasksOverdue", { n: overdue }) : t("tileTasksNone")}
          onClick={() => goTasks(true)}
        />
        <StatCard
          label={t("tileStudents")}
          value={stats?.students ?? "—"}
          sub={t("tileCoursesN", { n: courses.length })}
          onClick={() => navigate("/teach/groups")}
        />
        <StatCard
          label={t("tileTopics")}
          value={stats?.publishedTopics ?? "—"}
          unit={stats ? `/ ${stats.totalTopics}` : undefined}
          bar={stats && stats.totalTopics > 0 ? publishedPct : null}
          barTone="good"
          barCaption={stats ? t("tileTopicsCaption", { n: stats.totalTopics, pct: publishedPct }) : ""}
          onClick={() => navigate("/teach/courses")}
        />
      </div>

      {/* Birinchi kirish — hali hech narsa chop etilmagan bo'lsa */}
      {dash.data && (
        <StarterCard
          coursesCount={courses.length}
          totalTopics={dash.data.stats.totalTopics}
          publishedTopics={dash.data.stats.publishedTopics}
          firstCourseId={firstCourseId}
        />
      )}

      {/* DARSLAR — Bugun / Hafta / Oy (alohida sahifa emas) */}
      <div id="block-lessons" className="scroll-mt-4">
        <LessonsBlock mode={lessonMode} onMode={setLessonMode} />
      </div>

      {/* VAZIFALAR — shoshilinch 5 ta ⇄ to'liq bort */}
      <div id="block-tasks" className="scroll-mt-4">
        <TasksBlock expanded={tasksOpen} onExpand={setTasksOpen} />
        <div className="mt-1.5 px-1">
          <button onClick={() => navigate("/teach/cases/review")} className="inline-flex items-center gap-0.5 text-note font-semibold text-ink-soft hover:text-ink">
            {ttasks("casesReview")} <Icon icon={ChevronRight} size={14} />
          </button>
        </div>
      </div>

      {/* Analitika — sukut bo'yicha YIG'ILGAN */}
      {stats && (
        <Disclosure label={t("analytics")} storageKey="meduni.teach.homeAnalytics">
          <div className="space-y-2.5">
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
                  <p className="border-b border-line px-4 py-3 text-note font-semibold text-ink-soft">{t("byCourse")}</p>
                  <div className="space-y-1 p-3">
                    {dash.data.courses.map((c) => (
                      <BarRow key={c.id} label={c.subjectName} value={c.avgProgress} onClick={() => navigate(`/teach/courses/${c.id}/progress`)} />
                    ))}
                  </div>
                </Card>
              )}

              {dash.data?.upcomingSessions && dash.data.upcomingSessions.length > 0 && (
                <Card className="!p-0">
                  <p className="border-b border-line px-4 py-3 text-note font-semibold text-ink-soft">{t("upcoming")}</p>
                  <div className="divide-y divide-line">
                    {dash.data.upcomingSessions.map((s) => (
                      <button key={s.id} onClick={() => navigate(s.groupId ? `/teach/groups/${s.groupId}?tab=timetable` : `/teach/courses/${s.courseId}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg">
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
                <span className="inline-flex items-center gap-1.5 text-micro font-semibold text-ink-soft"><Icon icon={Users2} size={15} /> {t("myGroups")}:</span>
                {stats.groupList.map((g) => (
                  <button key={g.id} onClick={() => navigate(`/teach/groups/${g.id}`)} className="rounded-pill bg-bg px-3 py-1 text-micro font-semibold text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep">{g.name}</button>
                ))}
              </Card>
            )}
          </div>
        </Disclosure>
      )}

      {/* Kurslar — navigatsiya yorlig'i (statistika emas) */}
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
