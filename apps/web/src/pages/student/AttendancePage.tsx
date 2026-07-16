import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarCheck, Check, Clock, Minus, X } from "lucide-react";
import { Card, Icon, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale } from "../../lib/useLocale";
import { useMyAttendance, useMyCourses, type AttStatus } from "./api";

const META: Record<AttStatus, { icon: typeof Check; chip: string; dot: string }> = {
  PRESENT: { icon: Check, chip: "bg-emerald-soft text-emerald", dot: "text-emerald" },
  ABSENT: { icon: X, chip: "bg-rose-soft text-rose", dot: "text-rose" },
  LATE: { icon: Clock, chip: "bg-amber-soft text-amber", dot: "text-amber" },
  EXCUSED: { icon: Minus, chip: "bg-blue-soft text-blue", dot: "text-blue" },
};

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3 text-center">
      <p className={cls("text-[24px] font-bold tabular-nums leading-none", tone)}>{value}</p>
      <p className="mt-1 text-[12px] text-ink-soft">{label}</p>
    </div>
  );
}

export function AttendancePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const locale = useLocale();
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [range, setRange] = useState<{ from?: string; to?: string }>({});

  const coursesQ = useMyCourses();
  const q = useMyAttendance(courseId, range);
  const data = q.data;
  const pct = data?.stats.pct;
  const low = pct !== null && pct !== undefined && pct < 75;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>

      {q.isLoading ? (
        <div className="mt-8 flex justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection
          isLoading={false}
          isError={q.isError}
          isEmpty={!!data && data.sessions.length === 0}
          emptyIcon={<Icon icon={CalendarCheck} size={22} />}
          emptyText={t("empty")}
          onRetry={() => q.refetch()}
        >
          {data && (
            <>
              {/* Overall % */}
              <div className={cls("mt-4 rounded-card border p-5", low ? "border-rose/30 bg-rose-soft" : "border-line bg-surface")}>
                <p className="text-[12.5px] font-medium uppercase tracking-wide text-ink-soft">{t("overallPct")}</p>
                <p className={cls("text-[40px] font-bold leading-none tabular-nums", low ? "text-rose" : "text-brand-deep")}>
                  {pct !== null ? `${pct}%` : "—"}
                </p>
              </div>

              {/* Low-attendance notice — informative, not scary */}
              {low && (
                <div className="mt-3 flex items-start gap-2 rounded-card bg-amber-soft p-3.5 text-[13px] text-amber">
                  <Icon icon={AlertTriangle} size={17} className="mt-0.5 shrink-0" />
                  <p>{t("lowWarning", { pct })}</p>
                </div>
              )}

              {/* Breakdown */}
              <div className="mt-4 grid grid-cols-4 gap-2.5">
                <StatTile label={t("present")} value={data.stats.present} tone="text-emerald" />
                <StatTile label={t("absent")} value={data.stats.absent} tone="text-rose" />
                <StatTile label={t("late")} value={data.stats.late} tone="text-amber" />
                <StatTile label={t("excused")} value={data.stats.excused} tone="text-blue" />
              </div>

              {/* Filters */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <select value={courseId ?? ""} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : undefined)} className="rounded-control border border-line bg-surface px-2 py-2 text-[13px] outline-none focus:border-brand">
                  <option value="">{t("allCourses")}</option>
                  {(coursesQ.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.subjectName}</option>
                  ))}
                </select>
                <input type="date" value={range.from ?? ""} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))} className="rounded-control border border-line px-2 py-2 text-[13px] outline-none focus:border-brand" />
                <span className="text-ink-faint">—</span>
                <input type="date" value={range.to ?? ""} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))} className="rounded-control border border-line px-2 py-2 text-[13px] outline-none focus:border-brand" />
              </div>

              {/* Sessions */}
              <div className="mt-4 space-y-2">
                {data.sessions.map((s) => {
                  const m = META[s.status];
                  return (
                    <Card key={s.id} className="flex items-center gap-3 py-3">
                      <div className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", m.chip)}>
                        <Icon icon={m.icon} size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-ink">
                          {s.title ?? s.courseName}
                        </p>
                        <p className="truncate text-[12px] text-ink-faint">
                          {new Date(s.date).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ")} · {s.courseName}
                        </p>
                      </div>
                      <span className={cls("shrink-0 rounded-pill px-2.5 py-0.5 text-[11.5px] font-semibold", m.chip)}>{t(`status.${s.status}`)}</span>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </AsyncSection>
      )}
    </div>
  );
}
