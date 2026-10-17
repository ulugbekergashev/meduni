import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarCheck, CalendarDays, ChevronDown, X } from "lucide-react";
import { Icon, LegendRow, MiniBars, StackedBar, cls } from "@meduni/ui";
import { BentoCard, BentoRow } from "../../components/bento";
import { AsyncSection } from "../../components/AsyncSection";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { ATT_META as META, isLowAttendance } from "../../lib/attendance";
import { useMyAttendance, useMyCourses, useMySchedule, type AttStatus } from "./api";
import { CheckInCard } from "./CheckInCard";
import { ExcuseList, MakeupList } from "./AbsenceActions";
import { CorridorRow, hhmm, monthLabel } from "./attendance/parts";

/** Yuqori qator ustunlari — kartalar soniga teng (statik: JIT dinamik klassni ko'rmaydi). */
const TOP_COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

const fieldCls =
  "h-9 rounded-pill border border-line bg-surface-raised px-3 text-note text-ink outline-none transition-colors hover:border-line-raised focus:border-brand";

/** Talaba davomati — Davomat sahifasining asosiy bo'limi. */
export function AttendanceSection() {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const locale = useLocale();
  const lang = locale === "ru" ? "ru" : "uz";
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<AttStatus | null>(null);

  const coursesQ = useMyCourses();
  const scheduleQ = useMySchedule();
  const q = useMyAttendance(courseId, range);
  const data = q.data;
  const pct = data?.stats.pct;
  const low = isLowAttendance(pct);
  const schedule = scheduleQ.data ?? [];

  // Qoldirilgan darslar — fan kesimida (kelmagan sessiyalar).
  const missedByCourse = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["sessions"]>();
    for (const s of data?.sessions ?? []) {
      if (s.status !== "ABSENT") continue;
      if (!m.has(s.courseName)) m.set(s.courseName, []);
      m.get(s.courseName)!.push(s);
    }
    return m;
  }, [data]);

  // KORIDOR: reja soati ma'lum fanlar — eng og'iri birinchi.
  const corridor = useMemo(() => {
    const rows = (data?.byCourse ?? []).filter((c) => c.limit && c.limit.plannedHours > 0);
    const rank: Record<string, number> = { BLOCKED: 0, DANGER: 1, WARN: 2, OK: 3 };
    return [...rows].sort((a, b) => rank[a.limit!.zone] - rank[b.limit!.zone] || b.limit!.unexcusedHours - a.limit!.unexcusedHours);
  }, [data]);
  const worst = corridor[0] ?? null;

  // Sessiyalarni oylarga guruhlash (ro'yxat uzayganda o'qilishi uchun).
  const byMonth = useMemo(() => {
    type Row = NonNullable<typeof data>["sessions"][number];
    const m = new Map<string, Row[]>();
    for (const s of data?.sessions ?? []) {
      if (statusFilter && s.status !== statusFilter) continue;
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data, statusFilter]);

  const st = data?.stats;
  // Bitta oylik ustun — taqqoslash yo'q, grafik emas ("buzuq" ko'rinadi).
  const showTrend = !!data && data.byMonth.length >= 2;
  const topCount = 1 + (corridor.length > 0 ? 1 : 0) + (showTrend ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* FaceID davomat — vaqt oynasi ochiq dars bo'lsagina ko'rinadi */}
      <CheckInCard />

      {q.isLoading || (q.isError && !data) ? (
        <BentoCard isLoading={q.isLoading} isError={q.isError} onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className={cls("grid grid-cols-1 gap-3", TOP_COLS[topCount])}>
            {/* Umumiy % + taqsimot — legenda bosilsa jurnal filtrlanadi */}
            {st && (
              <section className={cls("flex flex-col rounded-card p-4", low ? "bg-rose-soft" : "bg-amber-soft")}>
                <p className="text-note font-semibold text-ink-2">{t("overallShort")}</p>
                <p className={cls("mt-1 text-display font-semibold tabular-nums", low ? "text-rose" : "text-ink")}>
                  {pct !== null && pct !== undefined ? `${pct}%` : "—"}
                </p>
                <div className="mt-3">
                  <StackedBar
                    segments={[
                      { value: st.present, tone: "emerald" },
                      { value: st.late, tone: "amber" },
                      { value: st.excused, tone: "blue" },
                      { value: st.absent, tone: "rose" },
                    ]}
                  />
                </div>
                <div className="mt-3 space-y-0.5 rounded-control bg-surface/70 p-1.5">
                  {([
                    ["PRESENT", "emerald", t("present"), st.present],
                    ["LATE", "amber", t("late"), st.late],
                    ["EXCUSED", "blue", t("excused"), st.excused],
                    ["ABSENT", "rose", t("absent"), st.absent],
                  ] as const).map(([key, tone, label, value]) => (
                    <LegendRow
                      key={key}
                      tone={tone}
                      label={label}
                      value={value}
                      selected={statusFilter === key}
                      onClick={() => setStatusFilter((cur) => (cur === key ? null : (key as AttStatus)))}
                    />
                  ))}
                </div>
                {statusFilter && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter(null)}
                    className="mt-2 self-start rounded-control text-note font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {t("clearFilter")}
                  </button>
                )}
              </section>
            )}

            {/* KORIDOR — fanlar bo'yicha SOATLI holat. Nizom davomatni darsda emas,
                akademik soatda hisoblaydi va uning OQIBATI bor. */}
            {corridor.length > 0 && (
              <BentoCard title={t("corridorTitle")} bodyClassName="px-2 pb-3">
                {corridor.map((c, i) => (
                  <CorridorRow key={c.courseId} name={c.courseName} limit={c.limit!} first={i === 0} />
                ))}
                {worst && worst.limit!.zone !== "OK" && (
                  <p className="mt-1 border-t border-line-soft px-2 pt-2 text-micro text-ink-soft">
                    {worst.limit!.zone === "BLOCKED"
                      ? t("zoneBlockedHint")
                      : t("corridorHint", { pct: Math.round((worst.limit!.limitHours / Math.max(1, worst.limit!.plannedHours)) * 100) })}
                  </p>
                )}
              </BentoCard>
            )}

            {showTrend && (
              <BentoCard title={t("trend")}>
                <MiniBars
                  data={data!.byMonth.map((m) => ({
                    label: monthLabel(m.month, locale),
                    value: m.pct,
                    tip: `${m.pct}% · ${t("markedN", { n: m.marked })}`,
                  }))}
                  height={120}
                  format={(v) => `${Math.round(v)}%`}
                />
              </BentoCard>
            )}
          </div>

          {/* Past davomat — xabardor qiladi, qo'rqitmaydi */}
          {low && (
            <div className="flex items-start gap-3 rounded-card bg-amber-soft p-4 text-body text-amber">
              <Icon icon={AlertTriangle} size={18} className="mt-0.5 shrink-0" />
              <p className="font-medium">{t("lowWarning", { pct })}</p>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-3">
              {/* FANLAR BO'YICHA — jami/keldi/kechikdi/sababli/QOLDIRDI + davomat % */}
              {data && data.byCourse.length > 0 && (
                <BentoCard title={t("byCourse")} bodyClassName="px-2 pb-2">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-0 border-collapse sm:min-w-[520px]">
                      <thead>
                        <tr className="text-micro font-semibold text-ink-soft">
                          <th className="rounded-l-control bg-surface-raised px-3 py-2 text-left">{t("colSubject")}</th>
                          <th className="hidden bg-surface-raised px-2 py-2 text-center sm:table-cell">{t("colTotal")}</th>
                          <th className="hidden bg-surface-raised px-2 py-2 text-center sm:table-cell">{t("present")}</th>
                          <th className="hidden bg-surface-raised px-2 py-2 text-center sm:table-cell">{t("late")}</th>
                          <th className="hidden bg-surface-raised px-2 py-2 text-center sm:table-cell">{t("excused")}</th>
                          <th className="bg-surface-raised px-2 py-2 text-center text-rose">{t("colMissed")}</th>
                          <th className="rounded-r-control bg-surface-raised px-3 py-2 text-right">{t("colPct")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byCourse.map((c) => {
                          const missed = missedByCourse.get(c.courseName) ?? [];
                          const courseSessions = (data?.sessions ?? []).filter((x) => x.courseName === c.courseName);
                          const open = expanded === c.courseId;
                          const lowRow = isLowAttendance(c.pct);
                          const toggle = () => setExpanded(open ? null : c.courseId);
                          return (
                            <Fragment key={c.courseId}>
                              <tr
                                onClick={toggle}
                                className="cursor-pointer border-b border-line-soft text-body transition-colors hover:bg-surface-raised"
                              >
                                <td className="px-3 py-2.5">
                                  <button
                                    type="button"
                                    aria-expanded={open}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggle();
                                    }}
                                    className="flex items-center gap-1.5 rounded-control text-left font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                                  >
                                    <Icon icon={ChevronDown} size={14} className={cls("text-ink-soft transition-transform", !open && "-rotate-90")} />
                                    {c.courseName}
                                  </button>
                                </td>
                                <td className="hidden px-2 py-2.5 text-center font-data tabular-nums text-ink-soft sm:table-cell">{c.marked}</td>
                                <td className="hidden px-2 py-2.5 text-center font-data font-semibold tabular-nums text-emerald sm:table-cell">{c.present}</td>
                                <td className="hidden px-2 py-2.5 text-center font-data font-semibold tabular-nums text-amber sm:table-cell">{c.late}</td>
                                <td className="hidden px-2 py-2.5 text-center font-data font-semibold tabular-nums text-blue sm:table-cell">{c.excused}</td>
                                <td className="px-2 py-2.5 text-center font-data font-semibold tabular-nums text-rose">{c.absent}</td>
                                <td className={cls("px-3 py-2.5 text-right font-data font-semibold tabular-nums", lowRow ? "text-rose" : "text-ink")}>
                                  {c.pct !== null ? `${c.pct}%` : "—"}
                                </td>
                              </tr>
                              {open && (
                                <tr className="border-b border-line-soft">
                                  <td colSpan={7} className="px-3 py-3">
                                    <div className="rounded-control bg-surface-raised p-3">
                                      {missed.length > 0 && (
                                        <>
                                          <p className="mb-1.5 text-micro font-semibold text-rose">{t("missedSection")}</p>
                                          <div className="mb-3 space-y-1">
                                            {missed.map((m) => (
                                              <div key={m.id} className="flex items-center gap-2 text-note">
                                                <Icon icon={X} size={12} className="shrink-0 text-rose" />
                                                <span className="shrink-0 font-semibold tabular-nums text-ink">
                                                  {formatDate(lang, m.date, "short")} · {hhmm(new Date(m.date))}
                                                </span>
                                                <span className="min-w-0 truncate text-ink-soft">{m.title ?? c.courseName}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                      <p className="mb-1.5 text-micro font-semibold text-ink-soft">{t("courseJournal")}</p>
                                      <div className="space-y-1">
                                        {courseSessions.map((cs) => {
                                          const cm = META[cs.status];
                                          return (
                                            <div key={cs.id} className="flex items-center gap-2 text-note">
                                              <span className={cls("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", cm.chip)}>
                                                <Icon icon={cm.icon} size={11} />
                                              </span>
                                              <span className="shrink-0 font-semibold tabular-nums text-ink">
                                                {formatDate(lang, cs.date, "short")} · {hhmm(new Date(cs.date))}
                                              </span>
                                              <span className="min-w-0 flex-1 truncate text-ink-soft">{cs.title ?? c.courseName}</span>
                                              <span className={cls("shrink-0 rounded-pill px-2 py-0.5 text-micro font-semibold", cm.chip)}>
                                                {t(`status.${cs.status}`)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </BentoCard>
              )}

              {/* Darslar jurnali — filtrlar + oylar bo'yicha */}
              <BentoCard title={t("courseJournal")} count={data?.sessions.length} bodyClassName="px-2 pb-2">
                <div className="mb-2 flex flex-wrap items-center gap-2 px-2">
                  <select
                    value={courseId ?? ""}
                    onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : undefined)}
                    aria-label={t("allCourses")}
                    className={fieldCls}
                  >
                    <option value="">{t("allCourses")}</option>
                    {(coursesQ.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.subjectName}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={range.from ?? ""}
                      aria-label={t("excuseFrom")}
                      onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))}
                      className={cls(fieldCls, "w-36")}
                    />
                    <span className="text-ink-soft">—</span>
                    <input
                      type="date"
                      value={range.to ?? ""}
                      aria-label={t("excuseTo")}
                      onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))}
                      className={cls(fieldCls, "w-36")}
                    />
                  </div>
                  {statusFilter && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter(null)}
                      className={cls(
                        "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-micro font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                        META[statusFilter].chip
                      )}
                    >
                      {t(`status.${statusFilter}`)}
                      <Icon icon={X} size={12} />
                    </button>
                  )}
                </div>

                <AsyncSection
                  isLoading={false}
                  isError={q.isError}
                  isEmpty={!!data && data.sessions.length === 0}
                  emptyIcon={<Icon icon={CalendarCheck} size={22} />}
                  emptyText={t("empty")}
                  onRetry={() => q.refetch()}
                >
                  <div className="space-y-2">
                    {byMonth.map(([month, rows]) => (
                      <div key={month}>
                        <p className="px-2 pb-1 pt-2 text-micro font-semibold text-ink-soft">
                          {monthLabel(month, locale)} · {t("lessonsN", { n: rows.length })}
                        </p>
                        <ul className="divide-y divide-line-soft">
                          {rows.map((s) => {
                            const m = META[s.status];
                            return (
                              <li key={s.id}>
                                <BentoRow
                                  icon={m.icon}
                                  iconTone={m.chip}
                                  title={s.title ?? s.courseName}
                                  sub={`${formatDate(lang, s.date, "short")} · ${hhmm(new Date(s.date))} · ${s.courseName}`}
                                  trailing={
                                    <span className={cls("mr-2 shrink-0 rounded-pill px-2.5 py-0.5 text-micro font-semibold", m.chip)}>
                                      {t(`status.${s.status}`)}
                                    </span>
                                  }
                                />
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </AsyncSection>
              </BentoCard>
            </div>

            {/* O'ng ustun — propusk bilan nima qilish mumkin + kelgusi darslar */}
            <aside className="order-first min-w-0 space-y-3 lg:order-none">
              <MakeupList />
              <ExcuseList />
              {schedule.length > 0 && (
                <BentoCard title={t("upcoming")} bodyClassName="px-2 pb-2">
                  <ul>
                    {schedule.slice(0, 5).map((s) => (
                      <li key={s.key}>
                        <BentoRow
                          icon={CalendarDays}
                          iconTone="bg-brand-soft text-brand-deep"
                          title={s.title ?? s.courseName}
                          sub={`${s.courseName}${s.room ? ` · ${s.room}` : ""}`}
                          right={`${formatDate(lang, s.date, "short")} · ${hhmm(new Date(s.date))}`}
                        />
                      </li>
                    ))}
                  </ul>
                </BentoCard>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
