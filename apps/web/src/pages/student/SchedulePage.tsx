import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, DoorOpen, Minus, X } from "lucide-react";
import { Card, Icon, Spinner, cls } from "@meduni/ui";
import { HeroCard, HeroTile } from "../../components/HeroStats";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMySchedule, type AttStatus, type ScheduleItem } from "./api";

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

/** Katak ohangi: o'tgan dars — yo'qlama holati, kelgusi — brand. */
const STATUS_CELL: Record<AttStatus, { border: string; chip: string; icon: typeof Check }> = {
  PRESENT: { border: "border-l-emerald bg-emerald-soft", chip: "bg-emerald-soft text-emerald-deep", icon: Check },
  ABSENT: { border: "border-l-rose bg-rose-soft", chip: "bg-rose-soft text-rose-deep", icon: X },
  LATE: { border: "border-l-amber bg-amber-soft", chip: "bg-amber-soft text-amber-deep", icon: Clock },
  EXCUSED: { border: "border-l-blue bg-blue-soft", chip: "bg-blue-soft text-blue-deep", icon: Minus },
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

/** Jadval katagi — bitta dars. */
function LessonCell({ s }: { s: ScheduleItem }) {
  const meta = s.myStatus ? STATUS_CELL[s.myStatus] : null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cls(
        "group h-full rounded-[10px] border-l-[4px] p-2.5 text-left transition-all hover:shadow-md",
        meta ? meta.border : s.isPast ? "border-l-line bg-bg" : "border-l-brand bg-brand-soft hover:bg-brand-soft"
      )}
    >
      <p className="line-clamp-2 text-[14px] font-bold leading-snug text-ink transition-colors group-hover:text-brand-deep">{s.title ?? s.courseName}</p>
      <p className="mt-0.5 truncate text-[12.5px] font-medium text-ink-soft">{s.courseName}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {s.room && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-faint">
            <Icon icon={DoorOpen} size={12} /> {s.room}
          </span>
        )}
        {meta && (
          <span className={cls("inline-flex items-center rounded-pill px-1.5 py-0.5 shadow-sm", meta.chip)}>
            <Icon icon={meta.icon} size={11} />
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
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  const weekEnd = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(e.getDate() + 6);
    return e;
  }, [weekStart]);

  const q = useMySchedule({ from: dayKey(weekStart), to: dayKey(weekEnd) });
  const sessions = q.data ?? [];

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
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants}>
        <HeroCard
          title={t("title")}
          subtitle={t("subtitle")}
          left={
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center rounded-control border border-line bg-surface p-1 shadow-sm">
                <button
                  onClick={() => shift(-1)}
                  aria-label={t("prevWeek")}
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-soft transition-colors hover:bg-bg"
                >
                  <Icon icon={ChevronLeft} size={16} />
                </button>
                <span className="min-w-[180px] text-center text-[14px] font-bold text-ink tracking-wide">
                  {fmt(weekStart)} — {fmt(weekEnd)}
                </span>
                <button
                  onClick={() => shift(1)}
                  aria-label={t("nextWeek")}
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-soft transition-colors hover:bg-bg"
                >
                  <Icon icon={ChevronRight} size={16} />
                </button>
              </div>
              <button
                onClick={() => setWeekStart(mondayOf(new Date()))}
                className="rounded-control border border-line bg-surface px-4 py-1.5 text-[14px] font-bold text-ink-soft shadow-sm transition-colors hover:bg-bg hover:text-ink"
              >
                {t("today")}
              </button>
            </div>
          }
        >
          <HeroTile
            icon={CalendarDays}
            value={String(sessions.length)}
            label={t("statLessons")}
            tone="bg-brand-soft text-brand-deep"
          />
          <HeroTile icon={Check} value={String(attended)} label={t("statAttended")} tone="bg-emerald-soft text-emerald" />
          <HeroTile
            icon={X}
            value={String(missedCount)}
            label={t("statMissed")}
            tone={missedCount > 0 ? "bg-rose-soft text-rose" : "bg-bg text-ink-faint"}
          />
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
        <div className="mt-10 flex justify-center">
          <Spinner size={26} />
        </div>
      ) : slots.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="mt-2 border-dashed bg-surface">
            <p className="py-12 text-center text-[15px] font-medium text-ink-faint">{t("emptyWeek")}</p>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          <Card className="overflow-x-auto p-0 shadow-sm border border-line bg-surface">
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
                      d.isToday ? "bg-brand-soft shadow-inner" : ""
                    )}
                  >
                    <p className={cls("text-[13px] font-bold uppercase tracking-wider", d.isToday ? "text-brand" : "text-ink-soft")}>
                      {d.short}
                    </p>
                    <p className={cls("text-[17px] font-bold tabular-nums mt-0.5", d.isToday ? "text-brand-deep" : "text-ink")}>
                      {d.num}
                    </p>
                  </div>
                ))}
              </div>

              {/* Vaqt qatorlari */}
              <AnimatePresence>
              {slots.map((slot) => (
                <div key={slot} className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-line last:border-0 group transition-colors hover:bg-bg">
                  <div className="flex items-start justify-center px-1 py-3">
                    <span className="text-[13.5px] font-bold tabular-nums text-ink-soft group-hover:text-brand-deep transition-colors">{slot}</span>
                  </div>
                  {days.map((d) => {
                    const rows = at(slot, d.key);
                    return (
                      <div
                        key={d.key}
                        className={cls("min-h-[80px] border-l border-line p-2 transition-colors", d.isToday ? "bg-brand/5" : "")}
                      >
                        <div className="space-y-2 h-full flex flex-col justify-start">
                          {rows.map((s) => (
                            <LessonCell key={s.id} s={s} />
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

      {/* Izoh (legenda) */}
      {slots.length > 0 && (
        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold text-ink-soft px-1">
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-brand bg-brand-soft shadow-sm" /> {t("upcomingBadge")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-emerald bg-emerald-soft shadow-sm" /> {ta("status.PRESENT")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-amber bg-amber-soft shadow-sm" /> {ta("status.LATE")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-rose bg-rose-soft shadow-sm" /> {ta("status.ABSENT")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] border-l-[3px] border-l-line bg-bg shadow-sm" /> {t("unmarked")}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
