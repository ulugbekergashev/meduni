import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { AlertTriangle, BookOpen, CalendarCheck, CalendarDays, Check, ChevronDown, Clock, Minus, X } from "lucide-react";
import { Card, Icon, LegendRow, MiniBars, Spinner, StackedBar, cls } from "@meduni/ui";
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

/** Talaba davomati — alohida sahifada ham, profil tabida ham ishlatiladi. */
export function AttendanceSection() {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const locale = useLocale();
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<AttStatus | null>(null);

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
    return m;
  }, [data]);

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

  if (q.isLoading) {
    return (
      <div className="mt-4 flex justify-center">
        <Spinner size={26} />
      </div>
    );
  }

  const st = data?.stats;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
      {/* Hero: umumiy % + taqsimot + oylik trend */}
      {st && (
        <motion.div variants={itemVariants}>
        <Card className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] overflow-hidden relative">
          {/* Subtle glow background */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand-soft rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <p className="text-note font-bold uppercase tracking-wide text-ink-soft">{t("overallPct")}</p>
            <p className={cls("mt-1 text-[44px] font-bold leading-none tabular-nums", low ? "text-rose" : "text-brand-tint")}>
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
              {/* Bosiladigan legenda — ro'yxatni holat bo'yicha filtrlaydi */}
              <div className="mt-3 space-y-1">
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
                  onClick={() => setStatusFilter(null)}
                  className="mt-2 text-note font-semibold text-brand-tint hover:underline"
                >
                  {t("clearFilter")}
                </button>
              )}
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

          </div>
        </Card>
        </motion.div>
      )}

      {/* Low-attendance notice — informative, not scary */}
      {low && (
        <motion.div variants={itemVariants}>
          <div className="flex items-start gap-3 rounded-card border border-amber bg-amber-soft p-4 text-body text-amber">
            <Icon icon={AlertTriangle} size={18} className="mt-0.5 shrink-0" />
            <p className="font-medium">{t("lowWarning", { pct })}</p>
          </div>
        </motion.div>
      )}

      {/* FANLAR BO'YICHA — jami/keldi/kechikdi/sababli/QOLDIRDI + davomat % */}
      {data && data.byCourse.length > 0 && (
        <motion.div variants={itemVariants}>
        <Card className="overflow-x-auto p-0">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5 bg-surface">
            <Icon icon={BookOpen} size={15} className="text-ink-faint" />
            <p className="text-note font-bold uppercase tracking-wide text-ink-soft">{t("byCourse")}</p>
          </div>
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="bg-surface-raised text-note font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2 text-left">{t("colSubject")}</th>
                <th className="px-2 py-2 text-center">{t("colTotal")}</th>
                <th className="px-2 py-2 text-center">{t("present")}</th>
                <th className="px-2 py-2 text-center">{t("late")}</th>
                <th className="px-2 py-2 text-center">{t("excused")}</th>
                <th className="px-2 py-2 text-center text-rose">{t("colMissed")}</th>
                <th className="px-4 py-2 text-right">{t("colPct")}</th>
              </tr>
            </thead>
            <tbody>
              {data.byCourse.map((c) => {
                const missed = missedByCourse.get(c.courseName) ?? [];
                const courseSessions = (data?.sessions ?? []).filter((x) => x.courseName === c.courseName);
                const open = expanded === c.courseId;
                const lowRow = c.pct !== null && c.pct < 75;
                return (
                  <Fragment key={c.courseId}>
                    <tr
                      onClick={() => setExpanded(open ? null : c.courseId)}
                      className="cursor-pointer border-t border-line text-body transition-colors hover:bg-surface-raised" 
                    >
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 font-semibold text-ink">
                          <Icon
                            icon={ChevronDown}
                            size={14}
                            className={cls("text-ink-faint transition-transform", !open && "-rotate-90")}
                          />
                          {c.courseName}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums text-ink-soft">{c.marked}</td>
                      <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-emerald">{c.present}</td>
                      <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-amber">{c.late}</td>
                      <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-blue">{c.excused}</td>
                      <td className="px-2 py-2.5 text-center text-[16px] font-bold tabular-nums text-rose">{c.absent}</td>
                      <td className={cls("px-4 py-2.5 text-right text-[16px] font-bold tabular-nums", lowRow ? "text-rose" : "text-ink")}>
                        {c.pct !== null ? `${c.pct}%` : "—"}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-line bg-surface-raised">
                        <td colSpan={7} className="px-4 py-3">
                          {missed.length > 0 && (
                            <>
                              <p className="mb-1.5 text-note font-bold uppercase tracking-wide text-rose">
                                {t("missedSection")}
                              </p>
                              <div className="mb-3 space-y-1">
                                {missed.map((m) => (
                                  <div key={m.id} className="flex items-center gap-2 text-note">
                                    <Icon icon={X} size={12} className="shrink-0 text-rose" />
                                    <span className="shrink-0 font-semibold tabular-nums text-ink">
                                      {formatDate(locale === "ru" ? "ru" : "uz", m.date, "short")}
                                    </span>
                                    <span className="min-w-0 truncate text-ink-soft">{m.title ?? c.courseName}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                          <p className="mb-1.5 text-note font-bold uppercase tracking-wide text-ink-faint">
                            {t("courseJournal")}
                          </p>
                          <div className="space-y-1">
                            {courseSessions.map((cs) => {
                              const cm = META[cs.status];
                              return (
                                <div key={cs.id} className="flex items-center gap-2 text-note">
                                  <span className={cls("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", cm.chip)}>
                                    <Icon icon={cm.icon} size={11} />
                                  </span>
                                  <span className="shrink-0 font-semibold tabular-nums text-ink">
                                    {formatDate(locale === "ru" ? "ru" : "uz", cs.date, "short")}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-ink-soft">{cs.title ?? c.courseName}</span>
                                  <span className={cls("shrink-0 rounded-pill px-2 py-0.5 text-note font-semibold", cm.chip)}>
                                    {t(`status.${cs.status}`)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
        </motion.div>
      )}

      {/* Kelgusi darslar */}
      {schedule.length > 0 && (
        <motion.div variants={itemVariants}>
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5 bg-surface">
            <Icon icon={CalendarDays} size={15} className="text-ink-faint" />
            <p className="text-note font-bold uppercase tracking-wide text-ink-soft">{t("upcoming")}</p>
          </div>
          <div className="divide-y divide-line">
            {schedule.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-raised">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-ink">{s.title ?? s.courseName}</p>
                  <p className="truncate text-note text-ink-faint">
                    {s.courseName}
                    {s.room ? ` · ${s.room}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-pill bg-brand-soft px-2.5 py-1 text-note font-semibold text-brand-tint">
                  {formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")}
                </span>
              </div>
            ))}
          </div>
        </Card>
        </motion.div>
      )}

      {/* Filtrlar */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3 pt-2">
        <select
          value={courseId ?? ""}
          onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-control border border-line bg-surface px-3 py-2 text-body font-medium outline-none transition-colors focus:border-brand shadow-sm"
        >
          <option value="">{t("allCourses")}</option>
          {(coursesQ.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.subjectName}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 bg-surface border border-line rounded-control p-0.5 shadow-sm">
          <input
            type="date"
            value={range.from ?? ""}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))}
            className="rounded-control border-none px-2.5 py-1.5 text-body outline-none bg-transparent"
          />
          <span className="text-ink-faint">—</span>
          <input
            type="date"
            value={range.to ?? ""}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))}
            className="rounded-control border-none px-2.5 py-1.5 text-body outline-none bg-transparent"
          />
        </div>
      </motion.div>

      {/* Darslar ro'yxati — oylar bo'yicha */}
      <motion.div variants={itemVariants}>
        <AsyncSection
          isLoading={false}
          isError={q.isError}
          isEmpty={!!data && data.sessions.length === 0}
          emptyIcon={<Icon icon={CalendarCheck} size={22} />}
          emptyText={t("empty")}
          onRetry={() => q.refetch()}
        >
          <div className="space-y-3">
            {byMonth.map(([month, rows]) => (
              <div key={month}>
                <p className="mb-2 text-note font-bold uppercase tracking-wide text-ink-faint ml-1">
                  {monthLabel(month, locale)} · {t("lessonsN", { n: rows.length })}
                </p>
                <Card className="divide-y divide-line p-0">
                  {rows.map((s) => {
                    const m = META[s.status];
                    return (
                      <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-raised">
                        <div className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", m.chip)}>
                          <Icon icon={m.icon} size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-semibold text-ink">{s.title ?? s.courseName}</p>
                          <p className="truncate text-note text-ink-soft mt-0.5">
                            {formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")} · {s.courseName}
                          </p>
                        </div>
                        <span className={cls("shrink-0 rounded-pill px-3 py-1 text-note font-semibold shadow-sm border border-transparent", m.chip)}>
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
      </motion.div>
    </motion.div>
  );
}
