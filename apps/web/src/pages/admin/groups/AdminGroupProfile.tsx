import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, ChevronRight as Chev, DoorClosed, GraduationCap, UserRoundPlus, Users2, UserX } from "lucide-react";
import { Badge, Button, Card, EmptyState, Icon, ProgressBar, ProgressRing, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { MonthCalendar, type CalEntry } from "../../../components/MonthCalendar";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import { useAdminGroup, useAdminGroupLessons, type AdminGroup, type AdminGroupCourse, type AdminGroupLesson, type AdminGroupStudent } from "../api";

type TabKey = "students" | "courses" | "timetable";
const CAL_WD_UZ = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];
const CAL_WD_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_UZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(base: Date, off: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
  return d;
}
function calTone(s: AdminGroupLesson["status"]): CalEntry["tone"] {
  return s === "FULL" ? "emerald" : s === "PARTIAL" ? "amber" : "brand";
}

/* ---------------- Stats ---------------- */
function GroupStats({ g }: { g: AdminGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Card className="flex items-center gap-3">
        <ProgressRing value={g.avgProgress} size={62} stroke={7} tone="brand" />
        <span className="text-note font-medium text-ink-soft">{t("avgProgress")}</span>
      </Card>
      <Card className="flex items-center gap-3">
        <ProgressRing value={g.avgAttendance ?? 0} size={62} stroke={7} tone="blue" />
        <span className="text-note font-medium text-ink-soft">{t("avgAttendance")}</span>
      </Card>
      <Card className={cls("flex flex-col justify-center", g.behindCount > 0 && "border-rose/30 bg-rose-soft")}>
        <span className={cls("text-[28px] font-bold leading-none tabular-nums", g.behindCount > 0 ? "text-rose" : "text-ink")}>{g.behindCount}</span>
        <span className="mt-1 text-note font-medium text-ink-soft">{t("behindCount")}</span>
      </Card>
      <Card className="flex flex-col justify-center">
        <span className="text-[28px] font-bold leading-none tabular-nums text-ink">{g.studentCount}</span>
        <span className="mt-1 text-note font-medium text-ink-soft">{t("studentsCount")}</span>
      </Card>
    </div>
  );
}

/* ---------------- Students (read-only) ---------------- */
function StudentsTab({ g }: { g: AdminGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  const navigate = useNavigate();
  if (g.students.length === 0)
    return <EmptyState icon={<Icon icon={UserRoundPlus} size={26} />} text={t("noStudents")} hint={t("noStudentsHint")} />;
  const rows = [...g.students].sort((a, b) => a.rank - b.rank);
  return (
    <Card className="divide-y divide-line p-0">
      {rows.map((s) => (
        <StudentRow key={s.id} s={s} onClick={() => navigate(`/admin/users/${s.id}`)} />
      ))}
    </Card>
  );
}
function StudentRow({ s, onClick }: { s: AdminGroupStudent; onClick: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  const initials = s.fullName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
  const lowAtt = s.attendancePct !== null && s.attendancePct < 75;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg">
      <span className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums", s.rank <= 3 ? "bg-brand-soft text-brand-deep" : "bg-bg text-ink-faint")}>{s.rank}</span>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-deep">{initials}</div>
      <div className="min-w-0 flex-[2]">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-medium text-ink">{s.fullName}</p>
          {s.behind && <Badge tone="rose">{t("behind")}</Badge>}
        </div>
        <p className="truncate text-note text-ink-faint">{s.email}</p>
      </div>
      <div className="hidden min-w-0 flex-1 sm:block">
        <div className="flex items-center gap-2">
          <ProgressBar value={s.overallPct} className="flex-1" />
          <span className="w-9 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink-soft">{s.overallPct}%</span>
        </div>
      </div>
      <div className="hidden w-14 shrink-0 text-right sm:block">
        <span className="text-[13px] text-ink-faint">{t("quiz")}</span>
        <p className="text-[14px] font-bold tabular-nums text-ink">{s.avgQuizScore === null ? "—" : `${s.avgQuizScore}%`}</p>
      </div>
      <div className="w-14 shrink-0 text-right">
        <span className="text-[13px] text-ink-faint">{t("att")}</span>
        <p className={cls("text-[14px] font-bold tabular-nums", lowAtt ? "text-rose" : "text-ink")}>{s.attendancePct === null ? "—" : `${s.attendancePct}%`}</p>
      </div>
      <Icon icon={Chev} size={16} className="shrink-0 text-ink-faint" />
    </button>
  );
}

/* ---------------- Courses report ---------------- */
function CoursesTab({ g }: { g: AdminGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  const navigate = useNavigate();
  if (g.courseReport.length === 0)
    return <EmptyState icon={<Icon icon={BookOpen} size={26} />} text={t("noCourses")} hint={t("noCoursesHint")} />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {g.courseReport.map((c) => (
        <CourseCard key={c.id} c={c} onView={() => navigate(`/admin/courses/${c.id}`)} />
      ))}
    </div>
  );
}
function CourseCard({ c, onView }: { c: AdminGroupCourse; onView: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-deep"><Icon icon={BookOpen} size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-bold text-ink">{c.name}</p>
          <p className="mt-0.5 truncate text-note text-ink-faint">{c.teacherName} · {t("topicsN", { n: c.topicsTotal })} · {t("studentsN", { n: c.studentCount })}</p>
        </div>
        {c.behindCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-rose-soft px-2 py-0.5 text-micro font-semibold text-rose"><Icon icon={UserX} size={12} /> {c.behindCount}</span>
        )}
      </div>
      <div className="space-y-2">
        <Metric label={t("avgProgress")} value={`${c.avgProgress}%`} pct={c.avgProgress} tone="brand" />
        <Metric label={t("att")} value={c.attendancePct === null ? "—" : `${c.attendancePct}%`} pct={c.attendancePct ?? 0} tone="blue" />
        <Metric label={t("quiz")} value={c.avgQuizScore === null ? "—" : `${c.avgQuizScore}%`} pct={c.avgQuizScore ?? 0} tone="violet" />
      </div>
      <Button variant="soft" size="sm" icon={<Icon icon={ArrowRight} size={15} />} onClick={onView} className="self-start">{t("openCourse")}</Button>
    </Card>
  );
}
function Metric({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: "brand" | "blue" | "violet" }) {
  return (
    <div>
      <div className="flex items-center justify-between text-note">
        <span className="text-ink-soft">{label}</span>
        <span className="font-bold tabular-nums text-ink">{value}</span>
      </div>
      <ProgressBar value={pct} tone={tone} className="mt-1" />
    </div>
  );
}

/* ---------------- Timetable (read-only, week/month) ---------------- */
function TimetableTab({ g }: { g: AdminGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  const locale = useLocale();
  const ru = locale === "ru";
  const now = new Date();
  const [view, setView] = useState<"week" | "month">("month");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthDate, setMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const monday = useMemo(() => mondayOf(now, weekOffset), [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; }), [monday]);
  const monthRange = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return { from: dayKey(start), to: dayKey(end) };
  }, [monthDate]);
  const range = view === "week" ? { from: dayKey(weekDays[0]), to: dayKey(weekDays[6]) } : monthRange;
  const q = useAdminGroupLessons(g.id, range);
  const lessons = q.data ?? [];

  const byDay = useMemo(() => {
    const m = new Map<string, AdminGroupLesson[]>();
    for (const l of lessons) (m.get(l.dayKey) ?? m.set(l.dayKey, []).get(l.dayKey)!).push(l);
    return m;
  }, [lessons]);
  const entriesByDay = useMemo(() => {
    const m = new Map<string, CalEntry[]>();
    for (const [k, list] of byDay) {
      m.set(k, [...list].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((l) => ({ key: l.slotId + l.dayKey, time: l.startTime, title: l.courseName, tone: calTone(l.status) })));
    }
    return m;
  }, [byDay]);
  const selectedLessons = selectedDay ? [...(byDay.get(selectedDay) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];

  const weekLabel = `${formatDate(ru ? "ru" : "uz", weekDays[0], "short")} – ${formatDate(ru ? "ru" : "uz", weekDays[6], "short")}`;
  const monthLabel = ru ? monthDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }) : `${MONTHS_UZ[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  const shiftMonth = (dir: -1 | 1) => { setSelectedDay(null); setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1)); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex gap-1 rounded-control border border-line bg-surface p-1">
          {(["week", "month"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cls("rounded-[8px] px-3.5 py-1.5 text-micro font-semibold transition-all", view === v ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink")}>
              {t(v === "week" ? "viewWeek" : "viewMonth")}
            </button>
          ))}
        </div>
        {view === "week" ? (
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
            <span className="min-w-[150px] text-center text-[14px] font-semibold text-ink">{weekLabel}</span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
            {weekOffset !== 0 && <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>{t("today")}</Button>}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
            <span className="min-w-[150px] text-center text-[14px] font-semibold capitalize text-ink">{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
            <Button size="sm" variant="ghost" onClick={() => { setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(null); }}>{t("today")}</Button>
          </div>
        )}
      </div>

      {q.isLoading ? (
        <div className="flex h-40 items-center justify-center"><Spinner size={22} /></div>
      ) : lessons.length === 0 ? (
        <EmptyState icon={<Icon icon={CalendarDays} size={26} />} text={t("noTimetable")} hint={t("noTimetableHint")} />
      ) : view === "month" ? (
        <>
          <Card className="!p-0 overflow-hidden">
            <MonthCalendar monthDate={monthDate} weekdayNames={ru ? CAL_WD_RU : CAL_WD_UZ} entriesByDay={entriesByDay} selectedKey={selectedDay} onSelectDay={(k) => setSelectedDay((cur) => (cur === k ? null : k))} />
          </Card>
          {selectedDay && (
            <Card className="!p-0 overflow-hidden">
              <div className="flex items-center gap-2 bg-bg px-4 py-2"><Icon icon={CalendarDays} size={14} className="text-ink-soft" /><span className="text-[13.5px] font-bold text-ink">{formatDate(ru ? "ru" : "uz", new Date(selectedDay), "long")}</span></div>
              {selectedLessons.length === 0 ? <p className="px-4 py-5 text-center text-[13.5px] text-ink-faint">{t("noneThisDay")}</p> : <div className="divide-y divide-line">{selectedLessons.map((l) => <LessonRow key={l.slotId + l.dayKey} l={l} t={t} />)}</div>}
            </Card>
          )}
        </>
      ) : (
        <div className="space-y-2.5">
          {weekDays.map((d) => {
            const list = [...(byDay.get(dayKey(d)) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
            if (list.length === 0) return null;
            return (
              <Card key={dayKey(d)} className="!p-0 overflow-hidden">
                <div className="bg-bg px-4 py-2 text-[13.5px] font-bold text-ink">{formatDate(ru ? "ru" : "uz", d, "long")}</div>
                <div className="divide-y divide-line">{list.map((l) => <LessonRow key={l.slotId + l.dayKey} l={l} t={t} />)}</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
function statusBorder(s: AdminGroupLesson["status"]): string {
  return s === "FULL" ? "border-l-emerald" : s === "PARTIAL" ? "border-l-amber" : "border-l-brand";
}
function LessonRow({ l, t }: { l: AdminGroupLesson; t: (k: string) => string }) {
  return (
    <div className={cls("flex flex-wrap items-center gap-3 border-l-4 px-4 py-2.5", statusBorder(l.status))}>
      <span className="w-12 shrink-0 text-[14px] font-bold tabular-nums text-ink">{l.startTime}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-ink">{l.courseName}</p>
        {l.room && <p className="flex items-center gap-1 text-[12.5px] text-ink-faint"><Icon icon={DoorClosed} size={11} /> {l.room}</p>}
      </div>
      <span className="shrink-0 text-[12.5px] tabular-nums text-ink-faint">{l.markedCount}/{l.rosterSize} · {t(`status.${l.status}`)}</span>
    </div>
  );
}

/* ---------------- Page ---------------- */
export function AdminGroupProfile() {
  const { id } = useParams();
  const groupId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = useAdminGroup(groupId);
  const g = q.data;

  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = raw === "courses" || raw === "timetable" ? raw : "students";
  const setTab = (k: TabKey) => setParams({ tab: k }, { replace: true });

  const TABS: { key: TabKey; icon: typeof Users2 }[] = [
    { key: "students", icon: Users2 },
    { key: "courses", icon: BookOpen },
    { key: "timetable", icon: CalendarDays },
  ];

  return (
    <div>
      <button onClick={() => navigate("/admin/students")} className="mb-3 flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {g && (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep"><Icon icon={Users2} size={26} /></div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-h1 font-bold text-ink">{g.name}</h1>
                  <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-ink-soft">
                    <span>{t("yearN", { n: g.yearOfStudy })}</span><span>·</span><span>{g.facultyName}</span><span>·</span>
                    <span className="inline-flex items-center gap-1"><Icon icon={GraduationCap} size={14} /> {t("studentsN", { n: g.studentCount })}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.courses.map((c) => (
                    <button key={c.id} onClick={() => setTab("courses")} title={t("openReport")} className="rounded-pill bg-brand-soft px-2.5 py-1 text-[13.5px] font-semibold text-brand-deep transition-colors hover:bg-brand/10">{c.name}</button>
                  ))}
                </div>
              </div>

              <GroupStats g={g} />

              <div className="mt-3 inline-flex max-w-full gap-1 overflow-x-auto rounded-control border border-line bg-surface p-1 shadow-card">
                {TABS.map((x) => (
                  <button key={x.key} onClick={() => setTab(x.key)} className={cls("flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] px-4 py-2 text-[15px] font-semibold transition-all", tab === x.key ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink")}>
                    <Icon icon={x.icon} size={16} />{t(`tabs.${x.key}`)}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                {tab === "students" ? <StudentsTab g={g} /> : tab === "courses" ? <CoursesTab g={g} /> : <TimetableTab g={g} />}
              </div>
            </>
          )}
        </AsyncSection>
      )}
    </div>
  );
}
