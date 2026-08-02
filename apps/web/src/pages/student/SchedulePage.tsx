import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, DoorOpen, Minus, X } from "lucide-react";
import { Card, Icon, Spinner, cls } from "@meduni/ui";
import { HeroCard, HeroTile } from "../../components/HeroStats";
import { MonthCalendar, type CalEntry } from "../../components/MonthCalendar";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMySchedule, type AttStatus, type ScheduleItem } from "./api";

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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const WEEKDAYS_UZ = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Katak ohangi: o'tgan dars — yo'qlama holati, kelgusi — brand.
 *  Fon hamma katakda bir xil ko'tarilgan (surface-raised) — holat faqat chap
 *  chekka rangi + kichik belgi bilan aytiladi (rang shovqini kam). */
const STATUS_CELL: Record<AttStatus, { border: string; chip: string; icon: typeof Check }> = {
  PRESENT: { border: "border-l-emerald", chip: "text-emerald", icon: Check },
  ABSENT: { border: "border-l-rose", chip: "text-rose", icon: X },
  LATE: { border: "border-l-amber", chip: "text-amber", icon: Clock },
  EXCUSED: { border: "border-l-blue", chip: "text-blue", icon: Minus },
};

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
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cls(
        "h-full rounded-control border border-line border-l-[3px] p-2.5 text-left",
        meta
          ? cls("bg-surface-raised", meta.border)
          : s.isPast
            ? "border-l-line-raised bg-surface-raised opacity-70"
            : "border-l-brand bg-brand-soft"
      )}
    >
      <p className="line-clamp-2 text-body font-bold leading-snug text-ink">{s.title ?? s.courseName}</p>
      <p className="mt-0.5 truncate text-note font-medium text-ink-soft">{s.courseName}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {s.room && (
          <span className="inline-flex items-center gap-1 text-note font-semibold text-ink-faint">
            <Icon icon={DoorOpen} size={12} /> {s.room}
          </span>
        )}
        {meta && (
          <span className={cls("inline-flex items-center", meta.chip)}>
            <Icon icon={meta.icon} size={13} strokeWidth={3} />
          </span>
        )}
      </div>
    </motion.div>
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
  const attended = sessions.filter((s) => s.myStatus === "PRESENT" || s.myStatus === "LATE").length;
  const missedCount = sessions.filter((s) => s.myStatus === "ABSENT").length;
  const upcoming = sessions.filter((s) => !s.isPast);
  const nextLesson = upcoming[0];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={itemVariants}>
        <HeroCard
          title={t("title")}
          subtitle={t("summaryLine", { total: sessions.length, attended, missed: missedCount })}
          left={
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Hafta / Oy tanlagich */}
              <div className="flex items-center rounded-control border border-line bg-surface-raised p-1">
                {(["week", "month"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cls(
                      "rounded-[6px] px-3.5 py-1.5 text-body font-bold transition-colors",
                      view === v ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                    )}
                  >
                    {t(v === "week" ? "viewWeek" : "viewMonth")}
                  </button>
                ))}
              </div>
              <div className="flex items-center rounded-control border border-line bg-surface-raised p-1">
                <button
                  onClick={() => (view === "week" ? shift(-1) : shiftMonth(-1))}
                  aria-label={t("prevWeek")}
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                >
                  <Icon icon={ChevronLeft} size={16} />
                </button>
                <span className="min-w-[180px] text-center text-body font-bold capitalize tracking-wide text-ink">
                  {view === "week" ? `${fmt(weekStart)} — ${fmt(weekEnd)}` : monthLabel}
                </span>
                <button
                  onClick={() => (view === "week" ? shift(1) : shiftMonth(1))}
                  aria-label={t("nextWeek")}
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                >
                  <Icon icon={ChevronRight} size={16} />
                </button>
              </div>
              <button
                onClick={() => (view === "week" ? setWeekStart(mondayOf(new Date())) : (setMonthDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), setSelectedDay(null)))}
                className="rounded-control border border-line bg-surface-raised px-4 py-1.5 text-body font-bold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
              >
                {t("today")}
              </button>
            </div>
          }
        >
          {/* STAT DIETASI: haftalik sonlar sarlavha ostidagi qatorga ko'chdi —
              ular filtr ham, harakat ham emas edi. "Keyingi dars" qoladi. */}
          <HeroTile
            icon={Clock}
            value={
              nextLesson
                ? `${String(new Date(nextLesson.date).getHours()).padStart(2, "0")}:${String(new Date(nextLesson.date).getMinutes()).padStart(2, "0")}`
                : "—"
            }
            label={nextLesson ? nextLesson.courseName : t("statNextNone")}
            tone="bg-blue-soft text-blue"
          />
        </HeroCard>
      </motion.div>

      {q.isLoading ? (
        <div className="mt-4 flex justify-center">
          <Spinner size={26} />
        </div>
      ) : view === "month" ? (
        <motion.div variants={itemVariants} className="space-y-3">
          <Card className="p-0 shadow-sm border border-line bg-surface">
            <MonthCalendar
              monthDate={monthDate}
              weekdayNames={ru ? WD_SHORT_MON_RU : WD_SHORT_MON_UZ}
              entriesByDay={entriesByDay}
              selectedKey={selectedDay}
              onSelectDay={(k) => setSelectedDay((cur) => (cur === k ? null : k))}
            />
          </Card>
          {selectedDay && (
            <Card className="p-0 overflow-hidden border border-line bg-surface">
              <div className="flex items-center gap-2 bg-surface-raised px-4 py-2.5">
                <Icon icon={CalendarDays} size={15} className="text-ink-soft" />
                <span className="text-body font-bold text-ink">{formatDate(ru ? "ru" : "uz", new Date(selectedDay), "long")}</span>
                <span className="ml-auto text-note text-ink-faint">{t("statLessons")}: {selectedSessions.length}</span>
              </div>
              {selectedSessions.length === 0 ? (
                <p className="px-4 py-6 text-center text-body text-ink-faint">{t("emptyWeek")}</p>
              ) : (
                <div className="divide-y divide-line">
                  {selectedSessions.map((s) => {
                    const meta = s.myStatus ? STATUS_CELL[s.myStatus] : null;
                    return (
                      <div key={s.key} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-12 shrink-0 text-body font-bold tabular-nums text-ink">{hhmm(new Date(s.date))}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-bold text-ink">{s.title ?? s.courseName}</p>
                          <p className="truncate text-note text-ink-soft">{s.courseName}{s.room ? ` · ${s.room}` : ""}</p>
                        </div>
                        {meta && <Icon icon={meta.icon} size={16} className={meta.chip} strokeWidth={2.5} />}
                        {!meta && !s.isPast && <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-micro font-bold text-brand-tint">{t("upcomingBadge")}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </motion.div>
      ) : slots.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="mt-2 border-dashed bg-surface">
            <p className="py-12 text-center text-body font-medium text-ink-faint">{t("emptyWeek")}</p>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          {/* ——— MOBIL: kun-agenda. Vaqt×kun to'ri 820px joy talab qiladi,
              telefonda u faqat gorizontal skroll bo'lib qolardi. Shu sababli
              lg dan kichik ekranda darslar kunlar bo'yicha ro'yxat bo'ladi. ——— */}
          <div className="space-y-2 lg:hidden">
            {days.map((d) => {
              const dayRows = slots.flatMap((slot) => at(slot, d.key).map((s) => ({ slot, s })));
              if (dayRows.length === 0) return null;
              return (
                <Card key={d.key} className="p-0 shadow-sm">
                  <div
                    className={cls(
                      "flex items-center gap-2 rounded-t-card border-b border-line px-3 py-2",
                      d.isToday ? "bg-brand-soft" : "bg-surface-raised"
                    )}
                  >
                    <span className={cls("text-note font-bold uppercase tracking-wider", d.isToday ? "text-brand-tint" : "text-ink-soft")}>
                      {d.short}
                    </span>
                    <span className={cls("text-body font-extrabold tabular-nums", d.isToday ? "text-brand-tint" : "text-ink")}>
                      {d.num}
                    </span>
                  </div>
                  <div className="space-y-2 p-2">
                    {dayRows.map(({ slot, s }) => (
                      <div key={s.key} className="flex items-start gap-2">
                        <span className="w-12 shrink-0 pt-1 text-note font-bold tabular-nums text-ink-soft">{slot}</span>
                        <div className="min-w-0 flex-1">
                          <LessonCell s={s} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* ——— DESKTOP: to'liq vaqt×kun to'ri ——— */}
          <Card className="hidden overflow-x-auto p-0 shadow-sm border border-line bg-surface lg:block">
            {/* Jadval to'ri: vaqt ustuni + 7 kun */}
            <div className="min-w-[820px]">
              {/* Sarlavha qatori */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-line bg-surface">
                <div />
                {days.map((d) => (
                  <div
                    key={d.key}
                    className={cls(
                      "border-l border-line px-2 py-3 text-center transition-colors",
                      d.isToday && "bg-brand-soft"
                    )}
                  >
                    <p className={cls("text-note font-bold uppercase tracking-wider", d.isToday ? "text-brand-tint" : "text-ink-soft")}>
                      {d.short}
                    </p>
                    <p className={cls("mt-0.5 text-[17px] font-bold tabular-nums", d.isToday ? "text-brand-tint" : "text-ink")}>
                      {d.num}
                    </p>
                  </div>
                ))}
              </div>

              {/* Vaqt qatorlari */}
              <AnimatePresence>
              {slots.map((slot) => (
                <div key={slot} className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-line last:border-0">
                  <div className="flex items-start justify-center px-1 py-3">
                    <span className="text-note font-bold tabular-nums text-ink-soft">{slot}</span>
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
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Izoh (legenda) — katak uslubi bilan aynan mos */}
      {slots.length > 0 && (
        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-note font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-brand bg-brand-soft" /> {t("upcomingBadge")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-emerald bg-surface-raised" /> {ta("status.PRESENT")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-amber bg-surface-raised" /> {ta("status.LATE")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-rose bg-surface-raised" /> {ta("status.ABSENT")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-line-raised bg-surface-raised" /> {t("unmarked")}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
