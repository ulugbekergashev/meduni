import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarRange, CheckCircle2, Users2 } from "lucide-react";
import { Card, Icon, Num, Spinner, cls } from "@meduni/ui";
import { SubNav } from "../../../components/SubNav";
import { isLowAttendance } from "../../../lib/attendance";
import { useLocale } from "../../../lib/useLocale";
import { formatDate } from "../../../lib/date";
import { ExcuseInbox } from "../control/ExcuseInbox";
import { useAttendanceControl } from "../api";

/**
 * DAVOMAT NAZORATI — dekanat ekrani (Davomat 2.0 · F5).
 *
 * ⚠️ Bu o'rtacha foizlar galereyasi EMAS (§22 "stat dietasi"). Dekanatga
 * kerak bo'lgan javob bitta: KIM koridordan chiqdi va NIMA QILISH kerak.
 * Shuning uchun sahifa boshida bitta xulosa QATORI (kartalar emas), keyin
 * ikkita ISMLI ro'yxat: belgilanmagan darslar (o'qituvchining qarzi) va
 * xavf ro'yxati (talabaning holati).
 */
type Tab = "risk" | "groups" | "excuses" | "cycles";
const TABS: { key: Tab; icon: typeof Users2 }[] = [
  { key: "risk", icon: CheckCircle2 },
  { key: "groups", icon: Users2 },
  { key: "excuses", icon: CheckCircle2 },
  { key: "cycles", icon: CalendarRange },
];

const ZONE: Record<string, string> = {
  BLOCKED: "bg-rose text-white",
  DANGER: "bg-rose-soft text-rose",
  WARN: "bg-amber-soft text-amber",
  OK: "bg-emerald-soft text-emerald",
};

export function AttendanceControlPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "attControl" });
  const locale = useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw === "groups" || raw === "excuses" || raw === "cycles" ? raw : "risk";
  const q = useAttendanceControl();
  const d = q.data;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-h1 font-extrabold text-ink">{t("title")}</h1>
        <p className="mt-1 max-w-[70ch] text-note text-ink-dim">{t("subtitle")}</p>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size={24} />
        </div>
      ) : !d ? (
        <p className="py-6 text-center text-note text-rose">{t("loadError")}</p>
      ) : (
        <>
          {/* Xulosa — BITTA qator. Nol bo'lsa yaxshi xabar, karta emas. */}
          <Card className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
            {d.period && (
              <span className="text-micro text-ink-faint">
                {d.period.academicYear} · {t("semesterN", { n: d.period.semester })}
              </span>
            )}
            {d.totals.atRisk === 0 && d.totals.unmarkedLessons === 0 ? (
              <span className="text-note font-semibold text-emerald">{t("allClear")}</span>
            ) : (
              <>
                {d.totals.blocked > 0 && (
                  <span className="text-note font-semibold text-rose">{t("blockedN", { n: d.totals.blocked })}</span>
                )}
                {d.totals.atRisk > 0 && <span className="text-note text-ink">{t("atRiskN", { n: d.totals.atRisk })}</span>}
                {d.totals.unmarkedLessons > 0 && (
                  <span className="text-note text-amber">{t("unmarkedN", { n: d.totals.unmarkedLessons })}</span>
                )}
              </>
            )}
            <span className="ml-auto text-micro text-ink-faint">
              <Num>{d.totals.groups}</Num> {t("groupsWord")} · <Num>{d.totals.students}</Num> {t("studentsWord")}
            </span>
          </Card>

          <SubNav
            title={t("title")}
            activeKey={tab}
            items={TABS.map((x) => ({
              key: x.key,
              label: t(`tab.${x.key}`),
              to: `/admin/attendance?tab=${x.key}`,
              icon: <Icon icon={x.icon} size={16} />,
              badge: x.key === "risk" && d.totals.atRisk > 0 ? d.totals.atRisk : undefined,
            }))}
          />

          {tab === "risk" && (
            <Card className="p-0">
              {d.risk.length === 0 ? (
                <p className="px-4 py-8 text-center text-note text-emerald">{t("noRisk")}</p>
              ) : (
                d.risk.map((r, i) => (
                  <button
                    key={`${r.studentId}-${r.courseId}`}
                    onClick={() => navigate(`/admin/users/${r.studentId}`)}
                    className={cls(
                      "flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
                      i > 0 && "border-t border-line-soft"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-note text-ink">
                        {r.studentName}
                        {r.groupName ? <span className="text-ink-faint"> · {r.groupName}</span> : null}
                        {r.isGuest && <span className="ml-1.5 rounded-pill bg-violet-soft px-1.5 py-0.5 text-micro font-semibold text-violet">{t("guest")}</span>}
                      </p>
                      <p className="truncate text-micro text-ink-faint">
                        {r.courseName} · {r.teacherName}
                      </p>
                    </div>
                    <span className="shrink-0 text-micro text-ink-soft">
                      <Num>{r.unexcusedHours}</Num> / <Num>{r.limitHours}</Num> {t("hours")}
                    </span>
                    <span className={cls("shrink-0 rounded-pill px-2 py-0.5 text-micro font-semibold", ZONE[r.zone])}>{t(`zone.${r.zone}`)}</span>
                  </button>
                ))
              )}
            </Card>
          )}

          {tab === "groups" && (
            <Card className="overflow-x-auto p-0">
              <table className="w-full border-collapse text-note">
                <thead>
                  <tr className="bg-surface-raised text-micro font-bold text-ink-faint">
                    <th className="px-4 py-2 text-left">{t("colGroup")}</th>
                    <th className="px-2 py-2 text-center">{t("colStudents")}</th>
                    <th className="px-2 py-2 text-center">{t("colUnmarked")}</th>
                    <th className="px-2 py-2 text-center">{t("colAtRisk")}</th>
                    <th className="px-4 py-2 text-right">{t("colPct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.groups.map((g) => (
                    <tr
                      key={g.groupId}
                      onClick={() => navigate(`/admin/groups/${g.groupId}`)}
                      className="cursor-pointer border-t border-line transition-colors hover:bg-bg"
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-ink">{g.groupName}</span>
                        <span className="ml-1.5 text-micro text-ink-faint">{g.facultyName}</span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <Num>{g.studentCount}</Num>
                      </td>
                      <td className={cls("px-2 py-2.5 text-center", g.unmarkedLessons > 0 && "font-semibold text-amber")}>
                        {g.unmarkedLessons > 0 ? <Num>{g.unmarkedLessons}</Num> : "—"}
                      </td>
                      <td className={cls("px-2 py-2.5 text-center", g.atRisk > 0 && "font-semibold text-rose")}>
                        {g.atRisk > 0 ? <Num>{g.atRisk}</Num> : "—"}
                      </td>
                      <td className={cls("px-4 py-2.5 text-right", isLowAttendance(g.attendancePct) && "font-bold text-rose")}>
                        {g.attendancePct === null ? "—" : <Num>{`${g.attendancePct}%`}</Num>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {tab === "excuses" && <ExcuseInbox />}

          {tab === "cycles" && (
            <Card className="p-0">
              {d.cycles.length === 0 ? (
                <p className="px-4 py-8 text-center text-note text-ink-soft">{t("noCycles")}</p>
              ) : (
                d.cycles.map((c, i) => (
                  <div key={c.cycleId} className={cls("flex flex-wrap items-center gap-2 px-4 py-3", i > 0 && "border-t border-line-soft")}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-note text-ink">
                        {c.courseName}
                        <span className="text-ink-faint"> · {c.groupName}</span>
                        {c.isGuest && <span className="ml-1.5 rounded-pill bg-violet-soft px-1.5 py-0.5 text-micro font-semibold text-violet">{t("guest")}</span>}
                      </p>
                      <p className="truncate text-micro text-ink-faint">
                        {c.departmentName} · {c.facultyName} · <Num>{c.studentCount}</Num> {t("studentsWord")}
                      </p>
                    </div>
                    <span className="shrink-0 text-micro text-ink-soft">
                      <Num>{formatDate(locale, c.startKey, "short")}</Num> — <Num>{formatDate(locale, c.endKey, "short")}</Num>
                    </span>
                    <span className="shrink-0 rounded-pill bg-bg px-2 py-0.5 text-micro font-semibold text-ink-soft">{t(`cycleStatus.${c.status}`)}</span>
                  </div>
                ))
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
