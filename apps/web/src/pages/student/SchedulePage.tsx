import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, ChevronRight, Clock, DoorOpen, Minus, X } from "lucide-react";
import { Card, Icon, Spinner, cls } from "@meduni/ui";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMySchedule, type AttStatus, type ScheduleItem } from "./api";

const WEEKDAYS_UZ = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Katak ohangi: o'tgan dars — yo'qlama holati, kelgusi — brand. */
const STATUS_CELL: Record<AttStatus, { border: string; chip: string; icon: typeof Check }> = {
  PRESENT: { border: "border-l-emerald bg-emerald-soft/40", chip: "bg-emerald-soft text-emerald", icon: Check },
  ABSENT: { border: "border-l-rose bg-rose-soft/40", chip: "bg-rose-soft text-rose", icon: X },
  LATE: { border: "border-l-amber bg-amber-soft/40", chip: "bg-amber-soft text-amber", icon: Clock },
  EXCUSED: { border: "border-l-blue bg-blue-soft/40", chip: "bg-blue-soft text-blue", icon: Minus },
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
    <div
      className={cls(
        "h-full rounded-control border-l-[3px] p-2 text-left",
        meta ? meta.border : s.isPast ? "border-l-line bg-bg" : "border-l-brand bg-brand-soft/40"
      )}
    >
      <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">{s.title ?? s.courseName}</p>
      <p className="mt-0.5 truncate text-[12px] text-ink-soft">{s.courseName}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {s.room && (
          <span className="inline-flex items-center gap-0.5 text-[12px] text-ink-faint">
            <Icon icon={DoorOpen} size={11} /> {s.room}
          </span>
        )}
        {meta && (
          <span className={cls("inline-flex items-center rounded-pill px-1.5 py-0.5", meta.chip)}>
            <Icon icon={meta.icon} size={10} />
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

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-body text-ink-soft">{t("subtitle")}</p>

      {/* Hafta navigatsiyasi */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => shift(-1)}
          aria-label={t("prevWeek")}
          className="flex h-9 w-9 items-center justify-center rounded-control border border-line text-ink-soft transition-colors hover:bg-bg"
        >
          <Icon icon={ChevronLeft} size={16} />
        </button>
        <span className="min-w-[190px] text-center text-body font-bold text-ink">
          {fmt(weekStart)} — {fmt(weekEnd)}
        </span>
        <button
          onClick={() => shift(1)}
          aria-label={t("nextWeek")}
          className="flex h-9 w-9 items-center justify-center rounded-control border border-line text-ink-soft transition-colors hover:bg-bg"
        >
          <Icon icon={ChevronRight} size={16} />
        </button>
        <button
          onClick={() => setWeekStart(mondayOf(new Date()))}
          className="rounded-control border border-line px-3 py-1.5 text-body font-semibold text-ink-soft transition-colors hover:bg-bg"
        >
          {t("today")}
        </button>
        <span className="ml-auto text-note font-semibold text-ink-soft">{t("lessonsN", { n: sessions.length })}</span>
      </div>

      {q.isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner size={26} />
        </div>
      ) : slots.length === 0 ? (
        <Card className="mt-5">
          <p className="py-10 text-center text-body text-ink-faint">{t("emptyWeek")}</p>
        </Card>
      ) : (
        <Card className="mt-5 overflow-x-auto p-0">
          {/* Jadval to'ri: vaqt ustuni + 7 kun */}
          <div className="min-w-[820px]">
            {/* Sarlavha qatori */}
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-line bg-bg">
              <div />
              {days.map((d) => (
                <div
                  key={d.key}
                  className={cls(
                    "border-l border-line px-2 py-2 text-center",
                    d.isToday && "bg-brand-soft"
                  )}
                >
                  <p className={cls("text-[12.5px] font-bold uppercase", d.isToday ? "text-brand-deep" : "text-ink-soft")}>
                    {d.short}
                  </p>
                  <p className={cls("text-[15px] font-bold tabular-nums", d.isToday ? "text-brand-deep" : "text-ink")}>
                    {d.num}
                  </p>
                </div>
              ))}
            </div>

            {/* Vaqt qatorlari */}
            {slots.map((slot) => (
              <div key={slot} className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-line last:border-0">
                <div className="flex items-start justify-center px-1 py-2">
                  <span className="text-[13px] font-bold tabular-nums text-ink-soft">{slot}</span>
                </div>
                {days.map((d) => {
                  const rows = at(slot, d.key);
                  return (
                    <div
                      key={d.key}
                      className={cls("min-h-[72px] border-l border-line p-1.5", d.isToday && "bg-brand-soft/30")}
                    >
                      <div className="space-y-1.5">
                        {rows.map((s) => (
                          <LessonCell key={s.id} s={s} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Izoh (legenda) */}
      {slots.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-note text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] border-l-[3px] border-l-brand bg-brand-soft" /> {t("upcomingBadge")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] border-l-[3px] border-l-emerald bg-emerald-soft" /> {ta("status.PRESENT")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] border-l-[3px] border-l-amber bg-amber-soft" /> {ta("status.LATE")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] border-l-[3px] border-l-rose bg-rose-soft" /> {ta("status.ABSENT")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] border-l-[3px] border-l-line bg-bg" /> {t("unmarked")}
          </span>
        </div>
      )}
    </div>
  );
}
