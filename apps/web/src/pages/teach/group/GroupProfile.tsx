import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, ChevronRight as Chev, ClipboardCheck, DoorClosed, GraduationCap, ListPlus, Settings2, UserRoundPlus, UserX, Users2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Icon, Input, Modal, ProgressBar, ProgressRing, Select, Spinner, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { SubNav } from "../../../components/SubNav";
import { MonthCalendar, type CalEntry } from "../../../components/MonthCalendar";
import { QuickTaskModal } from "../../../components/QuickTaskModal";
import { Field } from "../../../components/Field";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import {
  useGroupTimetable,
  useSetupCycle,
  useTeachGroup,
  useTeacherLessons,
  type DerivedLesson,
  type GroupCourseReport,
  type GroupStudent,
  type TeachGroup,
} from "../api";
import { RollCallModal } from "../course/attendance/RollCallModal";
import { AttendanceMatrix } from "./AttendanceMatrix";

type TabKey = "timetable" | "davomat" | "students" | "courses";
const WEEKDAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const WEEKDAYS_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const CAL_WD_UZ = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];
const CAL_WD_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_UZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

function calTone(s: DerivedLesson["status"]): CalEntry["tone"] {
  return s === "FULL" ? "emerald" : s === "PARTIAL" ? "amber" : "brand";
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(base: Date, off: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
  return d;
}

/* ---------------- Group metrics ---------------- */
function GroupStats({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Card className="flex items-center gap-3">
        <ProgressRing value={group.avgProgress} size={62} stroke={7} tone="brand" />
        <span className="text-note font-medium text-ink-soft">{t("avgProgress")}</span>
      </Card>
      <Card className="flex items-center gap-3">
        <ProgressRing value={group.avgAttendance ?? 0} size={62} stroke={7} tone="blue" />
        <span className="text-note font-medium text-ink-soft">{t("avgAttendance")}</span>
      </Card>
      <Card className={cls("flex flex-col justify-center", group.behindCount > 0 && "border-rose/30 bg-rose-soft")}>
        <span className={cls("text-[28px] font-bold leading-none tabular-nums", group.behindCount > 0 ? "text-rose" : "text-ink")}>{group.behindCount}</span>
        <span className="mt-1 text-note font-medium text-ink-soft">{t("behindCount")}</span>
      </Card>
      <Card className="flex flex-col justify-center">
        <span className="text-[28px] font-bold leading-none tabular-nums text-ink">{group.studentCount}</span>
        <span className="mt-1 text-note font-medium text-ink-soft">{t("studentsCount")}</span>
      </Card>
    </div>
  );
}

/* ---------------- Students ---------------- */
function StudentRow({ s, onClick, onAssign, tRel }: { s: GroupStudent; onClick: () => void; onAssign: () => void; tRel: (iso: string | null) => string }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const initials = s.fullName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
  const lowAtt = s.attendancePct !== null && s.attendancePct < 75;
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-bg">
      <span className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums", s.rank <= 3 ? "bg-brand-soft text-brand-deep" : "bg-bg text-ink-faint")} title={t("rankHint")}>
        {s.rank}
      </span>
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-deep">{initials}</div>
        <div className="min-w-0 flex-[2]">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-medium text-ink">{s.fullName}</p>
            {s.behind && <Badge tone="rose">{t("behind")}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-note text-ink-faint">{tRel(s.lastActiveAt)}</p>
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
      </button>
      <button onClick={onAssign} title={t("assignToStudent")} aria-label={t("assignToStudent")} className="shrink-0 rounded-control p-1.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep">
        <Icon icon={ListPlus} size={16} />
      </button>
      <Icon icon={Chev} size={16} className="shrink-0 text-ink-faint" />
    </div>
  );
}

type SortKey = "rank" | "progress" | "attendance" | "quiz";
type FilterKey = "all" | "behind" | "lowAtt";

function StudentsTab({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const navigate = useNavigate();
  const locale = useLocale();
  const [assign, setAssign] = useState<{ studentId?: number; studentName?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("rank");
  const [filter, setFilter] = useState<FilterKey>("all");

  const relTime = (iso: string | null) => {
    if (!iso) return t("neverActive");
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return t("activeToday");
    if (days === 1) return t("activeYesterday");
    return locale === "ru" ? `${days} дн. назад` : `${days} kun oldin`;
  };

  const behindCount = group.students.filter((s) => s.behind).length;
  const lowAttCount = group.students.filter((s) => s.attendancePct !== null && s.attendancePct < 75).length;

  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = group.students.filter((s) => (q ? s.fullName.toLowerCase().includes(q) : true));
    if (filter === "behind") list = list.filter((s) => s.behind);
    else if (filter === "lowAtt") list = list.filter((s) => s.attendancePct !== null && s.attendancePct < 75);
    const sorted = [...list];
    if (sort === "rank") sorted.sort((a, b) => a.rank - b.rank);
    else if (sort === "progress") sorted.sort((a, b) => b.overallPct - a.overallPct);
    else if (sort === "attendance") sorted.sort((a, b) => (a.attendancePct ?? 999) - (b.attendancePct ?? 999));
    else sorted.sort((a, b) => (b.avgQuizScore ?? -1) - (a.avgQuizScore ?? -1));
    return sorted;
  }, [group.students, search, sort, filter]);

  if (group.students.length === 0)
    return <EmptyState icon={<Icon icon={UserRoundPlus} size={26} />} text={t("noStudents")} hint={t("noStudentsHint")} />;

  const FILTERS: { key: FilterKey; label: string; count?: number; tone: string }[] = [
    { key: "all", label: t("filterAll"), count: group.students.length, tone: "bg-brand-soft text-brand-deep" },
    { key: "behind", label: t("behind"), count: behindCount, tone: "bg-rose-soft text-rose" },
    { key: "lowAtt", label: t("filterLowAtt"), count: lowAttCount, tone: "bg-amber-soft text-amber" },
  ];

  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchStudent")} className="w-full sm:w-52" />
        <div className="inline-flex gap-1 rounded-control border border-line bg-surface p-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={cls("inline-flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-micro font-semibold transition-all", filter === f.key ? f.tone : "text-ink-soft hover:bg-bg")}>
              {f.label}{f.count !== undefined && <span className="tabular-nums opacity-70">{f.count}</span>}
            </button>
          ))}
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto">
          <option value="rank">{t("sortRank")}</option>
          <option value="progress">{t("sortProgress")}</option>
          <option value="attendance">{t("sortAttendance")}</option>
          <option value="quiz">{t("sortQuiz")}</option>
        </Select>
        <Button variant="soft" size="sm" icon={<Icon icon={ListPlus} size={15} />} onClick={() => setAssign({})} className="sm:ml-auto">{t("assignToGroup")}</Button>
      </div>
      {view.length === 0 ? (
        <Card><p className="py-4 text-center text-note text-ink-soft">{t("noMatch")}</p></Card>
      ) : (
        <Card className="divide-y divide-line p-0">
          {view.map((s) => (
            <StudentRow key={s.id} s={s} onClick={() => navigate(`/teach/students/${s.id}`)} onAssign={() => setAssign({ studentId: s.id, studentName: s.fullName })} tRel={relTime} />
          ))}
        </Card>
      )}
      <QuickTaskModal open={assign !== null} onClose={() => setAssign(null)} prefill={{ ...(assign ?? {}), groupId: group.id }} />
    </>
  );
}

/* ---------------- Timetable (haftalik jadval + yo'qlama) ---------------- */
function statusTone(s: DerivedLesson["status"]): string {
  return s === "FULL" ? "border-l-emerald bg-emerald-soft/40" : s === "PARTIAL" ? "border-l-amber bg-amber-soft/40" : "border-l-brand bg-surface";
}

function LessonDetailRow({ l, t, onMark }: { l: DerivedLesson; t: (k: string) => string; onMark: () => void }) {
  return (
    <div className={cls("flex flex-wrap items-center gap-3 border-l-4 px-4 py-2.5", statusTone(l.status))}>
      <span className="w-12 shrink-0 text-[14px] font-bold tabular-nums text-ink">{l.startTime}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-ink">{l.courseName}</p>
        {l.room && <p className="flex items-center gap-1 text-[12.5px] text-ink-faint"><Icon icon={DoorClosed} size={11} /> {l.room}</p>}
      </div>
      <span className="shrink-0 text-[12.5px] tabular-nums text-ink-faint">{l.markedCount}/{l.rosterSize}</span>
      <Button size="sm" variant={l.status === "FULL" ? "ghost" : "primary"} icon={<Icon icon={ClipboardCheck} size={15} />} onClick={onMark}>
        {l.status === "UNMARKED" ? t("rollCall") : t("editRollCall")}
      </Button>
    </div>
  );
}

function TimetableTab({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const locale = useLocale();
  const ru = locale === "ru";
  const dayNames = ru ? WEEKDAYS_RU : WEEKDAYS_UZ;
  const now = new Date();
  const [view, setView] = useState<"week" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthDate, setMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const [roll, setRoll] = useState<DerivedLesson | null>(null);

  const monday = useMemo(() => mondayOf(now, weekOffset), [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; }), [monday]);
  const todayKey = dayKey(now);

  const monthRange = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return { from: dayKey(start), to: dayKey(end) };
  }, [monthDate]);

  const range = view === "week" ? { from: dayKey(weekDays[0]), to: dayKey(weekDays[6]) } : monthRange;
  const lessonsQ = useTeacherLessons(range);
  const lessons = (lessonsQ.data ?? []).filter((l) => l.groupId === group.id);
  const byDay = useMemo(() => {
    const m = new Map<string, DerivedLesson[]>();
    for (const l of lessons) (m.get(l.dayKey) ?? m.set(l.dayKey, []).get(l.dayKey)!).push(l);
    return m;
  }, [lessons]);
  const entriesByDay = useMemo(() => {
    const m = new Map<string, CalEntry[]>();
    for (const [k, list] of byDay) {
      m.set(k, [...list].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((l) => ({ key: l.slotId + l.dayKey, time: l.startTime, title: l.courseName, tone: calTone(l.status), onClick: () => setRoll(l) })));
    }
    return m;
  }, [byDay]);
  const hasAnyLesson = lessons.length > 0;
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
        <Button size="sm" variant="soft" icon={<Icon icon={Settings2} size={15} />} onClick={() => setSetup(true)} className="ml-auto">{t("setupTimetable")}</Button>
      </div>

      {lessonsQ.isLoading ? (
        <div className="flex h-40 items-center justify-center"><Spinner size={22} /></div>
      ) : view === "month" ? (
        <>
          <Card className="!p-0 overflow-hidden">
            <MonthCalendar monthDate={monthDate} weekdayNames={ru ? CAL_WD_RU : CAL_WD_UZ} entriesByDay={entriesByDay} selectedKey={selectedDay} onSelectDay={(k) => setSelectedDay((cur) => (cur === k ? null : k))} />
          </Card>
          {selectedDay && (
            <Card className="!p-0 overflow-hidden">
              <div className="flex items-center gap-2 bg-bg px-4 py-2">
                <Icon icon={CalendarDays} size={14} className="text-ink-soft" />
                <span className="text-[13.5px] font-bold text-ink">{formatDate(ru ? "ru" : "uz", new Date(selectedDay), "long")}</span>
              </div>
              {selectedLessons.length === 0 ? (
                <p className="px-4 py-5 text-center text-[13.5px] text-ink-faint">{t("noneThisDay")}</p>
              ) : (
                <div className="divide-y divide-line">{selectedLessons.map((l) => <LessonDetailRow key={l.slotId + l.dayKey} l={l} t={t} onMark={() => setRoll(l)} />)}</div>
              )}
            </Card>
          )}
        </>
      ) : !hasAnyLesson ? (
        <EmptyState
          icon={<Icon icon={CalendarDays} size={26} />}
          text={t("noTimetable")}
          hint={t("noTimetableHint")}
          action={<Button size="sm" icon={<Icon icon={Settings2} size={15} />} onClick={() => setSetup(true)}>{t("setupTimetable")}</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {weekDays.map((d, i) => {
            const k = dayKey(d);
            const list = [...(byDay.get(k) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
            if (list.length === 0) return null;
            const isToday = k === todayKey;
            return (
              <Card key={k} className={cls("!p-0 overflow-hidden", isToday && "ring-2 ring-brand")}>
                <div className={cls("flex items-center gap-2 px-4 py-2", isToday ? "bg-brand-soft" : "bg-bg")}>
                  <span className={cls("text-[13.5px] font-bold", isToday ? "text-brand-deep" : "text-ink")}>{dayNames[i]}</span>
                  <span className="text-[12.5px] text-ink-faint">{formatDate(ru ? "ru" : "uz", d, "short")}</span>
                  {isToday && <span className="rounded-pill bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{t("today")}</span>}
                </div>
                <div className="divide-y divide-line">{list.map((l) => <LessonDetailRow key={l.slotId + l.dayKey} l={l} t={t} onMark={() => setRoll(l)} />)}</div>
              </Card>
            );
          })}
        </div>
      )}

      {setup && <TimetableSetupModal group={group} onClose={() => setSetup(false)} />}
      {roll && (
        <RollCallModal
          courseId={roll.courseId}
          date={roll.dayKey}
          startTime={roll.startTime}
          groupId={group.id}
          heading={`${roll.courseName} · ${formatDate(ru ? "ru" : "uz", new Date(roll.date), "short")} · ${roll.startTime}`}
          onClose={() => setRoll(null)}
        />
      )}
    </div>
  );
}

/** SIKL MASTERI — bir marta: kurs + sana oralig'i + har kun (o'z vaqti/xonasi) →
 *  butun sikl jadvali yaratiladi (RRULE uslubi: haftalik, tanlangan kunlar, oxirgi
 *  sanagacha). Har dars uchun alohida qo'shish shart emas. */
function TimetableSetupModal({ group, onClose }: { group: TeachGroup; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const dayNames = locale === "ru" ? WEEKDAYS_RU : WEEKDAYS_UZ;
  const { show } = useToast();
  const ttQ = useGroupTimetable(group.id);
  const save = useSetupCycle();

  const [courseId, setCourseId] = useState(String(group.courses[0]?.id ?? ""));
  const [cycleStart, setCycleStart] = useState("");
  const [cycleEnd, setCycleEnd] = useState("");
  const [days, setDays] = useState(() => Array.from({ length: 7 }, () => ({ on: false, time: "09:00", room: "" })));
  const [err, setErr] = useState<string | null>(null);

  // Tanlangan kursning MAVJUD siklini prefill qilamiz (tahrirlash uchun).
  const courseData = ttQ.data?.courses.find((c) => String(c.courseId) === courseId);
  useEffect(() => {
    if (!ttQ.data) return;
    setCycleStart(courseData?.cycleStart ?? "");
    setCycleEnd(courseData?.cycleEnd ?? "");
    const next = Array.from({ length: 7 }, () => ({ on: false, time: "09:00", room: "" }));
    for (const s of courseData?.slots ?? []) next[s.weekday] = { on: true, time: s.startTime, room: s.room ?? "" };
    setDays(next);
  }, [courseId, ttQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const weeks = cycleStart && cycleEnd
    ? Math.max(1, Math.ceil(((new Date(cycleEnd).getTime() - new Date(cycleStart).getTime()) / 86_400_000 + 1) / 7))
    : 0;
  const setDay = (i: number, patch: Partial<{ on: boolean; time: string; room: string }>) =>
    setDays((d) => d.map((x, n) => (n === i ? { ...x, ...patch } : x)));

  const submit = () => {
    setErr(null);
    if (!cycleStart || !cycleEnd) { setErr(t("cycleNeedDates")); return; }
    const chosen = days.map((d, i) => ({ ...d, weekday: i })).filter((d) => d.on);
    if (chosen.length === 0) { setErr(t("cycleNeedDays")); return; }
    save.mutate(
      { courseId: Number(courseId), groupId: group.id, cycleStart, cycleEnd, days: chosen.map((d) => ({ weekday: d.weekday, startTime: d.time, room: d.room.trim() || undefined })) },
      { onSuccess: (r) => { show(t("cycleCreated", { n: r.days })); onClose(); }, onError: (e) => setErr((e as Error).message || tc("genericError")) }
    );
  };

  return (
    <Modal open onClose={onClose} title={t("setupTimetable")} className="max-w-xl">
      <div className="space-y-4">
        <p className="text-[13.5px] text-ink-soft">{t("cycleHint")}</p>

        <Field label={t("course")}>
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {group.courses.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </Select>
        </Field>

        {/* 1-qadam: sikl davri */}
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">{t("cyclePeriod")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("cycleStart")}><Input type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} /></Field>
            <Field label={t("cycleEnd")}><Input type="date" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} /></Field>
          </div>
          {weeks > 0 && <p className="mt-1 text-[13px] font-semibold text-brand-deep">≈ {t("cycleWeeks", { n: weeks })}</p>}
        </div>

        {/* 2-qadam: kunlar + har kunga o'z vaqti/xonasi */}
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">{t("cycleDays")}</p>
          <div className="space-y-1.5">
            {dayNames.map((dn, i) => (
              <div key={i} className={cls("flex flex-wrap items-center gap-2 rounded-control border px-3 py-2 transition-colors", days[i].on ? "border-brand/40 bg-brand-soft/30" : "border-line")}>
                <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2 text-[14px] font-semibold text-ink">
                  <input type="checkbox" checked={days[i].on} onChange={(e) => setDay(i, { on: e.target.checked })} />
                  {dn}
                </label>
                {days[i].on ? (
                  <>
                    <Input type="time" value={days[i].time} onChange={(e) => setDay(i, { time: e.target.value })} className="w-28" />
                    <Input value={days[i].room} onChange={(e) => setDay(i, { room: e.target.value })} placeholder={t("room")} className="w-28" />
                  </>
                ) : (
                  <span className="text-[13px] text-ink-faint">{t("cycleDayOff")}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {err && <p className="text-[13.5px] text-rose">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={save.isPending || !courseId}>{t("cycleCreate")}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Courses report ---------------- */
function CourseReportCard({ c, onView }: { c: GroupCourseReport; onView: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-deep"><Icon icon={BookOpen} size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-bold text-ink">{c.name}</p>
          <p className="mt-0.5 text-note text-ink-faint">{t("reportTopicsN", { n: c.topicsTotal })} · {t("reportStudentsN", { n: c.studentCount })}</p>
        </div>
        {c.behindCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-rose-soft px-2 py-0.5 text-micro font-semibold text-rose">
            <Icon icon={UserX} size={12} /> {c.behindCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <ProgressRing value={c.avgProgress} size={64} stroke={7} tone="brand" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="flex items-center justify-between text-note">
              <span className="text-ink-soft">{t("avgProgress")}</span>
              <span className="font-bold tabular-nums text-ink">{c.avgProgress}%</span>
            </div>
            <ProgressBar value={c.avgProgress} tone="brand" className="mt-1" />
          </div>
          <div>
            <div className="flex items-center justify-between text-note">
              <span className="text-ink-soft">{t("reportAvgQuiz")}</span>
              <span className="font-bold tabular-nums text-ink">{c.avgQuizScore === null ? "—" : `${c.avgQuizScore}%`}</span>
            </div>
            <ProgressBar value={c.avgQuizScore ?? 0} tone="blue" className="mt-1" />
          </div>
        </div>
      </div>

      <Button variant="soft" size="sm" icon={<Icon icon={ArrowRight} size={15} />} onClick={onView} className="self-start">
        {t("reportView")}
      </Button>
    </Card>
  );
}

function CoursesTab({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const navigate = useNavigate();
  const report = group.courseReport ?? [];

  if (report.length === 0)
    return <EmptyState icon={<Icon icon={BookOpen} size={26} />} text={t("noCourses")} hint={t("noCoursesHint")} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-note text-ink-soft">{t("reportHint")}</p>
        <Button variant="ghost" size="sm" icon={<Icon icon={BookOpen} size={15} />} onClick={() => navigate("/teach/courses")}>
          {t("allCourses")}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {report.map((c) => (
          <CourseReportCard key={c.id} c={c} onView={() => navigate(`/teach/courses/${c.id}`)} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export function GroupProfile() {
  const { id } = useParams();
  const groupId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = useTeachGroup(groupId);
  const group = q.data;

  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = raw === "students" || raw === "courses" || raw === "davomat" ? raw : "timetable";
  const setTab = (k: TabKey) => setParams({ tab: k }, { replace: true });

  const TABS: { key: TabKey; icon: typeof Users2 }[] = [
    { key: "timetable", icon: CalendarDays },
    { key: "davomat", icon: ClipboardCheck },
    { key: "students", icon: Users2 },
    { key: "courses", icon: BookOpen },
  ];

  return (
    <div>
      <button onClick={() => navigate("/teach/groups")} className="mb-3 flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {group && (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                  <Icon icon={Users2} size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-h1 font-bold text-ink">{group.name}</h1>
                  <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-ink-soft">
                    <span>{t("yearN", { n: group.yearOfStudy })}</span>
                    <span>·</span>
                    <span>{group.facultyName}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Icon icon={GraduationCap} size={14} /> {t("studentsN", { n: group.studentCount })}</span>
                  </p>
                </div>
                {/* Kurs chiplari — bosilsa "Kurslar" hisobot tabini ochadi
                    (to'g'ridan-to'g'ri kursga o'tkazmaydi; hisobot shu yerda). */}
                <div className="flex flex-wrap gap-1.5">
                  {group.courses.map((c) => (
                    <button key={c.id} onClick={() => setTab("courses")} title={t("openReport")} className="rounded-pill bg-brand-soft px-2.5 py-1 text-[13.5px] font-semibold text-brand-deep transition-colors hover:bg-brand/10">
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <GroupStats group={group} />

              {/* Guruh bo'limlari — yon panelda (mobilda tasma). */}
              <div className="mt-3">
                <SubNav
                  title={group.name}
                  activeKey={tab}
                  items={TABS.map((x) => ({
                    key: x.key,
                    label: t(`tabs.${x.key}`),
                    to: `/teach/groups/${groupId}?tab=${x.key}`,
                    icon: <Icon icon={x.icon} size={16} />,
                  }))}
                />
              </div>

              <div className="mt-5">
                {tab === "timetable" ? <TimetableTab group={group} /> : tab === "davomat" ? <AttendanceMatrix group={group} /> : tab === "courses" ? <CoursesTab group={group} /> : <StudentsTab group={group} />}
              </div>
            </>
          )}
        </AsyncSection>
      )}
    </div>
  );
}
