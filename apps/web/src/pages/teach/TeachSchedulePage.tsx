import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Clock, DoorClosed, Search, Users2 } from "lucide-react";
import { Button, Card, Icon, Select, Spinner, StatCard, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { MonthCalendar, type CalEntry } from "../../components/MonthCalendar";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { RollCallModal } from "./course/attendance/RollCallModal";
import { useTeacherLessons, useTeachGroups, type DerivedLesson } from "./api";

const WEEKDAYS_SHORT_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const WEEKDAYS_SHORT_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
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
function statusBorder(s: DerivedLesson["status"]): string {
  return s === "FULL" ? "border-l-emerald" : s === "PARTIAL" ? "border-l-amber" : "border-l-brand";
}
function statusCount(s: DerivedLesson["status"]): string {
  return s === "FULL" ? "text-emerald" : s === "PARTIAL" ? "text-amber" : "text-ink-faint";
}
function calTone(s: DerivedLesson["status"]): CalEntry["tone"] {
  return s === "FULL" ? "emerald" : s === "PARTIAL" ? "amber" : "brand";
}

/** Bitta katakdagi dars kartasi — bosilsa yo'qlama ochiladi. */
function LessonCell({ l, onMark }: { l: DerivedLesson; onMark: () => void }) {
  return (
    <button
      onClick={onMark}
      className={cls("group flex w-full flex-col gap-0.5 rounded-control border-l-4 bg-surface px-2.5 py-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-brand", statusBorder(l.status))}
    >
      <p className="truncate text-micro font-bold text-ink">{l.courseName}</p>
      <div className="flex flex-wrap items-center gap-x-2 text-micro text-ink-soft">
        {l.groupName && <span className="inline-flex items-center gap-1"><Icon icon={Users2} size={11} /> {l.groupName}</span>}
        {l.room && <span className="inline-flex items-center gap-1"><Icon icon={DoorClosed} size={11} /> {l.room}</span>}
      </div>
      <div className="mt-0.5 flex items-center justify-between">
        <span className={cls("text-micro font-semibold tabular-nums", statusCount(l.status))}>{l.markedCount}/{l.rosterSize}</span>
        <Icon icon={ClipboardCheck} size={13} className="text-ink-faint opacity-0 transition-opacity group-hover:text-brand-deep group-hover:opacity-100" />
      </div>
    </button>
  );
}

export function TeachSchedulePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "teachSchedule" });
  const locale = useLocale();
  const ru = locale === "ru";
  const dayShort = ru ? WEEKDAYS_SHORT_RU : WEEKDAYS_SHORT_UZ;
  const now = new Date();

  const [view, setView] = useState<"week" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthDate, setMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<number | "">("");
  const [roll, setRoll] = useState<DerivedLesson | null>(null);

  // O'qituvchining guruhlari — guruh bo'yicha filtr uchun.
  const groupsQ = useTeachGroups();
  const groups = groupsQ.data ?? [];

  const monday = useMemo(() => mondayOf(now, weekOffset), [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; }), [monday]);
  const todayKey = dayKey(now);

  // Oy diapazoni: to'r 6 hafta bo'lgani uchun qo'shni oy kunlarini ham qamraymiz.
  const monthRange = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return { from: dayKey(start), to: dayKey(end) };
  }, [monthDate]);

  const range = view === "week" ? { from: dayKey(weekDays[0]), to: dayKey(weekDays[6]) } : monthRange;
  const q = useTeacherLessons({ from: range.from, to: range.to, search: search.trim() || undefined });
  // Guruh filtri — mijoz tomonda (DerivedLesson.groupId bo'yicha).
  const lessons = useMemo(() => {
    const all = q.data ?? [];
    return groupId === "" ? all : all.filter((l) => l.groupId === groupId);
  }, [q.data, groupId]);
  const filtered = search.trim() !== "" || groupId !== "";

  // Katak indeksi: "dayKey|startTime" → darslar.
  const cellMap = useMemo(() => {
    const m = new Map<string, DerivedLesson[]>();
    for (const l of lessons) {
      const key = `${l.dayKey}|${l.startTime}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push(l);
    }
    return m;
  }, [lessons]);

  // Oy ko'rinishi uchun: kun → darslar (pill).
  const byDay = useMemo(() => {
    const m = new Map<string, DerivedLesson[]>();
    for (const l of lessons) (m.get(l.dayKey) ?? m.set(l.dayKey, []).get(l.dayKey)!).push(l);
    return m;
  }, [lessons]);
  const entriesByDay = useMemo(() => {
    const m = new Map<string, CalEntry[]>();
    for (const [k, list] of byDay) {
      m.set(
        k,
        [...list].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((l) => ({
          key: l.slotId + l.dayKey,
          time: l.startTime,
          title: l.courseName,
          tone: calTone(l.status),
          onClick: () => setRoll(l),
        }))
      );
    }
    return m;
  }, [byDay]);
  const selectedLessons = selectedDay
    ? [...(byDay.get(selectedDay) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime))
    : [];
  const monthLabel = ru
    ? monthDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    : `${MONTHS_UZ[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  const shiftMonth = (dir: -1 | 1) => {
    setSelectedDay(null);
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  // Faqat haqiqatda dars bor vaqt qatorlari (bo'sh soatlar chizilmaydi).
  const times = useMemo(() => Array.from(new Set(lessons.map((l) => l.startTime))).sort(), [lessons]);

  // Hafta xulosasi.
  const stats = useMemo(() => {
    const total = lessons.length;
    const marked = lessons.filter((l) => l.status === "FULL").length;
    const pending = lessons.filter((l) => l.status !== "FULL").length;
    const todayN = lessons.filter((l) => l.dayKey === todayKey).length;
    return { total, marked, pending, todayN };
  }, [lessons, todayKey]);

  const weekLabel = `${formatDate(locale === "ru" ? "ru" : "uz", weekDays[0], "short")} – ${formatDate(locale === "ru" ? "ru" : "uz", weekDays[6], "short")}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
          <p className="mt-1 text-note text-ink-soft">{t("subtitleAuto")}</p>
        </div>
        <div className="inline-flex gap-1 rounded-control border border-line bg-surface p-1">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cls(
                "rounded-[8px] px-4 py-1.5 text-note font-semibold transition-all",
                view === v ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink"
              )}
            >
              {t(v === "week" ? "viewWeek" : "viewMonth")}
            </button>
          ))}
        </div>
      </div>

      {/* Hafta xulosasi */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatCard compact icon={CalendarDays} tone="bg-brand-soft text-brand-deep" value={stats.total} label={t("statTotal")} />
        <StatCard compact icon={CalendarCheck} tone="bg-emerald-soft text-emerald" value={stats.marked} label={t("statMarked")} />
        <StatCard compact icon={ClipboardCheck} tone={stats.pending > 0 ? "bg-amber-soft text-amber" : "bg-bg text-ink-faint"} value={stats.pending} label={t("statPending")} />
        <StatCard compact icon={Clock} tone="bg-blue-soft text-blue" value={stats.todayN} label={t("statToday")} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-note outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/10" />
        </div>
        {/* Guruh bo'yicha filtr */}
        <Select
          value={groupId === "" ? "" : String(groupId)}
          onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
          className="w-auto min-w-[150px]"
        >
          <option value="">{t("allGroups")}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
        {view === "week" ? (
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
            <span className="min-w-[150px] text-center text-note font-semibold text-ink">{weekLabel}</span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
            {weekOffset !== 0 && <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>{t("today")}</Button>}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
            <span className="min-w-[150px] text-center text-note font-semibold capitalize text-ink">{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
            <Button size="sm" variant="ghost" onClick={() => { setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(null); }}>{t("today")}</Button>
          </div>
        )}
      </div>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={24} /></div>
      ) : view === "month" ? (
        /* Oylik kalendar */
        <>
          <Card className="!p-0 overflow-hidden">
            <MonthCalendar
              monthDate={monthDate}
              weekdayNames={ru ? CAL_WD_RU : CAL_WD_UZ}
              entriesByDay={entriesByDay}
              selectedKey={selectedDay}
              onSelectDay={(k) => setSelectedDay((cur) => (cur === k ? null : k))}
            />
          </Card>
          {selectedDay && (
            <Card className="!p-0 overflow-hidden">
              <div className="flex items-center gap-2 bg-bg px-4 py-2.5">
                <Icon icon={CalendarDays} size={15} className="text-ink-soft" />
                <span className="text-note font-bold text-ink">{formatDate(ru ? "ru" : "uz", new Date(selectedDay), "long")}</span>
                <span className="ml-auto text-micro text-ink-faint">{t("nLessons", { n: selectedLessons.length })}</span>
              </div>
              {selectedLessons.length === 0 ? (
                <p className="px-4 py-6 text-center text-note text-ink-faint">{t("noneThisDay")}</p>
              ) : (
                <div className="divide-y divide-line">
                  {selectedLessons.map((l) => (
                    <div key={l.slotId + l.dayKey} className={cls("flex flex-wrap items-center gap-3 border-l-4 bg-surface px-4 py-2.5", statusBorder(l.status))}>
                      <span className="w-12 shrink-0 text-note font-bold tabular-nums text-ink">{l.startTime}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-note font-bold text-ink">{l.courseName}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-micro text-ink-soft">
                          {l.groupName && <span className="inline-flex items-center gap-1"><Icon icon={Users2} size={11} /> {l.groupName}</span>}
                          {l.room && <span className="inline-flex items-center gap-1"><Icon icon={DoorClosed} size={11} /> {l.room}</span>}
                        </p>
                      </div>
                      <span className={cls("shrink-0 text-micro font-semibold tabular-nums", statusCount(l.status))}>{l.markedCount}/{l.rosterSize}</span>
                      <Button size="sm" variant={l.status === "FULL" ? "ghost" : "primary"} icon={<Icon icon={ClipboardCheck} size={15} />} onClick={() => setRoll(l)}>
                        {l.status === "UNMARKED" ? t("mark") : t("edit")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      ) : lessons.length === 0 ? (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty emptyIcon={<Icon icon={CalendarDays} size={22} />} emptyText={filtered ? t("noMatch") : t("noneThisWeek")} emptyHint={filtered ? undefined : t("noneHint")} onRetry={() => q.refetch()}>
          <div />
        </AsyncSection>
      ) : (
        <>
        {/* ——— MOBIL: kun-agenda. To'r 860px talab qiladi — telefonda u faqat
            gorizontal skroll bo'lardi va yo'qlamani bosish noqulay edi.
            Yo'qlama — o'qituvchining ASOSIY mobil ssenariysi. ——— */}
        <div className="space-y-2 lg:hidden">
          {weekDays.map((d, di) => {
            const dk = dayKey(d);
            const dayLessons = times.flatMap((time) => (cellMap.get(`${dk}|${time}`) ?? []).map((l) => ({ time, l })));
            if (dayLessons.length === 0) return null;
            const isToday = dk === todayKey;
            return (
              <Card key={dk} className="!p-0 overflow-hidden">
                <div className={cls("flex items-center gap-2 border-b border-line px-3 py-2", isToday ? "bg-brand-soft" : "bg-bg")}>
                  <span className={cls("text-note font-bold uppercase tracking-wider", isToday ? "text-brand-deep" : "text-ink-soft")}>
                    {dayShort[di]}
                  </span>
                  <span className={cls("text-body font-extrabold tabular-nums", isToday ? "text-brand-deep" : "text-ink")}>
                    {d.getDate()}
                  </span>
                  {isToday && <span className="rounded-pill bg-brand px-2 py-0.5 text-micro font-bold text-white">{t("today")}</span>}
                </div>
                <div className="space-y-2 p-2">
                  {dayLessons.map(({ time, l }) => (
                    <div key={l.slotId + l.dayKey} className="flex items-start gap-2">
                      <span className="w-12 shrink-0 pt-1 text-note font-bold tabular-nums text-ink-soft">{time}</span>
                      <div className="min-w-0 flex-1">
                        <LessonCell l={l} onMark={() => setRoll(l)} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        {/* ——— DESKTOP: haftalik to'r (vaqt qatorlari × 7 kun ustuni) ——— */}
        <Card className="!p-0 overflow-x-auto hidden lg:block">
          <div className="min-w-[860px]">
            {/* Sarlavha qatori — kunlar */}
            <div className="grid gap-px border-b border-line bg-line" style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}>
              <div className="bg-bg" />
              {weekDays.map((d, i) => {
                const isToday = dayKey(d) === todayKey;
                return (
                  <div key={i} className={cls("flex flex-col items-center py-2", isToday ? "bg-brand-soft" : "bg-bg")}>
                    <span className={cls("text-micro font-bold", isToday ? "text-brand-deep" : "text-ink")}>{dayShort[i]}</span>
                    <span className="text-micro text-ink-faint">{d.getDate()}</span>
                    {isToday && <span className="mt-0.5 rounded-pill bg-brand px-1.5 text-micro font-bold text-white">{t("today")}</span>}
                  </div>
                );
              })}
            </div>
            {/* Vaqt qatorlari */}
            <div className="grid gap-px bg-line">
              {times.map((time) => (
                <div key={time} className="grid gap-px" style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}>
                  <div className="flex items-start justify-center bg-surface pt-2 text-micro font-bold tabular-nums text-ink-soft">{time}</div>
                  {weekDays.map((d, i) => {
                    const list = cellMap.get(`${dayKey(d)}|${time}`) ?? [];
                    const isToday = dayKey(d) === todayKey;
                    return (
                      <div key={i} className={cls("min-h-[68px] space-y-1 p-1.5", isToday ? "bg-brand-soft/30" : "bg-surface")}>
                        {list.map((l) => <LessonCell key={l.slotId + l.dayKey} l={l} onMark={() => setRoll(l)} />)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
        </>
      )}

      {/* Legenda */}
      {lessons.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-micro text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-brand" /> {t("legendUnmarked")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-amber" /> {t("legendPartial")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-emerald" /> {t("legendFull")}</span>
          <span className="ml-auto inline-flex items-center gap-1">{t("legendHint")}</span>
        </div>
      )}

      {roll && (
        <RollCallModal
          courseId={roll.courseId}
          date={roll.dayKey}
          startTime={roll.startTime}
          groupId={roll.groupId ?? undefined}
          heading={`${roll.courseName} · ${formatDate(locale === "ru" ? "ru" : "uz", new Date(roll.date), "short")} · ${roll.startTime}`}
          onClose={() => setRoll(null)}
        />
      )}
    </div>
  );
}
