import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, Check, DoorOpen } from "lucide-react";
import { EmptyState, Icon } from "@meduni/ui";
import { BentoCard, BentoRow } from "../../../components/bento";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import type { ScheduleItem } from "../api";

/** Bir juftlik — 80 daqiqa. Shu oraliqda dars "Hozir" deb belgilanadi. */
const PAIR_MINUTES = 80;

export type DaySchedule = { mode: "today" | "next"; date: string; sessions: ScheduleItem[] };

function hhmm(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isOngoing(s: ScheduleItem, now: Date): boolean {
  const start = new Date(s.date).getTime();
  return now.getTime() >= start && now.getTime() < start + PAIR_MINUTES * 60_000;
}

/** Bugungi (yoki eng yaqin kungi) darslar — vaqt, mavzu, holat. */
export function TodayCard({
  sched,
  isLoading,
  isError,
  onRetry,
}: {
  sched: DaySchedule | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const locale = useLocale();
  const lang = locale === "ru" ? "ru" : "uz";
  const navigate = useNavigate();
  const now = new Date();

  const title = sched?.mode === "next" ? t("nextLessons") : t("todayTitle");
  const dateLabel = formatDate(lang, sched?.date ?? now, "short");

  return (
    <BentoCard
      className="h-full"
      title={title}
      meta={dateLabel}
      action={{ label: t("openSchedule"), onClick: () => navigate("/app/schedule") }}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      bodyClassName="px-2 pb-3"
    >
      {!sched ? (
        <div className="flex flex-1 items-center justify-center px-2 py-6">
          <EmptyState icon={<Icon icon={CalendarDays} size={20} />} text={t("noLessonsWeek")} />
        </div>
      ) : (
        <ul className="space-y-1">
          {sched.sessions.map((s) => {
            const ongoing = !s.isPast && isOngoing(s, now);
            return (
              <li key={s.key}>
                <BentoRow
                  onClick={() => navigate("/app/schedule")}
                  arrow={false}
                  muted={s.isPast}
                  lead={
                    <span className="w-14 shrink-0 rounded-control bg-surface-raised py-1.5 text-center font-data text-note font-semibold tabular-nums text-ink">
                      {hhmm(s.date)}
                    </span>
                  }
                  title={s.title ?? s.courseName}
                  sub={
                    <span className="flex items-center gap-1.5">
                      {s.courseName}
                      {s.room && (
                        <span className="inline-flex items-center gap-0.5">
                          <Icon icon={DoorOpen} size={11} /> {s.room}
                        </span>
                      )}
                    </span>
                  }
                  right={
                    ongoing ? (
                      <span className="rounded-pill bg-ink px-2.5 py-1 font-sans text-micro font-semibold text-surface">{t("nowPill")}</span>
                    ) : s.isPast ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 font-sans text-micro font-semibold text-ink-soft">
                        <Icon icon={Check} size={12} /> {t("pastPill")}
                      </span>
                    ) : (
                      <span className="rounded-pill border border-line-raised px-2.5 py-1 font-sans text-micro font-semibold text-ink-2">
                        {t("upcomingPill")}
                      </span>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </BentoCard>
  );
}
