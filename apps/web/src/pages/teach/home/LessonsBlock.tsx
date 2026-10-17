import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, DoorClosed, Search, Users2, X } from "lucide-react";
import { Button, EmptyState, Icon, Segmented, Select, Spinner, cls } from "@meduni/ui";
import { BentoCard, RetryLine } from "../../../components/bento";
import { MonthCalendar, type CalEntry } from "../../../components/MonthCalendar";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import { RollCallModal } from "../course/attendance/RollCallModal";
import { useTeacherLessons, useTeachGroups, type DerivedLesson } from "../api";

// "Darslarim" ALOHIDA SAHIFA emas — bosh sahifadagi blok (2026-08-03).
// Dizayn v3 (2026-10): BUGUNGI darslar endi o'ng ustundagi `TodayLessonsCard`da;
// bu blok faqat HAFTA / OY jadvali — "Jadval" bosilganda (yoki eski
// `/teach/schedule` deep-linkidan) ochiladi, sahifa almashmaydi.

const WEEKDAYS_SHORT_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const WEEKDAYS_SHORT_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const CAL_WD_UZ = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];
const CAL_WD_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_UZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

export type LessonMode = "week" | "month";

export function dayKey(d: Date): string {
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
  return s === "FULL" ? "text-emerald" : s === "PARTIAL" ? "text-amber" : "text-ink-soft";
}
function calTone(s: DerivedLesson["status"]): CalEntry["tone"] {
  return s === "FULL" ? "emerald" : s === "PARTIAL" ? "amber" : "brand";
}

const navBtn =
  "rounded-pill p-2 text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/** Bitta katakdagi dars kartasi — bosilsa yo'qlama ochiladi. */
function LessonCell({ l, onMark }: { l: DerivedLesson; onMark: () => void }) {
  return (
    <button
      type="button"
      onClick={onMark}
      className={cls(
        "group flex w-full flex-col gap-0.5 rounded-control border border-l-4 border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        statusBorder(l.status)
      )}
    >
      <p className="truncate text-micro font-semibold text-ink">{l.courseName}</p>
      <div className="flex flex-wrap items-center gap-x-2 text-micro text-ink-soft">
        {l.groupName && <span className="inline-flex items-center gap-1"><Icon icon={Users2} size={11} /> {l.groupName}</span>}
        {l.room && <span className="inline-flex items-center gap-1"><Icon icon={DoorClosed} size={11} /> {l.room}</span>}
      </div>
      <div className="mt-0.5 flex items-center justify-between">
        <span className={cls("font-data text-micro font-semibold tabular-nums", statusCount(l.status))}>{l.markedCount}/{l.rosterSize}</span>
        <Icon icon={ClipboardCheck} size={13} className="text-ink-faint opacity-0 transition-opacity group-hover:text-brand-tint group-hover:opacity-100" />
      </div>
    </button>
  );
}

export function LessonsBlock({
  mode,
  onMode,
  onClose,
}: {
  mode: LessonMode;
  onMode: (m: LessonMode) => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "teachSchedule" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const ru = locale === "ru";
  const dayShort = ru ? WEEKDAYS_SHORT_RU : WEEKDAYS_SHORT_UZ;
  const now = new Date();
  const todayKey = dayKey(now);

  const [weekOffset, setWeekOffset] = useState(0);
  const [monthDate, setMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<number | "">("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [roll, setRoll] = useState<DerivedLesson | null>(null);

  const groupsQ = useTeachGroups();
  const groups = groupsQ.data ?? [];

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

  const range = mode === "week" ? { from: dayKey(weekDays[0]), to: dayKey(weekDays[6]) } : monthRange;
  const q = useTeacherLessons({ from: range.from, to: range.to, search: search.trim() || undefined });

  const lessonsAll = useMemo(() => {
    const all = q.data ?? [];
    return groupId === "" ? all : all.filter((l) => l.groupId === groupId);
  }, [q.data, groupId]);
  const lessons = useMemo(() => (onlyPending ? lessonsAll.filter((l) => l.status !== "FULL") : lessonsAll), [lessonsAll, onlyPending]);
  const filtered = search.trim() !== "" || groupId !== "" || onlyPending;

  const cellMap = useMemo(() => {
    const m = new Map<string, DerivedLesson[]>();
    for (const l of lessons) {
      const key = `${l.dayKey}|${l.startTime}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push(l);
    }
    return m;
  }, [lessons]);

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

  const selectedLessons = selectedDay ? [...(byDay.get(selectedDay) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];
  const times = useMemo(() => Array.from(new Set(lessons.map((l) => l.startTime))).sort(), [lessons]);

  const pending = lessonsAll.filter((l) => l.status !== "FULL").length;
  const monthLabel = ru
    ? monthDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    : `${MONTHS_UZ[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  const weekLabel = `${formatDate(ru ? "ru" : "uz", weekDays[0], "short")} – ${formatDate(ru ? "ru" : "uz", weekDays[6], "short")}`;
  const isCurrentMonth = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
  const shiftMonth = (dir: -1 | 1) => {
    setSelectedDay(null);
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  return (
    <BentoCard
      title={t("title")}
      count={lessonsAll.length}
      right={
        <span className="flex items-center gap-1.5">
          <Segmented
            size="sm"
            value={mode}
            onChange={onMode}
            aria-label={t("title")}
            options={[
              { key: "week", label: t("viewWeek") },
              { key: "month", label: t("viewMonth") },
            ]}
          />
          {onClose && (
            <button type="button" onClick={onClose} className={navBtn} aria-label={tc("collapse")}>
              <Icon icon={X} size={16} />
            </button>
          )}
        </span>
      }
    >
      {/* Boshqaruv: qidiruv, guruh, "yo'qlama kutmoqda" filtri, davr navigatsiyasi */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-9 w-full rounded-control border border-line-raised bg-surface-raised pl-9 pr-3 text-note text-ink outline-none transition-colors focus:border-brand focus:bg-surface"
          />
        </div>
        <Select value={groupId === "" ? "" : String(groupId)} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")} className="w-auto min-w-[140px]">
          <option value="">{t("allGroups")}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
        {pending > 0 && (
          <button
            type="button"
            aria-pressed={onlyPending}
            onClick={() => setOnlyPending((v) => !v)}
            className={cls(
              "inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-note font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              onlyPending ? "bg-ink text-surface" : "bg-amber-soft text-amber hover:brightness-95"
            )}
          >
            <Icon icon={ClipboardCheck} size={13} />
            {t("statPending")}: <span className="font-data tabular-nums">{pending}</span>
          </button>
        )}
        {mode === "week" ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setWeekOffset((w) => w - 1)} className={navBtn} aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
            <span className="min-w-[140px] text-center text-note font-semibold text-ink">{weekLabel}</span>
            <button type="button" onClick={() => setWeekOffset((w) => w + 1)} className={navBtn} aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
            {weekOffset !== 0 && <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>{t("today")}</Button>}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} className={navBtn} aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
            <span className="min-w-[140px] text-center text-note font-semibold capitalize text-ink">{monthLabel}</span>
            <button type="button" onClick={() => shiftMonth(1)} className={navBtn} aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
            {/* ⚠️ "Bugun" faqat joriy oydan chiqib ketganda — hafta ko'rinishidagi
                `weekOffset !== 0` qoidasi bilan bir xil (joriy oyda u hech narsa qilmasdi). */}
            {!isCurrentMonth && (
              <Button size="sm" variant="ghost" onClick={() => { setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(null); }}>{t("today")}</Button>
            )}
          </div>
        )}
      </div>

      {q.isLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner size={20} /></div>
      ) : q.isError ? (
        <RetryLine onRetry={() => q.refetch()} />
      ) : mode === "month" ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-control border border-line">
            <MonthCalendar
              monthDate={monthDate}
              weekdayNames={ru ? CAL_WD_RU : CAL_WD_UZ}
              entriesByDay={entriesByDay}
              selectedKey={selectedDay}
              onSelectDay={(k) => setSelectedDay((cur) => (cur === k ? null : k))}
            />
          </div>
          {selectedDay && (
            <div className="overflow-hidden rounded-control border border-line">
              <div className="flex items-center gap-2 bg-surface-raised px-4 py-2.5">
                <Icon icon={CalendarDays} size={15} className="text-ink-soft" />
                <span className="text-note font-semibold text-ink">{formatDate(ru ? "ru" : "uz", new Date(selectedDay), "long")}</span>
                <span className="ml-auto text-micro text-ink-soft">{t("nLessons", { n: selectedLessons.length })}</span>
              </div>
              {selectedLessons.length === 0 ? (
                <p className="px-4 py-6 text-center text-note text-ink-soft">{t("noneThisDay")}</p>
              ) : (
                <div className="divide-y divide-line">
                  {selectedLessons.map((l) => (
                    <div key={l.slotId + l.dayKey} className={cls("flex flex-wrap items-center gap-3 border-l-4 bg-surface px-4 py-2.5", statusBorder(l.status))}>
                      <span className="w-12 shrink-0 font-data text-note font-semibold tabular-nums text-ink">{l.startTime}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-note font-semibold text-ink">{l.courseName}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-micro text-ink-soft">
                          {l.groupName && <span className="inline-flex items-center gap-1"><Icon icon={Users2} size={11} /> {l.groupName}</span>}
                          {l.room && <span className="inline-flex items-center gap-1"><Icon icon={DoorClosed} size={11} /> {l.room}</span>}
                        </p>
                      </div>
                      <span className={cls("shrink-0 font-data text-micro font-semibold tabular-nums", statusCount(l.status))}>{l.markedCount}/{l.rosterSize}</span>
                      <Button size="sm" variant={l.status === "FULL" ? "ghost" : "primary"} icon={<Icon icon={ClipboardCheck} size={15} />} onClick={() => setRoll(l)}>
                        {l.status === "UNMARKED" ? t("mark") : t("edit")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : lessons.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <EmptyState
            icon={<Icon icon={CalendarDays} size={20} />}
            text={filtered ? t("noMatch") : t("noneThisWeek")}
            hint={filtered ? undefined : t("noneHint")}
          />
        </div>
      ) : (
        <>
          {/* MOBIL: kun-agenda (to'r 860px talab qiladi) */}
          <div className="space-y-2 lg:hidden">
            {weekDays.map((d, di) => {
              const dk = dayKey(d);
              const dayLessons = times.flatMap((time) => (cellMap.get(`${dk}|${time}`) ?? []).map((l) => ({ time, l })));
              if (dayLessons.length === 0) return null;
              const isToday = dk === todayKey;
              return (
                <div key={dk} className="overflow-hidden rounded-control border border-line">
                  <div className={cls("flex items-center gap-2 border-b border-line px-3 py-2", isToday ? "bg-brand-soft" : "bg-surface-raised")}>
                    <span className={cls("text-note font-semibold", isToday ? "text-brand-deep" : "text-ink-soft")}>{dayShort[di]}</span>
                    <span className={cls("font-data text-body font-semibold tabular-nums", isToday ? "text-brand-deep" : "text-ink")}>{d.getDate()}</span>
                    {isToday && <span className="rounded-pill bg-ink px-2 py-0.5 text-micro font-semibold text-surface">{t("today")}</span>}
                  </div>
                  <div className="space-y-2 p-2">
                    {dayLessons.map(({ time, l }) => (
                      <div key={l.slotId + l.dayKey} className="flex items-start gap-2">
                        <span className="w-12 shrink-0 pt-1 font-data text-note font-semibold tabular-nums text-ink-soft">{time}</span>
                        <div className="min-w-0 flex-1"><LessonCell l={l} onMark={() => setRoll(l)} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP: haftalik to'r */}
          <div className="hidden overflow-x-auto rounded-control border border-line lg:block">
            <div className="min-w-[860px]">
              <div className="grid gap-px border-b border-line bg-line" style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}>
                <div className="bg-surface-raised" />
                {weekDays.map((d, i) => {
                  const isToday = dayKey(d) === todayKey;
                  return (
                    <div key={i} className={cls("flex flex-col items-center py-2", isToday ? "bg-brand-soft" : "bg-surface-raised")}>
                      <span className={cls("text-micro font-semibold", isToday ? "text-brand-deep" : "text-ink")}>{dayShort[i]}</span>
                      <span className="text-micro text-ink-soft">{d.getDate()}</span>
                      {isToday && <span className="mt-0.5 rounded-pill bg-ink px-1.5 text-micro font-semibold text-surface">{t("today")}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-px bg-line">
                {times.map((time) => (
                  <div key={time} className="grid gap-px" style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}>
                    <div className="flex items-start justify-center bg-surface pt-2 font-data text-micro font-semibold tabular-nums text-ink-soft">{time}</div>
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
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-micro text-ink-soft">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-brand" /> {t("legendUnmarked")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-amber" /> {t("legendPartial")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-emerald" /> {t("legendFull")}</span>
          </div>
        </>
      )}

      {roll && (
        <RollCallModal
          courseId={roll.courseId}
          date={roll.dayKey}
          startTime={roll.startTime}
          groupId={roll.groupId ?? undefined}
          heading={`${roll.courseName} · ${formatDate(ru ? "ru" : "uz", new Date(roll.date), "short")} · ${roll.startTime}`}
          onClose={() => setRoll(null)}
        />
      )}
    </BentoCard>
  );
}
