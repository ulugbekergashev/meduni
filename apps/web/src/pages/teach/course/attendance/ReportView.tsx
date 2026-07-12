import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, LayoutGrid, List, Search, Users } from "lucide-react";
import { Card, Icon, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../../../components/AsyncSection";
import { API_URL, useAttendanceReport, type AttReport } from "../../api";
import { STATUS_META, fmtShort, monthRange } from "./meta";

function Matrix({ report }: { report: AttReport }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendance" });
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[150px] border-b border-r border-line bg-surface px-3 py-2 text-left font-bold text-ink-soft">{t("student")}</th>
            {report.sessions.map((s) => (
              <th key={s.id} className="min-w-[46px] border-b border-line bg-surface px-1 py-2 text-center font-bold text-ink-soft" title={s.title ?? ""}>{fmtShort(s.date)}</th>
            ))}
            <th className="min-w-[52px] border-b border-l border-line bg-surface px-2 py-2 text-center font-bold text-ink-soft">{t("absentShort")}</th>
          </tr>
        </thead>
        <tbody>
          {report.students.map((st) => (
            <tr key={st.id} className="hover:bg-bg">
              <td className="sticky left-0 z-10 max-w-[150px] truncate border-b border-r border-line bg-surface px-3 py-1.5 font-medium text-ink" title={st.fullName}>{st.fullName}</td>
              {report.sessions.map((s) => {
                const status = st.cells[s.id];
                return (
                  <td key={s.id} className="border-b border-line p-0.5 text-center">
                    {status ? (
                      <span className={cls("inline-flex h-6 min-w-[26px] items-center justify-center rounded px-1 text-[10px] font-bold", STATUS_META[status].solid)} title={t(`status.${status}`)}>
                        {STATUS_META[status].short}
                      </span>
                    ) : (
                      <span className="text-ink-faint/50">–</span>
                    )}
                  </td>
                );
              })}
              <td className="border-b border-l border-line px-2 py-1.5 text-center font-bold tabular-nums text-rose">{st.absent || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListView({ report, sort }: { report: AttReport; sort: "pct" | "name" }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendance" });
  const rows = useMemo(() => {
    const list = [...report.students];
    list.sort((a, b) => (sort === "name" ? a.fullName.localeCompare(b.fullName) : (a.attendancePct ?? 101) - (b.attendancePct ?? 101)));
    return list;
  }, [report, sort]);

  return (
    <div className="space-y-2">
      {rows.map((s) => {
        const low = s.attendancePct !== null && s.attendancePct < 75;
        return (
          <Card key={s.id} className="flex flex-wrap items-center gap-3">
            <span className="min-w-[130px] flex-1 text-[14px] font-semibold text-ink">{s.fullName}</span>
            <div className="flex flex-wrap gap-2 text-[12.5px]">
              <span className="text-emerald">{t("status.PRESENT")}: <b>{s.present}</b></span>
              <span className="text-rose">{t("status.ABSENT")}: <b>{s.absent}</b></span>
              <span className="text-amber">{t("status.LATE")}: <b>{s.late}</b></span>
              <span className="text-blue">{t("status.EXCUSED")}: <b>{s.excused}</b></span>
            </div>
            <span className={cls("min-w-[52px] text-right text-[15px] font-bold tabular-nums", low ? "text-rose" : "text-ink")}>
              {s.attendancePct !== null ? `${s.attendancePct}%` : "—"}
            </span>
          </Card>
        );
      })}
    </div>
  );
}

export function ReportView({ courseId }: { courseId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendance" });
  const [range, setRange] = useState(monthRange());
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"matrix" | "list">("matrix");
  const [sort, setSort] = useState<"pct" | "name">("pct");

  const q = useAttendanceReport(courseId, { ...range, search });
  const report = q.data;
  const exportUrl = `${API_URL}/api/v1/teach/courses/${courseId}/attendance-report.xlsx?view=${view}&from=${range.from}&to=${range.to}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="rounded-control border border-line px-2 py-2 text-[13px] outline-none focus:border-brand" />
        <span className="text-ink-faint">—</span>
        <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="rounded-control border border-line px-2 py-2 text-[13px] outline-none focus:border-brand" />
        <div className="relative min-w-[150px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchStudent")} className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[13.5px] outline-none focus:border-brand" />
        </div>
        {view === "list" && (
          <select value={sort} onChange={(e) => setSort(e.target.value as "pct" | "name")} className="rounded-control border border-line bg-surface px-2 py-2 text-[13px] outline-none focus:border-brand">
            <option value="pct">{t("sortPct")}</option>
            <option value="name">{t("sortName")}</option>
          </select>
        )}
        <div className="flex overflow-hidden rounded-control border border-line">
          <button onClick={() => setView("matrix")} className={cls("flex items-center gap-1 px-3 py-2 text-[13px] font-medium", view === "matrix" ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg")}><Icon icon={LayoutGrid} size={15} /> {t("matrix")}</button>
          <button onClick={() => setView("list")} className={cls("flex items-center gap-1 px-3 py-2 text-[13px] font-medium", view === "list" ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg")}><Icon icon={List} size={15} /> {t("summary")}</button>
        </div>
        <a href={exportUrl} className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-bg"><Icon icon={Download} size={15} /> Excel</a>
      </div>

      <div className="mt-4">
        {q.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
        ) : (
          <AsyncSection isLoading={false} isError={q.isError} isEmpty={!!report && report.sessions.length === 0} emptyIcon={<Icon icon={Users} size={22} />} emptyText={t("emptyReport")} onRetry={() => q.refetch()}>
            {report && (view === "matrix" ? <Matrix report={report} /> : <ListView report={report} sort={sort} />)}
          </AsyncSection>
        )}
      </div>
    </div>
  );
}
