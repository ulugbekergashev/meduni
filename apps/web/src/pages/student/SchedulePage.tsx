import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, DoorOpen } from "lucide-react";
import { Button, Icon, cls } from "@meduni/ui";
import { BentoCard, HeaderChip } from "../../components/bento";
import { PillTabs } from "./parts/bento";
import { MonthCalendar, type CalEntry } from "../../components/MonthCalendar";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { ATT_META } from "../../lib/attendance";
import { useMySchedule, type ScheduleItem } from "./api";

const WD_SHORT_MON_UZ = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];
const WD_SHORT_MON_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_UZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

function schedTone(s: ScheduleItem): CalEntry["tone"] {
  if (s.myStatus === "PRESENT") return "emerald";
  if (s.myStatus === "LATE") return "amber";
  if (s.myStatus === "ABSENT") return "rose";
  if (s.myStatus === "EXCUSED") return "blue";
  return s.isPast ? "line" : "brand";
}

const WEEKDAYS_UZ = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Katak ohangi: o'tgan dars — yo'qlama holati, kelgusi — brand.
 *  Fon hamma katakda bir xil ko'tarilgan (surface-raised) — holat faqat chap
 *  chekka rangi + kichik belgi bilan aytiladi (rang shovqini kam). */
const STATUS_CELL = ATT_META;

function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Mon = 0
  return x;
}
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Jadval katagi — bitta dars. Fon: ko'tarilgan chip (qora "teshik" emas);
 *  kelgusi dars — brand-soft, o'tganlari — surface-raised + holat chekkasi. */
function LessonCell({ s }: { s: ScheduleItem }) {
  const meta = s.myStatus ? STATUS_CELL[s.myStatus] : null;
  return (
    <div
      className={cls(
        "h-full rounded-control border border-line border-l-4 p-2.5 text-left",
        meta
          ? cls("bg-surface-raised", meta.border)
          : s.isPast
            ? "border-l-line-raised bg-surface-raised opacity-70"
            : "border-l-brand bg-brand-soft"
      )}
    >
      <p className="line-clamp-2 text-note font-semibold leading-snug text-ink">{s.title ?? s.courseName}</p>
      <p className="mt-0.5 truncate text-micro text-ink-soft">{s.courseName}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {s.room && (
          <span className="inline-flex items-center gap-1 text-micro font-semibold text-ink-soft">
            <Icon icon={DoorOpen} size={12} /> {s.room}
          </span>
        )}
        {meta && (
          <span className={cls("inline-flex items-center", meta.text)}>
            <Icon icon={meta.icon} size={13} strokeWidth={3} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Dars jadvali — haqiqiy to'r: vaqt qatorlari × kun ustunlari. */
export function SchedulePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "schedule" });
  const { t: ta } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const locale = useLocale();
  const ru = locale === "ru";
  const [view, setView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [monthDate, setMonthDate] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekEnd = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(e.getDate() + 6);
    return e;
  }, [weekStart]);

  // Oy diapazoni — to'r 6 hafta bo'lgani uchun qo'shni oy kunlarini ham qamraydi.
  const monthRange = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return { from: dayKey(start), to: dayKey(end) };
  }, [monthDate]);

  const range = view === "week" ? { from: dayKey(weekStart), to: dayKey(weekEnd) } : monthRange;
  const q = useMySchedule(range);
  const sessions = q.data ?? [];

  const entriesByDay = useMemo(() => {
    const m = new Map<string, CalEntry[]>();
    for (const s of sessions) {
      const k = dayKey(new Date(s.date));
      const entry: CalEntry = { key: s.key, time: hhmm(new Date(s.date)), title: s.title ?? s.courseName, tone: schedTone(s) };
      (m.get(k) ?? m.set(k, []).get(k)!).push(entry);
    }
    for (const list of m.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return m;
  }, [sessions]);

  const monthLabel = ru
    ? monthDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    : `${MONTHS_UZ[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  const shiftMonth = (dir: -1 | 1) => {
    setSelectedDay(null);
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };
  const selectedSessions = selectedDay
    ? sessions.filter((s) => dayKey(new Date(s.date)) === selectedDay).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const days = useMemo(() => {
    const names = locale === "ru" ? WEEKDAYS_RU : WEEKDAYS_UZ;
    const todayKey = dayKey(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return { key: dayKey(d), short: names[i], num: d.getDate(), date: d, isToday: dayKey(d) === todayKey };
    });
  }, [weekStart, locale]);

  // Vaqt qatorlari — faqat haqiqatda dars bor soatlar (bo'sh qatorlar chizilmaydi).
  const slots = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) set.add(hhmm(new Date(s.date)));
    return [...set].sort();
  }, [sessions]);

  const at = (slot: string, day: string) =>
    sessions.filter((s) => hhmm(new Date(s.date)) === slot && dayKey(new Date(s.date)) === day);

  const shift = (dir: -1 | 1) =>
    setWeekStart((w) => {
      const n = new Date(w);
      n.setDate(n.getDate() + dir * 7);
      return n;
    });

  const fmt = (d: Date) => formatDate(locale === "ru" ? "ru" : "uz", d, "short");

  // Hafta xulosasi — hero ko'rsatkichlari
  // Oy koʻrinishida toʻr qoʻshni oy kunlarini ham yuklaydi — xulosa faqat SHU oy darslaridan
  // (ilgari oy rejimida ham "Bu hafta 52 dars" yozilardi).
  const statSessions =
    view === "month"
      ? sessions.filter((s) => {
          const d = new Date(s.date);
          return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
        })
      : sessions;
  const attended = statSessions.filter((s) => s.myStatus === "PRESENT" || s.myStatus === "LATE").length;
  const missedCount = statSessions.filter((s) => s.myStatus === "ABSENT").length;
  const upcoming = sessions.filter((s) => !s.isPast);
  const nextLesson = upcoming[0];

  const goToday = () => {
    if (view === "week") setWeekStart(mondayOf(new Date()));
    else {
      setMonthDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      setSelectedDay(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Boshqaruv qatori — sarlavha ota sahifada (PageHeader), bu yerda faqat
          ko'rinish/davr tanlash. STAT DIETASI: haftalik sonlar — matn. */}
      <div className="flex flex-wrap items-center gap-2">
        <PillTabs<"week" | "month">
          value={view}
          onChange={setView}
          items={[
            { key: "week", label: t("viewWeek") },
            { key: "month", label: t("viewMonth") },
          ]}
        />
        <div className="flex items-center rounded-pill border border-line bg-surface p-0.5">
          <button
            type="button"
            onClick={() => (view === "week" ? shift(-1) : shiftMonth(-1))}
            aria-label={t("prevWeek")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={ChevronLeft} size={16} />
          </button>
          <span className="min-w-36 px-1 text-center text-note font-semibold capitalize tabular-nums text-ink">
            {view === "week" ? `${fmt(weekStart)} — ${fmt(weekEnd)}` : monthLabel}
          </span>
          <button
            type="button"
            onClick={() => (view === "week" ? shift(1) : shiftMonth(1))}
            aria-label={t("nextWeek")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={ChevronRight} size={16} />
          </button>
        </div>
        <Button variant="ghost" size="sm" className="h-9 rounded-pill" onClick={goToday}>
          {t("today")}
        </Button>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-note text-ink-soft">
            {t(view === "month" ? "summaryLineMonth" : "summaryLine", { total: statSessions.length, attended, missed: missedCount })}
          </span>
          <HeaderChip tone={nextLesson ? "brand" : "plain"} icon={<Icon icon={Clock} size={14} />}>
            {nextLesson ? `${hhmm(new Date(nextLesson.date))} · ${nextLesson.courseName}` : t("statNextNone")}
          </HeaderChip>
        </span>
      </div>

      {q.isLoading || q.isError ? (
        <BentoCard isLoading={q.isLoading} isError={q.isError} onRetry={() => q.refetch()} />
      ) : view === "month" ? (
        <div className="space-y-3">
          <BentoCard bodyClassName="p-0 overflow-hidden rounded-card">
            <MonthCalendar
              monthDate={monthDate}
              weekdayNames={ru ? WD_SHORT_MON_RU : WD_SHORT_MON_UZ}
              entriesByDay={entriesByDay}
              selectedKey={selectedDay}
              onSelectDay={(k) => setSelectedDay((cur) => (cur === k ? null : k))}
            />
          </BentoCard>
          {selectedDay && (
            <BentoCard
              title={
                <span className="flex items-center gap-2">
                  <Icon icon={CalendarDays} size={15} className="text-ink-soft" />
                  {formatDate(ru ? "ru" : "uz", new Date(selectedDay), "long")}
                </span>
              }
              count={selectedSessions.length}
              bodyClassName="px-2 pb-2"
            >
              {selectedSessions.length === 0 ? (
                <p className="px-2 py-4 text-center text-note text-ink-soft">{t("emptyWeek")}</p>
              ) : (
                <div className="divide-y divide-line-soft">
                  {selectedSessions.map((s) => {
                    const meta = s.myStatus ? STATUS_CELL[s.myStatus] : null;
                    return (
                      <div key={s.key} className="flex items-center gap-3 px-2 py-2.5">
                        <span className="w-12 shrink-0 font-data text-note font-semibold tabular-nums text-ink">{hhmm(new Date(s.date))}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-semibold text-ink">{s.title ?? s.courseName}</p>
                          <p className="truncate text-note text-ink-soft">{s.courseName}{s.room ? ` · ${s.room}` : ""}</p>
                        </div>
                        {meta && <Icon icon={meta.icon} size={16} className={meta.text} strokeWidth={2.5} />}
                        {!meta && !s.isPast && <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-micro font-semibold text-brand-deep">{t("upcomingBadge")}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </BentoCard>
          )}
        </div>
      ) : slots.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface py-12 text-center text-body text-ink-soft">
          <Icon icon={CalendarDays} size={22} className="mx-auto mb-2 text-ink-faint" />
          {t("emptyWeek")}
        </div>
      ) : (
        <div>
          {/* ——— MOBIL: kun-agenda. Vaqt×kun to'ri 820px joy talab qiladi,
              telefonda u faqat gorizontal skroll bo'lib qolardi. Shu sababli
              lg dan kichik ekranda darslar kunlar bo'yicha ro'yxat bo'ladi. ——— */}
          <div className="space-y-2 lg:hidden">
            {days.map((d) => {
              const dayRows = slots.flatMap((slot) => at(slot, d.key).map((s) => ({ slot, s })));
              if (dayRows.length === 0) return null;
              return (
                <section key={d.key} className="rounded-card border border-line bg-surface">
                  <div className="flex items-center gap-2 px-3 pt-3">
                    <span
                      className={cls(
                        "flex h-8 min-w-8 items-center justify-center rounded-full px-2 font-data text-note font-semibold tabular-nums",
                        d.isToday ? "bg-ink text-surface" : "bg-surface-raised text-ink"
                      )}
                    >
                      {d.num}
                    </span>
                    <span className="text-note font-semibold text-ink-soft">{d.short}</span>
                  </div>
                  <div className="space-y-2 p-2">
                    {dayRows.map(({ slot, s }) => (
                      <div key={s.key} className="flex items-start gap-2">
                        <span className="w-12 shrink-0 pt-1 font-data text-note font-semibold tabular-nums text-ink-soft">{slot}</span>
                        <div className="min-w-0 flex-1">
                          <LessonCell s={s} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* ——— DESKTOP: to'liq vaqt×kun to'ri ——— */}
          <div className="hidden overflow-x-auto rounded-card border border-line bg-surface lg:block">
            {/* Jadval to'ri: vaqt ustuni + 7 kun */}
            <div className="min-w-[820px]">
              {/* Sarlavha qatori */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-line bg-surface">
                <div />
                {days.map((d) => (
                  <div
                    key={d.key}
                    className={cls(
                      "border-l border-line px-2 py-2.5 text-center",
                      d.isToday && "bg-brand-soft"
                    )}
                  >
                    <p className="text-micro font-semibold text-ink-soft">{d.short}</p>
                    <p
                      className={cls(
                        "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full font-data text-note font-semibold tabular-nums",
                        d.isToday ? "bg-ink text-surface" : "text-ink"
                      )}
                    >
                      {d.num}
                    </p>
                  </div>
                ))}
              </div>

              {/* Vaqt qatorlari */}
              {slots.map((slot) => (
                <div key={slot} className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-line last:border-0">
                  <div className="flex items-start justify-center px-1 py-3">
                    <span className="font-data text-note font-semibold tabular-nums text-ink-soft">{slot}</span>
                  </div>
                  {days.map((d) => {
                    const rows = at(slot, d.key);
                    return (
                      <div
                        key={d.key}
                        className={cls("min-h-[76px] border-l border-line p-1.5", d.isToday && "bg-brand-soft")}
                      >
                        <div className="flex h-full flex-col justify-start space-y-1.5">
                          {rows.map((s) => (
                            <LessonCell key={s.key} s={s} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Izoh (legenda) — katak chekka ranglari bilan aynan mos */}
      {slots.length > 0 && view === "week" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-micro font-semibold text-ink-soft">
          {([
            ["bg-brand", t("upcomingBadge")],
            ["bg-emerald", ta("status.PRESENT")],
            ["bg-amber", ta("status.LATE")],
            ["bg-rose", ta("status.ABSENT")],
            ["bg-line-raised", t("unmarked")],
          ] as const).map(([dot, label]) => (
            <span key={dot} className="inline-flex items-center gap-1.5">
              <span className={cls("h-2.5 w-2.5 rounded-full", dot)} /> {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
