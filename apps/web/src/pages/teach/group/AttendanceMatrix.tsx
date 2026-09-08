import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, XCircle } from "lucide-react";
import { Card, Icon, Select, Spinner, cls, useToast } from "@meduni/ui";
import { API_URL, apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { ATT_META, ATT_META_LIST, isLowAttendance } from "../../../lib/attendance";
import { useAttendanceMatrix, useMarkByDate, type AttStatus, type TeachGroup } from "../api";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Holat → rang/belgi (medUni 4 holat). Solid rang — matritsa katagi uchun. */
// Holat -> rang/belgi: umumiy xarita (`lib/attendance.ts`). Ilgari bu yerda o'z
// nusxasi bor edi va "Sababli" ikonkasi boshqa ekranlardan farq qilardi.
const STATUS_META = ATT_META_LIST;
const metaOf = (s: AttStatus) => ATT_META[s];

/** Koridor zonasi → matn rangi (raqam neytral, ogohlantirish izohda). */
const ZONE_TEXT: Record<"OK" | "WARN" | "DANGER" | "BLOCKED", string> = {
  OK: "text-ink-soft",
  WARN: "text-amber",
  DANGER: "text-rose",
  BLOCKED: "text-rose",
};

export function AttendanceMatrix({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attMatrix" });
  const locale = useLocale();
  const { show } = useToast();
  const mark = useMarkByDate();

  const [courseId, setCourseId] = useState<number | null>(group.courses[0]?.id ?? null);
  const [pop, setPop] = useState<{ studentId: number; colKey: string; date: string; time: string; top: number; left: number } | null>(null);

  // Sana oralig'i — oxirgi ~8 hafta.
  const { from, to } = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 55);
    return { from: dayKey(start), to: dayKey(now) };
  }, []);

  const q = useAttendanceMatrix(courseId, group.id, from, to);
  const data = q.data;
  const todayKey = data?.todayKey ?? dayKey(new Date());

  const setStatus = (studentId: number, date: string, time: string, status: AttStatus) => {
    setPop(null);
    // startTime shart: bir kunda bir necha dars — har biri o'z sessiyasiga yoziladi.
    mark.mutate(
      { courseId: courseId!, date, startTime: time, groupId: group.id, marks: [{ studentId, status }] },
      { onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn") }
    );
  };

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const wd = locale === "ru" ? ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] : ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
    return { wd: wd[d.getDay()], dm: `${d.getDate()}/${d.getMonth() + 1}` };
  };

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 className="text-note font-bold text-ink">{t("title")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {/* Maxraj ochiq turadi: 25 % limit REJA soatidan hisoblanadi. */}
          {data && (
            <span className="text-micro text-ink-faint">
              {data.plannedHours ? t("plannedHours", { n: data.plannedHours }) : t("noPlannedHours")}
            </span>
          )}
          {group.courses.length > 1 && (
            <Select value={String(courseId ?? "")} onChange={(e) => setCourseId(Number(e.target.value))} className="w-auto">
              {group.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
          {courseId && (
            <a
              href={`${API_URL}/api/v1/teach/courses/${courseId}/attendance-report.xlsx?view=matrix&from=${from}&to=${to}&groupId=${group.id}`}
              className="inline-flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1 text-micro font-semibold text-ink-soft transition-colors hover:bg-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Icon icon={Download} size={13} /> {t("exportXlsx")}
            </a>
          )}
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner size={22} /></div>
      ) : !data || data.columns.length === 0 ? (
        <p className="px-4 py-8 text-center text-note text-ink-soft">{t("noLessons")}</p>
      ) : data.students.length === 0 ? (
        <p className="px-4 py-8 text-center text-note text-ink-soft">{t("noStudents")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[160px] border-b border-r border-line bg-bg px-3 py-2 text-left">
                  <span className="text-micro font-bold text-ink-faint">{t("student")}</span>
                </th>
                <th className="min-w-[62px] border-b border-line bg-bg px-2 py-2 text-center">
                  <span className="text-micro font-bold text-ink-faint">{t("colUnexcused")}</span>
                </th>
                <th className="min-w-[52px] border-b border-r border-line bg-bg px-2 py-2 text-center">
                  <span className="text-micro font-bold text-ink-faint">%</span>
                </th>
                {data.columns.map((col) => {
                  const { wd, dm } = dayLabel(col.date);
                  const isToday = col.date === todayKey;
                  return (
                    <th
                      key={col.key}
                      className={cls("min-w-[46px] border-b border-line px-1 py-1.5", col.cancelled ? "bg-bg opacity-50" : isToday ? "bg-brand-soft" : "bg-bg")}
                      title={[col.time, col.room, `${col.hours} ${t("hours")}`, col.cancelled ? t("cancelledCol") : ""].filter(Boolean).join(" · ")}
                    >
                      <div className="flex flex-col items-center">
                        <span className={cls("text-micro font-bold", isToday ? "text-brand-deep" : "text-ink-faint")}>{wd}</span>
                        <span className={cls("text-micro font-semibold font-data tabular-nums", isToday ? "text-brand-deep" : "text-ink-soft")}>{dm}</span>
                        {/* Dars vaqti — bir kunda bir necha dars ustunini farqlaydi */}
                        <span className={cls("text-micro font-data tabular-nums", isToday ? "text-brand-deep/80" : "text-ink-faint")}>{col.time}</span>
                        {/* Akademik soat — limit shundan hisoblanadi (F1). */}
                        <span className="text-micro text-ink-faint">
                          {col.cancelled ? "—" : `${col.hours}${t("hours").slice(0, 1)}`}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, si) => {
                const rowBg = si % 2 === 0 ? "bg-surface" : "bg-bg/40";
                return (
                  <tr key={s.id} className="transition-colors hover:bg-brand-soft/20">
                    <td className={cls("sticky left-0 z-10 border-b border-r border-line px-3 py-2", rowBg)}>
                      <p className="truncate text-micro font-semibold text-ink">{s.fullName}</p>
                    </td>
                    {/* SOATLI koridor — regulyator raqami (VM №824). Zona
                        rangi IZOHDA: "4 / 18" o'zi yomon xabar emas. */}
                    <td className="border-b border-line px-2 py-2 text-center">
                      <span className={cls("text-micro font-semibold font-data tabular-nums", ZONE_TEXT[s.zone])}>
                        {s.unexcusedHours} / {s.limitHours}
                      </span>
                      {s.zone !== "OK" && (
                        <span className={cls("mt-0.5 block text-micro font-semibold", ZONE_TEXT[s.zone])}>{t(`zone${s.zone}`)}</span>
                      )}
                    </td>
                    <td className="border-b border-r border-line px-2 py-2 text-center">
                      {s.pct !== null && (
                        <span className={cls("text-micro font-bold font-data tabular-nums", isLowAttendance(s.pct) ? "text-rose" : "text-emerald")}>{s.pct}%</span>
                      )}
                    </td>
                    {data.columns.map((col) => {
                      const st = s.cells[col.key];
                      const isFuture = col.date > todayKey;
                      const m = st ? metaOf(st) : null;
                      return (
                        <td key={col.key} className="border-b border-line p-0.5 text-center">
                          <button
                            disabled={isFuture}
                            title={`${s.fullName} · ${col.date} ${col.time}${st ? ` · ${t(`status.${st}`)}` : ""}`}
                            onClick={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setPop(pop?.studentId === s.id && pop?.colKey === col.key ? null : { studentId: s.id, colKey: col.key, date: col.date, time: col.time, top: r.bottom, left: r.left + r.width / 2 });
                            }}
                            className={cls(
                              "mx-auto flex h-8 w-8 items-center justify-center rounded-control text-micro font-bold transition-transform",
                              isFuture ? "cursor-not-allowed border border-dashed border-line opacity-40"
                                : m ? cls(m.solid, "hover:scale-110")
                                : "border border-line text-ink-faint hover:border-brand hover:bg-brand-soft"
                            )}
                          >
                            {m ? m.glyph : isFuture ? "" : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5">
        {STATUS_META.map((m) => (
          <span key={m.key} className="inline-flex items-center gap-1.5">
            <span className={cls("flex h-4 w-4 items-center justify-center rounded text-micro font-bold", m.solid)}>{m.glyph}</span>
            <span className="text-micro font-semibold text-ink-soft">{t(`status.${m.key}`)}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded border border-line text-micro text-ink-faint">—</span>
          <span className="text-micro font-semibold text-ink-soft">{t("unmarked")}</span>
        </span>
      </div>

      {/* Popover — holat tanlash */}
      {pop && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPop(null)} />
          <div
            style={{ position: "fixed", top: pop.top + 6, left: pop.left, transform: "translateX(-50%)" }}
            className="z-50 flex min-w-[160px] flex-col gap-0.5 rounded-card border border-line bg-surface p-1.5 shadow-pop"
          >
            {STATUS_META.map((m) => (
              <button
                key={m.key}
                onClick={() => setStatus(pop.studentId, pop.date, pop.time, m.key)}
                className={cls("flex items-center gap-2.5 rounded-control px-3 py-2 text-left transition-colors", m.hover, m.text)}
              >
                <span className={cls("flex h-5 w-5 items-center justify-center rounded", m.solid)}><Icon icon={m.icon} size={12} /></span>
                <span className="text-micro font-semibold">{t(`status.${m.key}`)}</span>
              </button>
            ))}
            <div className="my-0.5 h-px bg-line" />
            <button onClick={() => setPop(null)} className="flex items-center gap-2.5 rounded-control px-3 py-1.5 text-ink-faint transition-colors hover:bg-bg">
              <Icon icon={XCircle} size={14} /> <span className="text-micro font-semibold">{t("close")}</span>
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
