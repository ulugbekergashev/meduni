import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarRange, CheckCircle2, UserRound, Users2 } from "lucide-react";
import { EmptyState, Icon, Num, cls } from "@meduni/ui";
import { BentoCard, BentoRow, HeaderChip, PageHeader } from "../../../components/bento";
import { AsyncSection } from "../../../components/AsyncSection";
import { SubNav } from "../../../components/SubNav";
import { isLowAttendance } from "../../../lib/attendance";
import { useLocale } from "../../../lib/useLocale";
import { formatDate } from "../../../lib/date";
import { ExcuseInbox } from "../control/ExcuseInbox";
import { StatusBanner, TableCard, type BannerItem } from "../components";
import { useAttendanceControl } from "../api";

/**
 * DAVOMAT NAZORATI — dekanat ekrani (Davomat 2.0 · F5).
 *
 * ⚠️ Bu o'rtacha foizlar galereyasi EMAS (§22 "stat dietasi"). Dekanatga
 * kerak bo'lgan javob bitta: KIM koridordan chiqdi va NIMA QILISH kerak.
 * Shuning uchun sahifa boshida bitta xulosa yuzasi (kartalar emas), keyin
 * ISMLI ro'yxatlar: xavf ro'yxati, guruhlar (belgilanmagan darslar — o'qituvchi
 * qarzi), sabab arizalari va sikllar.
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

const GUEST = "ml-1.5 rounded-pill bg-violet-soft px-1.5 py-0.5 text-micro font-semibold text-violet";

export function AttendanceControlPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "attControl" });
  const locale = useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw === "groups" || raw === "excuses" || raw === "cycles" ? raw : "risk";
  const q = useAttendanceControl();
  const d = q.data;

  const clean = !!d && d.totals.atRisk === 0 && d.totals.unmarkedLessons === 0;
  const items: BannerItem[] = d
    ? [
        ...(d.totals.blocked > 0 ? [{ key: "blocked", text: t("blockedN", { n: d.totals.blocked }), tone: "rose" as const }] : []),
        ...(d.totals.atRisk > 0 ? [{ key: "risk", text: t("atRiskN", { n: d.totals.atRisk }) }] : []),
        ...(d.totals.unmarkedLessons > 0 ? [{ key: "unmarked", text: t("unmarkedN", { n: d.totals.unmarkedLessons }) }] : []),
      ]
    : [];

  return (
    <div className="space-y-3">
      <PageHeader
        className="mb-0"
        title={t("title")}
        subtitle={t("subtitle")}
        right={
          d?.period && (
            <HeaderChip icon={<Icon icon={CalendarRange} size={15} />}>
              {d.period.academicYear} · {t("semesterN", { n: d.period.semester })}
            </HeaderChip>
          )
        }
      />

      <AsyncSection isLoading={q.isLoading} isError={q.isError || (!q.isLoading && !d)} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
        {d && (
          <>
            {/* Xulosa — BITTA yuza. Nol bo'lsa tinch yashil. */}
            <StatusBanner
              tone={clean ? "emerald" : d.totals.blocked > 0 ? "rose" : "amber"}
              headline={clean ? t("allClear") : items[0]?.text}
              items={items.slice(1)}
              aside={
                <>
                  <Num>{d.totals.groups}</Num> {t("groupsWord")} · <Num>{d.totals.students}</Num> {t("studentsWord")}
                </>
              }
            />

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

            <div>
              {tab === "risk" && (
                <BentoCard title={t("tab.risk")} count={d.risk.length} bodyClassName="px-2 pb-3">
                  {d.risk.length === 0 ? (
                    <div className="px-2 py-4">
                      <EmptyState icon={<Icon icon={CheckCircle2} size={20} />} text={t("noRisk")} />
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {d.risk.map((r) => (
                        <li key={`${r.studentId}-${r.courseId}`}>
                          <BentoRow
                            icon={UserRound}
                            iconTone={r.zone === "BLOCKED" || r.zone === "DANGER" ? "bg-rose-soft text-rose" : "bg-amber-soft text-amber"}
                            onClick={() => navigate(`/admin/users/${r.studentId}`)}
                            arrow={false}
                            title={
                              <>
                                {r.studentName}
                                {r.groupName ? <span className="font-normal text-ink-soft"> · {r.groupName}</span> : null}
                                {r.isGuest && <span className={GUEST}>{t("guest")}</span>}
                              </>
                            }
                            sub={`${r.courseName} · ${r.teacherName}`}
                            right={`${r.unexcusedHours} / ${r.limitHours} ${t("hours")}`}
                            trailing={
                              <span className={cls("mr-2 shrink-0 rounded-pill px-2 py-0.5 text-micro font-semibold", ZONE[r.zone])}>
                                {t(`zone.${r.zone}`)}
                              </span>
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </BentoCard>
              )}

              {tab === "groups" && (
                <TableCard title={t("tab.groups")} count={d.groups.length}>
                  {d.groups.length === 0 ? (
                    <div className="px-4 py-6">
                      <EmptyState icon={<Icon icon={Users2} size={20} />} text={t("noGroups")} />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-note">
                        <thead>
                          <tr className="bg-surface-raised text-micro font-semibold text-ink-soft">
                            <th className="px-4 py-2 text-left">{t("colGroup")}</th>
                            <th className="hidden px-2 py-2 text-center sm:table-cell">{t("colStudents")}</th>
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
                              className="cursor-pointer border-t border-line transition-colors hover:bg-surface-raised"
                            >
                              <td className="px-4 py-2.5">
                                <span className="font-semibold text-ink">{g.groupName}</span>
                                <span className="ml-1.5 text-micro text-ink-soft">{g.facultyName}</span>
                              </td>
                              <td className="hidden px-2 py-2.5 text-center sm:table-cell">
                                <Num>{g.studentCount}</Num>
                              </td>
                              <td className={cls("px-2 py-2.5 text-center", g.unmarkedLessons > 0 && "font-semibold text-amber")}>
                                {g.unmarkedLessons > 0 ? <Num>{g.unmarkedLessons}</Num> : "—"}
                              </td>
                              <td className={cls("px-2 py-2.5 text-center", g.atRisk > 0 && "font-semibold text-rose")}>
                                {g.atRisk > 0 ? <Num>{g.atRisk}</Num> : "—"}
                              </td>
                              <td className={cls("px-4 py-2.5 text-right", isLowAttendance(g.attendancePct) && "font-semibold text-rose")}>
                                {g.attendancePct === null ? "—" : <Num>{`${g.attendancePct}%`}</Num>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TableCard>
              )}

              {tab === "excuses" && <ExcuseInbox />}

              {tab === "cycles" && (
                <BentoCard title={t("tab.cycles")} count={d.cycles.length} bodyClassName="px-2 pb-3">
                  {d.cycles.length === 0 ? (
                    <div className="px-2 py-4">
                      <EmptyState icon={<Icon icon={CalendarRange} size={20} />} text={t("noCycles")} />
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {d.cycles.map((c) => (
                        <li key={c.cycleId}>
                          <BentoRow
                            className="flex-wrap"
                            icon={CalendarRange}
                            iconTone="bg-blue-soft text-blue"
                            title={
                              <>
                                {c.courseName}
                                <span className="font-normal text-ink-soft"> · {c.groupName}</span>
                                {c.isGuest && <span className={GUEST}>{t("guest")}</span>}
                              </>
                            }
                            sub={`${c.departmentName} · ${c.facultyName} · ${c.studentCount} ${t("studentsWord")}`}
                            right={`${formatDate(locale, c.startKey, "short")} — ${formatDate(locale, c.endKey, "short")}`}
                            trailing={
                              <span className="mr-2 shrink-0 rounded-pill bg-surface-raised px-2 py-0.5 text-micro font-semibold text-ink-soft">
                                {t(`cycleStatus.${c.status}`)}
                              </span>
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </BentoCard>
              )}
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}
