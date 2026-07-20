import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarCheck, CalendarDays, Check, Clock, Minus, X } from "lucide-react";
import { BarRow, Card, Icon, LegendRow, MiniBars, Spinner, StackedBar, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMyAttendance, useMyCourses, useMySchedule, type AttStatus } from "./api";

const META: Record<AttStatus, { icon: typeof Check; chip: string }> = {
  PRESENT: { icon: Check, chip: "bg-emerald-soft text-emerald" },
  ABSENT: { icon: X, chip: "bg-rose-soft text-rose" },
  LATE: { icon: Clock, chip: "bg-amber-soft text-amber" },
  EXCUSED: { icon: Minus, chip: "bg-blue-soft text-blue" },
};

const MONTHS_UZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const MONTHS_RU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

/** "2026-07" → "Iyul 2026" (uz ICU oy nomlari buzuq — qo'lda). */
function monthLabel(key: string, locale: string) {
  const [y, m] = key.split("-");
  const names = locale === "ru" ? MONTHS_RU : MONTHS_UZ;
  const name = names[Number(m) - 1] ?? key;
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

/** Talaba davomati — alohida sahifada ham, profil tabida ham ishlatiladi. */
export function AttendanceSection() {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const locale = useLocale();
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [range, setRange] = useState<{ from?: string; to?: string }>({});

  const coursesQ = useMyCourses();
  const scheduleQ = useMySchedule();
  const q = useMyAttendance(courseId, range);
  const data = q.data;
  const pct = data?.stats.pct;
  const low = pct !== null && pct !== undefined && pct < 75;
  const schedule = scheduleQ.data ?? [];

  // Qoldirilgan darslar — fan kesimida (kelmagan sessiyalar).
  const missedByCourse = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["sessions"]>();
    for (const s of data?.sessions ?? []) {
      if (s.status !== "ABSENT") continue;
      if (!m.has(s.courseName)) m.set(s.courseName, []);
      m.get(s.courseName)!.push(s);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [data]);

  // Sessiyalarni oylarga guruhlash (ro'yxat uzayganda o'qilishi uchun).
  const byMonth = useMemo(() => {
    type Row = NonNullable<typeof data>["sessions"][number];
    const m = new Map<string, Row[]>();
    for (const s of data?.sessions ?? []) {
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  if (q.isLoading) {
    return (
      <div className="mt-8 flex justify-center">
        <Spinner size={26} />
      </div>
    );
  }

  const st = data?.stats;

  return (
    <div className="space-y-4">
      {/* Hero: umumiy % + taqsimot + oylik trend */}
      {st && (
        <Card className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div>
            <p className="text-note font-bold uppercase tracking-wide text-ink-soft">{t("overallPct")}</p>
            <p className={cls("mt-1 text-[44px] font-bold leading-none tabular-nums", low ? "text-rose" : "text-brand-deep")}>
              {pct !== null ? `${pct}%` : "—"}
            </p>
            <div className="mt-4">
              <StackedBar
                segments={[
                  { value: st.present, tone: "emerald" },
                  { value: st.late, tone: "amber" },
                  { value: st.excused, tone: "blue" },
                  { value: st.absent, tone: "rose" },
                ]}
              />
              <div className="mt-3 space-y-1.5">
                <LegendRow tone="emerald" label={t("present")} value={st.present} />
                <LegendRow tone="amber" label={t("late")} value={st.late} />
                <LegendRow tone="blue" label={t("excused")} value={st.excused} />
                <LegendRow tone="rose" label={t("absent")} value={st.absent} />
              </div>
            </div>
          </div>

          <div className="min-w-0">
            {data && data.byMonth.length > 0 && (
              <>
                <p className="mb-2 text-note font-bold uppercase tracking-wide text-ink-soft">{t("trend")}</p>
                <MiniBars
                  data={data.byMonth.map((m) => ({
                    label: monthLabel(m.month, locale),
                    value: m.pct,
                    tip: `${m.pct}% · ${t("markedN", { n: m.marked })}`,
                  }))}
                  height={110}
                  format={(v) => `${Math.round(v)}%`}
                />
              </>
            )}

            {data && data.byCourse.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-note font-bold uppercase tracking-wide text-ink-soft">{t("byCourse")}</p>
                <div className="space-y-0.5">
                  {data.byCourse.map((c) => (
                    <BarRow
                      key={c.courseId}
                      label={c.courseName}
                      value={c.pct ?? 0}
                      tone={c.pct !== null && c.pct < 75 ? "rose" : "brand"}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Low-attendance notice — informative, not scary */}
      {low && (
        <div className="flex items-start gap-2 rounded-card bg-amber-soft p-3.5 text-[14px] text-amber">
          <Icon icon={AlertTriangle} size={17} className="mt-0.5 shrink-0" />
          <p>{t("lowWarning", { pct })}</p>
        </div>
      )}

      {/* QOLDIRILGAN DARSLAR — fan kesimida, aniq sanalari bilan */}
      {missedByCourse.length > 0 && (
        <Card className="border-rose/30 p-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <Icon icon={X} size={15} className="text-rose" />
            <p className="text-note font-bold uppercase tracking-wide text-rose">{t("missedSection")}</p>
            <span className="rounded-pill bg-rose-soft px-2 py-0.5 text-note font-bold text-rose">
              {st?.absent ?? 0}
            </span>
          </div>
          <div className="divide-y divide-line">
            {missedByCourse.map(([course, rows]) => (
              <div key={course} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-body font-semibold text-ink">{course}</p>
                  <span className="shrink-0 text-note font-bold text-rose">{t("missedN", { n: rows.length })}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rows.map((s) => (
                    <span key={s.id} className="rounded-pill bg-rose-soft px-2 py-0.5 text-[12.5px] font-medium text-rose" title={s.title ?? undefined}>
                      {formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")}
                      {s.title ? ` · ${s.title}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Kelgusi darslar */}
      {schedule.length > 0 && (
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <Icon icon={CalendarDays} size={15} className="text-ink-faint" />
            <p className="text-note font-bold uppercase tracking-wide text-ink-soft">{t("upcoming")}</p>
          </div>
          <div className="divide-y divide-line">
            {schedule.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-ink">{s.title ?? s.courseName}</p>
                  <p className="truncate text-note text-ink-faint">
                    {s.courseName}
                    {s.room ? ` · ${s.room}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-note font-medium text-ink-soft">
                  {formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={courseId ?? ""}
          onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-control border border-line bg-surface px-2 py-2 text-[14px] outline-none focus:border-brand"
        >
          <option value="">{t("allCourses")}</option>
          {(coursesQ.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.subjectName}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={range.from ?? ""}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))}
          className="rounded-control border border-line px-2 py-2 text-[14px] outline-none focus:border-brand"
        />
        <span className="text-ink-faint">—</span>
        <input
          type="date"
          value={range.to ?? ""}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))}
          className="rounded-control border border-line px-2 py-2 text-[14px] outline-none focus:border-brand"
        />
      </div>

      {/* Darslar ro'yxati — oylar bo'yicha */}
      <AsyncSection
        isLoading={false}
        isError={q.isError}
        isEmpty={!!data && data.sessions.length === 0}
        emptyIcon={<Icon icon={CalendarCheck} size={22} />}
        emptyText={t("empty")}
        onRetry={() => q.refetch()}
      >
        <div className="space-y-5">
          {byMonth.map(([month, rows]) => (
            <div key={month}>
              <p className="mb-2 text-note font-bold uppercase tracking-wide text-ink-faint">
                {monthLabel(month, locale)} · {t("lessonsN", { n: rows.length })}
              </p>
              <Card className="divide-y divide-line p-0">
                {rows.map((s) => {
                  const m = META[s.status];
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", m.chip)}>
                        <Icon icon={m.icon} size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold text-ink">{s.title ?? s.courseName}</p>
                        <p className="truncate text-[13px] text-ink-faint">
                          {formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")} · {s.courseName}
                        </p>
                      </div>
                      <span className={cls("shrink-0 rounded-pill px-2.5 py-0.5 text-[12.5px] font-semibold", m.chip)}>
                        {t(`status.${s.status}`)}
                      </span>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      </AsyncSection>
    </div>
  );
}
