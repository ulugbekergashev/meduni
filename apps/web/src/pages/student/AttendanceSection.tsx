import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { AlertTriangle, BookOpen, CalendarCheck, CalendarDays, ChevronDown, ShieldAlert, X } from "lucide-react";
import { Card, Icon, LegendRow, MiniBars, Spinner, StackedBar, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { ATT_META as META, isLowAttendance } from "../../lib/attendance";
import { useMyAttendance, useMyCourses, useMySchedule, type AttStatus, type AttendanceLimit } from "./api";
import { CheckInCard } from "./CheckInCard";
import { ExcuseList, MakeupList } from "./AbsenceActions";

/** Zona → ohang. Ogohlantiruvchi rang RAQAMDA emas, IZOHDA (dizayn qoidasi):
 *  "6 soat" — o'z-o'zidan yomon xabar emas, yomoni — "limitgacha 1 dars qoldi". */
const ZONE_TONE: Record<AttendanceLimit["zone"], { bar: string; cap: string; pill: string }> = {
  OK: { bar: "bg-emerald", cap: "text-ink-faint", pill: "" },
  WARN: { bar: "bg-amber", cap: "text-amber", pill: "bg-amber-soft text-amber" },
  DANGER: { bar: "bg-rose", cap: "text-rose", pill: "bg-rose-soft text-rose" },
  BLOCKED: { bar: "bg-rose", cap: "text-rose", pill: "bg-rose text-white" },
};

/** Fan bo'yicha SOATLI holat: sababsiz soat / limit + qolgan soat.
 *  ⚠️ Har chiziq tagida u NIMANING ulushi ekani yozilgan (dizayn qoidasi):
 *  yolg'iz "13 %" hech narsa anglatmaydi, "sababsiz 6 / 12 soat" — anglatadi. */
function CorridorRow({ name, limit, first }: { name: string; limit: AttendanceLimit; first: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const tone = ZONE_TONE[limit.zone];
  const known = limit.limitHours > 0;
  const fill = known ? Math.min(100, Math.round((limit.unexcusedHours / limit.limitHours) * 100)) : 0;
  return (
    <div className={cls("flex items-start gap-3 px-5 py-3", !first && "border-t border-line-soft")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-note text-ink">{name}</p>
        {/* 0 % da chiziq CHIZILMAYDI — ingichka qoldiq "biroz bor" deb o'qiladi. */}
        {known && fill > 0 && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-pill bg-line-soft">
            <div className={cls("h-full rounded-pill", tone.bar)} style={{ width: `${fill}%` }} />
          </div>
        )}
        <p className={cls("mt-1 text-micro", tone.cap)}>
          {known ? t("unexcusedOf", { h: limit.unexcusedHours, limit: limit.limitHours }) : t("noPlannedHours")}
        </p>
      </div>
      {known && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {limit.zone !== "OK" && (
            <span className={cls("rounded-pill px-2 py-0.5 text-micro font-semibold", tone.pill)}>{t(`zone${limit.zone}`)}</span>
          )}
          <span className="text-micro text-ink-faint">{t("remainingHours", { n: limit.remainingHours })}</span>
        </div>
      )}
    </div>
  );
}

const MONTHS_UZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const MONTHS_RU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

/** Dars vaqti "HH:MM" — sessiya/dars sanasidan (bir kunda bir necha dars bo'lishi mumkin). */
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

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
      {/* FaceID davomat — vaqt oynasi ochiq dars bo'lsagina ko'rinadi */}
      <motion.div variants={itemVariants}>
        <CheckInCard />
      </motion.div>

      {/* KORIDOR — fanlar bo'yicha SOATLI holat. Bu asosiy blok: nizom davomatni
          darsda emas, akademik soatda hisoblaydi va uning OQIBATI bor. Umumiy
          foiz pastda, ma'lumot sifatida qoladi. */}
      {corridor.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
              <Icon icon={ShieldAlert} size={15} className="text-ink-faint" />
              <p className="text-note font-bold text-ink-soft">{t("corridorTitle")}</p>
            </div>
            <div>
              {corridor.map((c, i) => (
                <CorridorRow key={c.courseId} name={c.courseName} limit={c.limit!} first={i === 0} />
              ))}
            </div>
            {worst && worst.limit!.zone !== "OK" && (
              <p className="border-t border-line-soft px-5 py-3 text-micro text-ink-faint">
                {worst.limit!.zone === "BLOCKED"
                  ? t("zoneBlockedHint")
                  : t("corridorHint", { pct: Math.round((worst.limit!.limitHours / Math.max(1, worst.limit!.plannedHours)) * 100) })}
              </p>
            )}
          </Card>
        </motion.div>
      )}

      {/* PROPUSK BILAN NIMA QILISH MUMKIN — koridordan keyin darrov:
          qarzlar (otrabotka) va spravka arizalari. */}
      <motion.div variants={itemVariants}>
        <MakeupList />
      </motion.div>
      <motion.div variants={itemVariants}>
        <ExcuseList />
      </motion.div>

      {/* Hero: umumiy % + taqsimot + oylik trend */}
      {st && (
        <motion.div variants={itemVariants}>
        <Card className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] overflow-hidden relative">
          <div className="relative z-10">
            <p className="text-note font-bold text-ink-soft">{t("overallShort")}</p>
            <p className={cls("mt-1 text-stat font-bold leading-none tabular-nums", low ? "text-rose" : "text-ink")}>
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
                <p className="mb-2 text-note font-bold text-ink-soft">{t("trend")}</p>
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
            <p className="text-note font-bold text-ink-soft">{t("byCourse")}</p>
          </div>
          <table className="w-full min-w-0 border-collapse sm:min-w-[560px]">
            <thead>
              <tr className="bg-surface-raised text-note font-bold text-ink-faint">
                <th className="px-4 py-2 text-left">{t("colSubject")}</th>
                <th className="hidden px-2 py-2 text-center sm:table-cell">{t("colTotal")}</th>
                <th className="hidden px-2 py-2 text-center sm:table-cell">{t("present")}</th>
                <th className="hidden px-2 py-2 text-center sm:table-cell">{t("late")}</th>
                <th className="hidden px-2 py-2 text-center sm:table-cell">{t("excused")}</th>
                <th className="px-2 py-2 text-center text-rose">{t("colMissed")}</th>
                <th className="px-4 py-2 text-right">{t("colPct")}</th>
              </tr>
            </thead>
            <tbody>
              {data.byCourse.map((c) => {
                const missed = missedByCourse.get(c.courseName) ?? [];
                const courseSessions = (data?.sessions ?? []).filter((x) => x.courseName === c.courseName);
                const open = expanded === c.courseId;
                const lowRow = isLowAttendance(c.pct);
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
                      <td className="hidden px-2 py-2.5 text-center font-data tabular-nums text-ink-soft sm:table-cell">{c.marked}</td>
                      <td className="hidden px-2 py-2.5 text-center font-semibold font-data tabular-nums text-emerald sm:table-cell">{c.present}</td>
                      <td className="hidden px-2 py-2.5 text-center font-semibold font-data tabular-nums text-amber sm:table-cell">{c.late}</td>
                      <td className="hidden px-2 py-2.5 text-center font-semibold font-data tabular-nums text-blue sm:table-cell">{c.excused}</td>
                      <td className="px-2 py-2.5 text-center text-body font-bold font-data tabular-nums text-rose">{c.absent}</td>
                      <td className={cls("px-4 py-2.5 text-right text-body font-bold font-data tabular-nums", lowRow ? "text-rose" : "text-ink")}>
                        {c.pct !== null ? `${c.pct}%` : "—"}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-line bg-surface-raised">
                        <td colSpan={7} className="px-4 py-3">
                          {missed.length > 0 && (
                            <>
                              <p className="mb-1.5 text-note font-bold text-rose">
                                {t("missedSection")}
                              </p>
                              <div className="mb-3 space-y-1">
                                {missed.map((m) => (
                                  <div key={m.id} className="flex items-center gap-2 text-note">
                                    <Icon icon={X} size={12} className="shrink-0 text-rose" />
                                    <span className="shrink-0 font-semibold font-data tabular-nums text-ink">
                                      {formatDate(locale === "ru" ? "ru" : "uz", m.date, "short")} · {hhmm(new Date(m.date))}
                                    </span>
                                    <span className="min-w-0 truncate text-ink-soft">{m.title ?? c.courseName}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                          <p className="mb-1.5 text-note font-bold text-ink-faint">
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
                                  <span className="shrink-0 font-semibold font-data tabular-nums text-ink">
                                    {formatDate(locale === "ru" ? "ru" : "uz", cs.date, "short")} · {hhmm(new Date(cs.date))}
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
            <p className="text-note font-bold text-ink-soft">{t("upcoming")}</p>
          </div>
          <div className="divide-y divide-line">
            {schedule.slice(0, 5).map((s) => (
              <div key={s.key} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-raised">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-ink">{s.title ?? s.courseName}</p>
                  <p className="truncate text-note text-ink-faint">
                    {s.courseName}
                    {s.room ? ` · ${s.room}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-pill bg-brand-soft px-2.5 py-1 text-note font-semibold text-brand-tint">
                  {formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")} · {hhmm(new Date(s.date))}
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
          className="rounded-control border border-line bg-surface px-3 py-2 text-body font-medium outline-none transition-colors focus:border-brand"
        >
          <option value="">{t("allCourses")}</option>
          {(coursesQ.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.subjectName}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 bg-surface border border-line rounded-control p-0.5">
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
                <p className="mb-2 text-note font-bold text-ink-faint ml-1">
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
                            {formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")} · {hhmm(new Date(s.date))} · {s.courseName}
                          </p>
                        </div>
                        <span className={cls("shrink-0 rounded-pill px-3 py-1 text-note font-semibold border border-transparent", m.chip)}>
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
