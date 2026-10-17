import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, DoorClosed, UserRoundPlus, UserX } from "lucide-react";
import { Badge, Button, EmptyState, Icon, ProgressBar, Spinner, cls } from "@meduni/ui";
import { BentoCard, HeaderChip, MetricTile, PageHeader } from "../../../components/bento";
import { AsyncSection } from "../../../components/AsyncSection";
import { MonthCalendar, type CalEntry } from "../../../components/MonthCalendar";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import { isLowAttendance } from "../../../lib/attendance";
import { BackLink, PillTabs } from "../components";
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

const navBtn =
  "rounded-full p-2 text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/* ---------------- Ko'rsatkichlar ----------------
   ⛔ STAT DIETASI: har kartochka tegishli tabni ochadi (o'tish), talabalar soni —
   shapkadagi MATN. */
function GroupStats({ g, onTab }: { g: AdminGroup; onTab: (k: TabKey) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricTile size="stat" label={t("avgProgress")} value={g.avgProgress} percent tone="violet" onClick={() => onTab("students")} />
      <MetricTile
        size="stat"
        label={t("avgAttendance")}
        value={g.avgAttendance}
        percent
        tone={isLowAttendance(g.avgAttendance) ? "rose" : "amber"}
        onClick={() => onTab("timetable")}
      />
      <MetricTile
        size="stat"
        label={t("behindCount")}
        value={g.behindCount}
        valueTone={g.behindCount > 0 ? "rose" : "ink"}
        onClick={() => onTab("students")}
      />
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
    <BentoCard title={t("tabs.students")} count={rows.length} bodyClassName="px-2 pb-3">
      <ul className="space-y-0.5">
        {rows.map((s) => (
          <li key={s.id}>
            <StudentRow s={s} onClick={() => navigate(`/admin/users/${s.id}`)} />
          </li>
        ))}
      </ul>
    </BentoCard>
  );
}
function StudentRow({ s, onClick }: { s: AdminGroupStudent; onClick: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  const initials = s.fullName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
  const lowAtt = isLowAttendance(s.attendancePct);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-data text-micro font-semibold tabular-nums", s.rank <= 3 ? "bg-ink text-surface" : "bg-surface-raised text-ink-soft")}>{s.rank}</span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-micro font-semibold text-brand-deep">{initials}</span>
      <span className="min-w-0 flex-[2]">
        <span className="flex items-center gap-2">
          <span className="truncate text-body font-semibold text-ink">{s.fullName}</span>
          {s.behind && <Badge tone="rose">{t("behind")}</Badge>}
        </span>
        <span className="block truncate text-micro text-ink-soft">{s.email}</span>
      </span>
      <span className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
        <ProgressBar value={s.overallPct} className="flex-1" />
        <span className="w-9 shrink-0 text-right font-data text-note font-semibold tabular-nums text-ink-2">{s.overallPct}%</span>
      </span>
      <span className="hidden w-14 shrink-0 text-right sm:block">
        <span className="block text-micro text-ink-soft">{t("quiz")}</span>
        <span className="font-data text-note font-semibold tabular-nums text-ink">{s.avgQuizScore === null ? "—" : `${s.avgQuizScore}%`}</span>
      </span>
      <span className="w-14 shrink-0 text-right">
        <span className="block text-micro text-ink-soft">{t("att")}</span>
        <span className={cls("font-data text-note font-semibold tabular-nums", lowAtt ? "text-rose" : "text-ink")}>{s.attendancePct === null ? "—" : `${s.attendancePct}%`}</span>
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface">
        <Icon icon={ArrowRight} size={13} />
      </span>
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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {g.courseReport.map((c) => (
        <CourseCard key={c.id} c={c} onView={() => navigate(`/admin/courses/${c.id}`)} />
      ))}
    </div>
  );
}
function CourseCard({ c, onView }: { c: AdminGroupCourse; onView: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminGroup" });
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-tint"><Icon icon={BookOpen} size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-section font-semibold text-ink">{c.name}</p>
          <p className="mt-0.5 truncate text-micro text-ink-soft">{c.teacherName} · {t("topicsN", { n: c.topicsTotal })} · {t("studentsN", { n: c.studentCount })}</p>
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
      <Button variant="ghost" size="sm" icon={<Icon icon={ArrowRight} size={15} />} onClick={onView} className="mt-auto self-start">{t("openCourse")}</Button>
    </section>
  );
}
function Metric({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: "brand" | "blue" | "violet" }) {
  return (
    <div>
      <div className="flex items-center justify-between text-note">
        <span className="text-ink-soft">{label}</span>
        <span className="font-data font-semibold tabular-nums text-ink">{value}</span>
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
        <PillTabs
          value={view}
          onChange={setView}
          options={[
            { key: "week", label: t("viewWeek") },
            { key: "month", label: t("viewMonth") },
          ]}
        />
        {view === "week" ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setWeekOffset((w) => w - 1)} className={navBtn} aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
            <span className="min-w-36 text-center text-note font-semibold text-ink">{weekLabel}</span>
            <button type="button" onClick={() => setWeekOffset((w) => w + 1)} className={navBtn} aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
            {weekOffset !== 0 && <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>{t("today")}</Button>}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} className={navBtn} aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
            <span className="min-w-36 text-center text-note font-semibold capitalize text-ink">{monthLabel}</span>
            <button type="button" onClick={() => shiftMonth(1)} className={navBtn} aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
            <Button size="sm" variant="ghost" onClick={() => { setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(null); }}>{t("today")}</Button>
          </div>
        )}
      </div>

      {q.isLoading ? (
        <div className="flex h-40 items-center justify-center"><Spinner size={22} /></div>
      ) : q.isError ? (
        <AsyncSection isLoading={false} isError isEmpty={false} emptyText="" onRetry={() => q.refetch()}>{null}</AsyncSection>
      ) : lessons.length === 0 ? (
        <EmptyState icon={<Icon icon={CalendarDays} size={26} />} text={t("noTimetable")} hint={t("noTimetableHint")} />
      ) : view === "month" ? (
        <>
          <section className="overflow-hidden rounded-card border border-line bg-surface">
            <MonthCalendar monthDate={monthDate} weekdayNames={ru ? CAL_WD_RU : CAL_WD_UZ} entriesByDay={entriesByDay} selectedKey={selectedDay} onSelectDay={(k) => setSelectedDay((cur) => (cur === k ? null : k))} />
          </section>
          {selectedDay && (
            <DayCard title={formatDate(ru ? "ru" : "uz", new Date(selectedDay), "long")}>
              {selectedLessons.length === 0 ? <p className="px-4 py-5 text-center text-note text-ink-soft">{t("noneThisDay")}</p> : selectedLessons.map((l) => <LessonRow key={l.slotId + l.dayKey} l={l} t={t} />)}
            </DayCard>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {weekDays.map((d) => {
            const list = [...(byDay.get(dayKey(d)) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
            if (list.length === 0) return null;
            return (
              <DayCard key={dayKey(d)} title={formatDate(ru ? "ru" : "uz", d, "long")}>
                {list.map((l) => <LessonRow key={l.slotId + l.dayKey} l={l} t={t} />)}
              </DayCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
function DayCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center gap-2 px-4 pb-1 pt-3">
        <Icon icon={CalendarDays} size={14} className="text-ink-soft" />
        <span className="text-note font-semibold text-ink">{title}</span>
      </header>
      <div className="divide-y divide-line-soft px-2 pb-2">{children}</div>
    </section>
  );
}
function statusDot(s: AdminGroupLesson["status"]): string {
  return s === "FULL" ? "bg-emerald" : s === "PARTIAL" ? "bg-amber" : "bg-brand";
}
function LessonRow({ l, t }: { l: AdminGroupLesson; t: (k: string) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-2 py-2.5">
      <span className="w-14 shrink-0 rounded-control bg-surface-raised py-1.5 text-center font-data text-note font-semibold tabular-nums text-ink">{l.startTime}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-note font-semibold text-ink">{l.courseName}</p>
        {l.room && <p className="flex items-center gap-1 text-micro text-ink-soft"><Icon icon={DoorClosed} size={11} /> {l.room}</p>}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 font-data text-micro tabular-nums text-ink-soft">
        <span className={cls("h-2 w-2 rounded-full", statusDot(l.status))} />
        {l.markedCount}/{l.rosterSize} · <span className="font-sans">{t(`status.${l.status}`)}</span>
      </span>
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

  return (
    <div className="space-y-3">
      <div>
        <BackLink label={t("back")} onClick={() => navigate("/admin/students")} />
        {g && (
          <PageHeader
            className="mb-0"
            title={g.name}
            subtitle={[t("yearN", { n: g.yearOfStudy }), g.facultyName, t("studentsN", { n: g.studentCount })].join(" · ")}
            right={g.courses.map((c) => (
              <HeaderChip key={c.id} tone="brand" icon={<Icon icon={BookOpen} size={14} />} onClick={() => setTab("courses")} title={t("openReport")}>
                {c.name}
              </HeaderChip>
            ))}
          />
        )}
      </div>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {g && (
            <div className="space-y-3">
              <GroupStats g={g} onTab={setTab} />

              <PillTabs
                value={tab}
                onChange={setTab}
                options={(["students", "courses", "timetable"] as const).map((k) => ({ key: k, label: t(`tabs.${k}`) }))}
              />

              {tab === "students" ? <StudentsTab g={g} /> : tab === "courses" ? <CoursesTab g={g} /> : <TimetableTab g={g} />}
            </div>
          )}
        </AsyncSection>
      )}
    </div>
  );
}
