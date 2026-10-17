import { useTranslation } from "react-i18next";
import { CalendarDays, Check, DoorClosed, Users2 } from "lucide-react";
import { EmptyState, Icon } from "@meduni/ui";
import { BentoCard, BentoRow } from "../../../components/bento";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import type { DerivedLesson } from "../api";

export type TeachDaySchedule = { mode: "today" | "next"; dayKey: string; lessons: DerivedLesson[] };

/** Bugungi darslar, aks holda eng yaqin kungi darslar (vaqt bo'yicha). */
export function pickTeachDay(lessons: DerivedLesson[], todayKey: string): TeachDaySchedule | null {
  const sorted = [...lessons].sort((a, b) => (a.dayKey + a.startTime).localeCompare(b.dayKey + b.startTime));
  const today = sorted.filter((l) => l.dayKey === todayKey);
  if (today.length > 0) return { mode: "today", dayKey: todayKey, lessons: today };
  const next = sorted.find((l) => l.dayKey > todayKey);
  if (!next) return null;
  return { mode: "next", dayKey: next.dayKey, lessons: sorted.filter((l) => l.dayKey === next.dayKey) };
}

/**
 * O'ng ustun: bugungi (yoki eng yaqin kungi) darslar — vaqt, kurs, guruh va
 * yo'qlama holati. Qator bosilsa yo'qlama oynasi ochiladi.
 */
export function TodayLessonsCard({
  sched,
  isLoading,
  isError,
  onRetry,
  onMark,
  onOpenSchedule,
}: {
  sched: TeachDaySchedule | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onMark: (l: DerivedLesson) => void;
  onOpenSchedule: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const { t: ts } = useTranslation(undefined, { keyPrefix: "teachSchedule" });
  const locale = useLocale();
  const lang = locale === "ru" ? "ru" : "uz";
  const now = new Date();

  const title = sched?.mode === "next" ? t("nextLessonsTitle") : t("todayLessons");
  const date = sched ? new Date(`${sched.dayKey}T00:00:00`) : now;

  return (
    <BentoCard
      className="h-full"
      title={title}
      meta={formatDate(lang, date, "short")}
      action={{ label: t("openSchedule"), onClick: onOpenSchedule }}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      bodyClassName="px-2 pb-3"
    >
      {!sched ? (
        <div className="flex flex-1 items-center justify-center px-2 py-6">
          <EmptyState icon={<Icon icon={CalendarDays} size={20} />} text={t("noTodayLessons")} hint={ts("noneHint")} />
        </div>
      ) : (
        <ul className="space-y-1">
          {sched.lessons.map((l) => (
            <li key={l.slotId + l.dayKey}>
              <BentoRow
                onClick={() => onMark(l)}
                arrow={false}
                lead={
                  <span className="w-14 shrink-0 rounded-control bg-surface-raised py-1.5 text-center font-data text-note font-semibold tabular-nums text-ink">
                    {l.startTime}
                  </span>
                }
                title={l.courseName}
                sub={
                  <span className="flex items-center gap-2">
                    {l.groupName && (
                      <span className="inline-flex items-center gap-0.5">
                        <Icon icon={Users2} size={11} /> {l.groupName}
                      </span>
                    )}
                    {l.room && (
                      <span className="inline-flex items-center gap-0.5">
                        <Icon icon={DoorClosed} size={11} /> {l.room}
                      </span>
                    )}
                  </span>
                }
                right={
                  l.status === "FULL" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 font-sans text-micro font-semibold text-emerald">
                      <Icon icon={Check} size={12} /> {l.markedCount}/{l.rosterSize}
                    </span>
                  ) : l.status === "PARTIAL" ? (
                    <span className="rounded-pill bg-amber-soft px-2.5 py-1 text-micro font-semibold text-amber">
                      {l.markedCount}/{l.rosterSize}
                    </span>
                  ) : (
                    <span className="rounded-pill border border-line-raised px-2.5 py-1 font-sans text-micro font-semibold text-ink-2">
                      {t("markAttendance")}
                    </span>
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}
