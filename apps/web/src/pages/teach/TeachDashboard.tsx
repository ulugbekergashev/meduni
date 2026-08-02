import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import {
  BookOpen, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck,
  Trophy, Users2, UserX, type LucideIcon,
} from "lucide-react";
import { BarRow, Button, Card, Icon, ProgressBar, ProgressRing, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { Disclosure } from "../../components/Disclosure";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useMe } from "../../lib/auth";
import { useTaskBoard, useTeacherLessons, useTeachCourses, useTeachDashboard, type DerivedLesson, type RankedStudent } from "./api";
import { RollCallModal } from "./course/attendance/RollCallModal";
import { TaskItemRow, type RollCallTarget } from "./tasks/TaskItemRow";
import { StarterCard } from "./home/StarterCard";
import { CourseCard } from "./CourseCard";

/** Bosh sahifada ko'rsatiladigan eng ko'p harakat qatori — qolgani "Vazifalar"da. */
const MAX_TODO_ROWS = 5;

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/**
 * Bosh sahifa = "BUGUN NIMA QILAMAN" (2026-08-02 qayta qurish).
 *
 * Ilgari bu yerda bitta skrollda 8 bo'lim bor edi (hero + 3 mini-stat, 4 tez
 * o'tish kartasi, bugungi darslar, 3 stat karta, analitika, kurslar) — ya'ni
 * hisobot, ish ro'yxati emas. Buyurtmachi: o'qituvchi "испугается".
 *
 * Endi ekranda: salom → bugungi darslar → BUGUN BAJARISH KERAK (aniq nomli
 * qatorlar, mavhum son emas) → qolgan hamma narsa "Analitika" ostida.
 * Hech narsa o'chirilmadi — faqat bir bosish narida (§ progressiv ochilish).
 */
export function TeachDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const { t: ttasks } = useTranslation(undefined, { keyPrefix: "tasks" });
  const locale = useLocale();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const dash = useTeachDashboard();
  const list = useTeachCourses();
  const board = useTaskBoard();
  const courses = list.data ?? [];
  const todayKey = dayKeyLocal(new Date());
  const todaySessions = useTeacherLessons({ from: todayKey, to: todayKey });
  const [mark, setMark] = useState<DerivedLesson | null>(null);
  const [rollCall, setRollCall] = useState<RollCallTarget | null>(null);
  const stats = dash.data?.stats;
  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");
  const firstCourseId = courses[0]?.id;
  const publishedPct = stats && stats.totalTopics > 0 ? Math.round((stats.publishedTopics / stats.totalTopics) * 100) : 0;

  // Bugungi ish: muddati o'tganlar birinchi, keyin eng eskisi.
  const todo = useMemo(() => {
    const open = (board.data?.items ?? []).filter((i) => i.status !== "done");
    return [...open]
      .sort((a, b) => {
        if ((a.status === "overdue") !== (b.status === "overdue")) return a.status === "overdue" ? -1 : 1;
        return (a.sinceIso ?? "").localeCompare(b.sinceIso ?? "");
      })
      .slice(0, MAX_TODO_ROWS);
  }, [board.data]);

  const openCount = board.data?.stats.toDo ?? 0;

  return (
    <div className="space-y-3 pb-8">
      {/* Salom — gradient urg'u band. Mini-statistika OLIB TASHLANDI:
          talaba/kurs/guruh sonlari Guruhlar va Kurslar sahifalarida bor
          (CLAUDE.md §4 "bitta fakt — bitta joy"). */}
      <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-deep via-brand to-violet px-6 py-4 text-white shadow-card sm:px-8">
        <h1 className="text-h1 font-extrabold leading-tight">{t("hello")}, {me?.full_name?.split(" ")[0]}</h1>
        <p className="mt-1 text-note text-white/85">{today}</p>
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

      {/* Bugungi darslar */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-section font-bold text-ink">{t("todayLessons")}</h2>
          <button onClick={() => navigate("/teach/schedule")} className="inline-flex items-center gap-0.5 text-note font-semibold text-brand-deep hover:text-brand">{t("allLessons")} <Icon icon={ChevronRight} size={14} /></button>
        </div>
        <AsyncSection
          isLoading={todaySessions.isLoading}
          isError={todaySessions.isError}
          isEmpty={(todaySessions.data?.length ?? 0) === 0}
          emptyIcon={<Icon icon={CalendarDays} size={24} />}
          emptyText={t("noTodayLessons")}
          onRetry={() => todaySessions.refetch()}
        >
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {(todaySessions.data ?? []).map((s) => (
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
        </AsyncSection>
      </section>

      {/* BUGUN BAJARISH KERAK — aniq qatorlar (ilgari 3 ta mavhum stat karta edi:
          "3 · Keys tekshirish" — QAYSI keys? Endi ism/mavzu bilan). */}
      <section className="space-y-2.5">
        <h2 className="text-section font-bold text-ink">{t("todoTitle")}</h2>
        <AsyncSection
          isLoading={board.isLoading}
          isError={board.isError}
          isEmpty={todo.length === 0}
          emptyIcon={<Icon icon={CheckCircle2} size={24} />}
          emptyText={t("allDone")}
          onRetry={() => board.refetch()}
        >
          <Card className="divide-y divide-line overflow-hidden p-0">
            {todo.map((item) => (
              <TaskItemRow key={item.id} item={item} onRollCall={setRollCall} />
            ))}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <button onClick={() => navigate("/teach/tasks")} className="inline-flex items-center gap-0.5 text-note font-semibold text-brand-deep hover:text-brand">
                {t("todoAll", { n: openCount })} <Icon icon={ChevronRight} size={14} />
              </button>
              <button onClick={() => navigate("/teach/cases/review")} className="inline-flex items-center gap-0.5 text-note font-semibold text-ink-soft hover:text-ink">
                {ttasks("casesReview")} <Icon icon={ChevronRight} size={14} />
              </button>
            </div>
          </Card>
        </AsyncSection>
      </section>

      {/* Analitika — sukut bo'yicha YIG'ILGAN. Hech narsa o'chirilmadi:
          ilgari sahifada doim ochiq turgan hamma narsa shu yerda. */}
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

      {rollCall && (
        <RollCallModal
          courseId={rollCall.courseId}
          date={rollCall.date}
          startTime={rollCall.startTime}
          groupId={rollCall.groupId ?? undefined}
          heading={rollCall.heading}
          onClose={() => setRollCall(null)}
        />
      )}
    </div>
  );
}
