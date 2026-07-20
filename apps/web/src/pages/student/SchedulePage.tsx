import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, DoorOpen, Minus, X } from "lucide-react";
import { Card, Icon, Spinner, cls } from "@meduni/ui";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMySchedule, type AttStatus, type ScheduleItem } from "./api";

const WEEKDAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const WEEKDAYS_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

const STATUS_META: Record<AttStatus, { icon: typeof Check; chip: string; key: string }> = {
  PRESENT: { icon: Check, chip: "bg-emerald-soft text-emerald", key: "PRESENT" },
  ABSENT: { icon: X, chip: "bg-rose-soft text-rose", key: "ABSENT" },
  LATE: { icon: Clock, chip: "bg-amber-soft text-amber", key: "LATE" },
  EXCUSED: { icon: Minus, chip: "bg-blue-soft text-blue", key: "EXCUSED" },
};

/** Dushanba boshlanadigan hafta boshi. */
function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x;
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function timeOf(dateIso: string) {
  const d = new Date(dateIso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function SessionRow({ s }: { s: ScheduleItem }) {
  const { t } = useTranslation(undefined, { keyPrefix: "schedule" });
  const { t: ta } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const time = timeOf(s.date);
  const meta = s.myStatus ? STATUS_META[s.myStatus] : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-14 shrink-0 text-center">
        {time ? (
          <span className="text-[15px] font-bold tabular-nums text-ink">{time}</span>
        ) : (
          <Icon icon={CalendarDays} size={16} className="mx-auto text-ink-faint" />
        )}
      </div>
      <div className="min-w-0 flex-1 border-l-2 border-brand-soft pl-3">
        <p className="truncate text-body font-semibold text-ink">{s.title ?? s.courseName}</p>
        <p className="flex flex-wrap items-center gap-x-2.5 truncate text-note text-ink-faint">
          <span>{s.courseName}</span>
          {s.room && (
            <span className="inline-flex items-center gap-1">
              <Icon icon={DoorOpen} size={12} /> {s.room}
            </span>
          )}
        </p>
      </div>
      {s.isPast ? (
        meta ? (
          <span className={cls("inline-flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-0.5 text-[12.5px] font-semibold", meta.chip)}>
            <Icon icon={meta.icon} size={12} />
            {ta(`status.${meta.key}`)}
          </span>
        ) : (
          <span className="shrink-0 rounded-pill bg-bg px-2.5 py-0.5 text-[12.5px] font-medium text-ink-faint">{t("unmarked")}</span>
        )
      ) : (
        <span className="shrink-0 rounded-pill bg-brand-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-brand-deep">{t("upcomingBadge")}</span>
      )}
    </div>
  );
}

/** Dars jadvali — hafta ko'rinishi, o'tgan darslar o'z yo'qlama holati bilan. */
export function SchedulePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "schedule" });
  const locale = useLocale();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  const weekEnd = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(e.getDate() + 6);
    return e;
  }, [weekStart]);

  const q = useMySchedule({ from: iso(weekStart), to: iso(weekEnd) });
  const sessions = q.data ?? [];

  const days = useMemo(() => {
    const names = locale === "ru" ? WEEKDAYS_RU : WEEKDAYS_UZ;
    const todayKey = iso(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = iso(d);
      return {
        key,
        name: names[i],
        date: d,
        isToday: key === todayKey,
        rows: sessions.filter((s) => iso(new Date(s.date)) === key),
      };
    });
  }, [weekStart, sessions, locale]);

  const shift = (dir: -1 | 1) =>
    setWeekStart((w) => {
      const n = new Date(w);
      n.setDate(n.getDate() + dir * 7);
      return n;
    });

  const fmt = (d: Date) => formatDate(locale === "ru" ? "ru" : "uz", d, "short");
  const totalLessons = sessions.length;

  return (
    <div className="mx-auto max-w-3xl">
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
        <span className="ml-auto text-note font-semibold text-ink-soft">{t("lessonsN", { n: totalLessons })}</span>
      </div>

      {q.isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner size={26} />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {days.map((day) => (
            <section key={day.key}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className={cls("text-body font-bold", day.isToday ? "text-brand-deep" : "text-ink")}>
                  {day.name}
                </h2>
                <span className="text-note text-ink-faint">{fmt(day.date)}</span>
                {day.isToday && (
                  <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-[12px] font-bold text-brand-deep">
                    {t("todayBadge")}
                  </span>
                )}
              </div>
              {day.rows.length === 0 ? (
                <p className="rounded-control border border-dashed border-line px-4 py-2.5 text-note text-ink-faint">
                  {t("noLessons")}
                </p>
              ) : (
                <Card className="divide-y divide-line p-0">
                  {day.rows.map((s) => (
                    <SessionRow key={s.id} s={s} />
                  ))}
                </Card>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
