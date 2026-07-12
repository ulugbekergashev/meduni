import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, NotebookPen } from "lucide-react";
import { Button, Icon, Modal, Spinner, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../../components/AsyncSection";
import { useAttendanceReport, useMarkAttendance, type AttCell, type AttStatus } from "../../api";
import { STATUS_META, STATUSES, fmtShort, monthRange } from "./meta";
import { SessionModal } from "./SessionModal";

interface CellTarget {
  sessionId: number;
  sessionLabel: string;
  studentId: number;
  studentName: string;
  cell: AttCell | undefined;
}

/** Classic journal cell editor: pick a status (default PRESENT) + optional 0-100 grade. */
function CellModal({ courseId, target, onClose }: { courseId: number; target: CellTarget; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "journal" });
  const { show } = useToast();
  const mark = useMarkAttendance(courseId);
  const [status, setStatus] = useState<AttStatus>(target.cell?.status ?? "PRESENT");
  const [grade, setGrade] = useState(target.cell?.grade !== null && target.cell?.grade !== undefined ? String(target.cell.grade) : "");
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    const g = grade.trim() === "" ? null : Number(grade);
    if (g !== null && (!Number.isFinite(g) || g < 0 || g > 100)) {
      setErr(t("gradeRange"));
      return;
    }
    mark.mutate(
      { sessionId: target.sessionId, marks: [{ studentId: target.studentId, status, grade: g }] },
      { onSuccess: () => { show(t("saved")); onClose(); }, onError: () => setErr(t("saveFailed")) }
    );
  };

  return (
    <Modal open onClose={onClose} title={target.studentName} className="max-w-sm">
      <p className="mb-3 text-[12.5px] text-ink-faint">{target.sessionLabel}</p>

      <div className="grid grid-cols-2 gap-1.5">
        {STATUSES.map((s) => {
          const on = status === s;
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cls("rounded-control border px-2 py-2 text-[13px] font-semibold transition-all", on ? meta.solid : `bg-surface ${meta.ring} opacity-60 hover:opacity-100`)}
            >
              {t(`status.${s}`)}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[12.5px] font-semibold text-ink-soft">{t("grade")}</label>
        <input
          type="number"
          min={0}
          max={100}
          value={grade}
          onChange={(e) => { setGrade(e.target.value); setErr(null); }}
          placeholder="0–100"
          autoFocus
          className="w-full rounded-control border border-line px-3 py-2 text-[15px] font-bold outline-none focus:border-brand"
        />
        <p className="mt-1 text-[11.5px] text-ink-faint">{t("gradeHint")}</p>
      </div>

      {err && <p className="mt-2 text-[12.5px] font-medium text-rose">{err}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={mark.isPending}>{t("cancel")}</Button>
        <Button onClick={save} disabled={mark.isPending}>{t("save")}</Button>
      </div>
    </Modal>
  );
}

export function JournalView({ courseId, groupId }: { courseId: number; groupId?: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "journal" });
  const [range, setRange] = useState(monthRange());
  const [target, setTarget] = useState<CellTarget | null>(null);
  const [newSession, setNewSession] = useState(false);

  const q = useAttendanceReport(courseId, { ...range, groupId });
  const report = q.data;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="rounded-control border border-line px-2 py-2 text-[13px] outline-none focus:border-brand" />
        <span className="text-ink-faint">—</span>
        <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="rounded-control border border-line px-2 py-2 text-[13px] outline-none focus:border-brand" />
        <p className="min-w-[160px] flex-1 text-[12.5px] text-ink-faint">{t("hint")}</p>
        <Button onClick={() => setNewSession(true)}><Icon icon={CalendarPlus} size={16} /> {t("newSession")}</Button>
      </div>

      <div className="mt-4">
        {q.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
        ) : (
          <AsyncSection
            isLoading={false}
            isError={q.isError}
            isEmpty={!!report && report.sessions.length === 0}
            emptyIcon={<Icon icon={NotebookPen} size={22} />}
            emptyText={t("empty")}
            onRetry={() => q.refetch()}
          >
            {report && (
              <>
                <div className="overflow-x-auto rounded-card border border-line">
                  <table className="border-collapse text-[12.5px]">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 min-w-[150px] border-b border-r border-line bg-surface px-3 py-2 text-left font-bold text-ink-soft">{t("student")}</th>
                        {report.sessions.map((s) => (
                          <th key={s.id} className="min-w-[52px] border-b border-line bg-surface px-1 py-2 text-center font-bold text-ink-soft" title={s.title ?? ""}>
                            {fmtShort(s.date)}
                          </th>
                        ))}
                        <th className="min-w-[60px] border-b border-l border-line bg-surface px-2 py-2 text-center font-bold text-ink-soft">{t("avg")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.students.map((st) => (
                        <tr key={st.id} className="hover:bg-bg">
                          <td className="sticky left-0 z-10 max-w-[150px] truncate border-b border-r border-line bg-surface px-3 py-1.5 font-medium text-ink" title={st.fullName}>
                            {st.fullName}
                          </td>
                          {report.sessions.map((s) => {
                            const cell = st.cells[s.id];
                            return (
                              <td key={s.id} className="border-b border-line p-0.5 text-center">
                                <button
                                  onClick={() =>
                                    setTarget({
                                      sessionId: s.id,
                                      sessionLabel: `${fmtShort(s.date)}${s.title ? " · " + s.title : ""}`,
                                      studentId: st.id,
                                      studentName: st.fullName,
                                      cell,
                                    })
                                  }
                                  title={cell ? t(`status.${cell.status}`) + (cell.grade !== null ? ` · ${cell.grade}` : "") : t("emptyCell")}
                                  className={cls(
                                    "inline-flex h-8 w-full min-w-[46px] items-center justify-center rounded text-[12px] font-bold transition-transform hover:scale-110",
                                    cell ? STATUS_META[cell.status].solid : "border border-dashed border-line bg-surface text-ink-faint/60"
                                  )}
                                >
                                  {cell ? (cell.grade !== null ? cell.grade : STATUS_META[cell.status].short) : "—"}
                                </button>
                              </td>
                            );
                          })}
                          <td className="border-b border-l border-line px-2 py-1.5 text-center font-bold tabular-nums text-ink">{st.avgGrade ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-ink-soft">
                  {STATUSES.map((s) => (
                    <span key={s} className="flex items-center gap-1">
                      <span className={cls("h-3 w-3 rounded", STATUS_META[s].solid)} /> {t(`status.${s}`)}
                    </span>
                  ))}
                  <span className="text-ink-faint">· {t("legendGrade")}</span>
                </div>
              </>
            )}
          </AsyncSection>
        )}
      </div>

      {target && <CellModal courseId={courseId} target={target} onClose={() => setTarget(null)} />}
      {newSession && <SessionModal courseId={courseId} edit={null} onClose={() => setNewSession(false)} />}
    </div>
  );
}
