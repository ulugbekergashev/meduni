import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, DoorClosed, Search, Users2 } from "lucide-react";
import { Button, Card, Icon, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { RollCallModal } from "./course/attendance/RollCallModal";
import { useTeacherLessons, type DerivedLesson } from "./api";

const WEEKDAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const WEEKDAYS_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(base: Date, off: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
  return d;
}
function statusTone(s: DerivedLesson["status"]): string {
  return s === "FULL" ? "border-l-emerald" : s === "PARTIAL" ? "border-l-amber" : "border-l-brand";
}

function LessonRow({ l, onMark }: { l: DerivedLesson; onMark: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teachSchedule" });
  return (
    <div className={cls("flex flex-wrap items-center gap-3 border-l-4 bg-surface px-4 py-2.5", statusTone(l.status))}>
      <span className="w-12 shrink-0 text-[14px] font-bold tabular-nums text-ink">{l.startTime}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-ink">{l.courseName}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-ink-soft">
          {l.groupName && <span className="inline-flex items-center gap-1"><Icon icon={Users2} size={11} /> {l.groupName}</span>}
          {l.room && <span className="inline-flex items-center gap-1"><Icon icon={DoorClosed} size={11} /> {l.room}</span>}
        </p>
      </div>
      <span className="shrink-0 text-[12.5px] tabular-nums text-ink-faint">{l.markedCount}/{l.rosterSize}</span>
      <Button size="sm" variant={l.status === "FULL" ? "ghost" : "primary"} icon={<Icon icon={ClipboardCheck} size={15} />} onClick={onMark}>
        {l.status === "UNMARKED" ? t("mark") : t("edit")}
      </Button>
    </div>
  );
}

export function TeachSchedulePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "teachSchedule" });
  const locale = useLocale();
  const dayNames = locale === "ru" ? WEEKDAYS_RU : WEEKDAYS_UZ;
  const now = new Date();

  const [weekOffset, setWeekOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [roll, setRoll] = useState<DerivedLesson | null>(null);

  const monday = useMemo(() => mondayOf(now, weekOffset), [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; }), [monday]);
  const todayKey = dayKey(now);

  const q = useTeacherLessons({ from: dayKey(weekDays[0]), to: dayKey(weekDays[6]), search: search.trim() || undefined });
  const lessons = q.data ?? [];

  const byDay = useMemo(() => {
    const m = new Map<string, DerivedLesson[]>();
    for (const l of lessons) (m.get(l.dayKey) ?? m.set(l.dayKey, []).get(l.dayKey)!).push(l);
    return m;
  }, [lessons]);

  const weekLabel = `${formatDate(locale === "ru" ? "ru" : "uz", weekDays[0], "short")} – ${formatDate(locale === "ru" ? "ru" : "uz", weekDays[6], "short")}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-[14.5px] text-ink-soft">{t("subtitleAuto")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[14.5px] outline-none focus:border-brand" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
          <span className="min-w-[150px] text-center text-[14px] font-semibold text-ink">{weekLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
          {weekOffset !== 0 && <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>{t("today")}</Button>}
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
      ) : lessons.length === 0 ? (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty emptyIcon={<Icon icon={CalendarDays} size={22} />} emptyText={search.trim() ? t("noMatch") : t("noneThisWeek")} emptyHint={search.trim() ? undefined : t("noneHint")} onRetry={() => q.refetch()}>
          <div />
        </AsyncSection>
      ) : (
        <div className="space-y-3">
          {weekDays.map((d, i) => {
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            if (list.length === 0) return null;
            const isToday = k === todayKey;
            return (
              <Card key={k} className={cls("!p-0 overflow-hidden", isToday && "ring-2 ring-brand")}>
                <div className={cls("flex items-center gap-2 px-4 py-2.5", isToday ? "bg-brand-soft" : "bg-bg")}>
                  <span className={cls("text-[14px] font-bold", isToday ? "text-brand-deep" : "text-ink")}>{dayNames[i]}</span>
                  <span className="text-[13px] text-ink-faint">{formatDate(locale === "ru" ? "ru" : "uz", d, "short")}</span>
                  {isToday && <span className="rounded-pill bg-brand px-2 py-0.5 text-[11.5px] font-bold text-white">{t("today")}</span>}
                  <span className="ml-auto text-[12.5px] text-ink-faint">{t("nLessons", { n: list.length })}</span>
                </div>
                <div className="divide-y divide-line">
                  {list.map((l) => <LessonRow key={l.slotId + l.dayKey} l={l} onMark={() => setRoll(l)} />)}
                </div>
              </Card>
            );
          })}
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
