import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, ClipboardList, Download, Pencil, Search, Trash2 } from "lucide-react";
import { Badge, Button, Icon, Spinner, useToast, type BadgeTone } from "@meduni/ui";
import { AsyncSection } from "../../../../components/AsyncSection";
import { ConfirmDialog } from "../../../../components/ConfirmDialog";
import { useLocale, pickName } from "../../../../lib/useLocale";
import { API_URL, useDeleteSession, useSessions, type SessionRow } from "../../api";
import { fmtDate, monthRange } from "./meta";
import { SessionModal } from "./SessionModal";
import { AttendanceModal } from "./AttendanceModal";

const statusTone: Record<SessionRow["status"], BadgeTone> = { UNMARKED: "slate", PARTIAL: "amber", FULL: "emerald" };

export function SessionsView({ courseId }: { courseId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendance" });
  const locale = useLocale();
  const { show } = useToast();
  const [range, setRange] = useState(monthRange());
  const [search, setSearch] = useState("");
  const q = useSessions(courseId, { ...range, search });
  const del = useDeleteSession(courseId);

  const [editing, setEditing] = useState<SessionRow | null | "new">(null);
  const [marking, setMarking] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<SessionRow | null>(null);

  const sessions = q.data ?? [];
  const exportUrl = `${API_URL}/api/v1/teach/courses/${courseId}/attendance-report.xlsx?view=matrix&from=${range.from}&to=${range.to}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="rounded-control border border-line px-2 py-2 text-[13px] outline-none focus:border-brand" />
        <span className="text-ink-faint">—</span>
        <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="rounded-control border border-line px-2 py-2 text-[13px] outline-none focus:border-brand" />
        <div className="relative min-w-[150px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchSession")} className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[13.5px] outline-none focus:border-brand" />
        </div>
        <a href={exportUrl} className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-bg"><Icon icon={Download} size={15} /> Excel</a>
        <Button onClick={() => setEditing("new")}><Icon icon={CalendarPlus} size={16} /> {t("newSession")}</Button>
      </div>

      <div className="mt-4">
        {q.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
        ) : (
          <AsyncSection isLoading={false} isError={q.isError} isEmpty={sessions.length === 0} emptyIcon={<Icon icon={CalendarPlus} size={22} />} emptyText={t("emptySessions")} onRetry={() => q.refetch()}>
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-line bg-bg text-left text-[12px] font-bold uppercase text-ink-faint">
                    <th className="px-3 py-2.5">{t("date")}</th>
                    <th className="px-3 py-2.5">{t("lessonTitle")}</th>
                    <th className="px-3 py-2.5">{t("room")}</th>
                    <th className="px-3 py-2.5">{t("marked")}</th>
                    <th className="px-3 py-2.5">{t("statusCol")}</th>
                    <th className="px-3 py-2.5 text-right">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0 hover:bg-bg">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">{fmtDate(s.date, locale)}</td>
                      <td className="px-3 py-2.5 text-ink">{s.title ? pickName(locale, s.titleUz ?? s.title, s.titleRu ?? s.title) : <span className="text-ink-faint">—</span>}</td>
                      <td className="px-3 py-2.5 text-ink-soft">{s.room ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums text-ink-soft">{s.markedCount}/{s.rosterSize}</td>
                      <td className="px-3 py-2.5"><Badge tone={statusTone[s.status]}>{t(`sessionStatus.${s.status}`)}</Badge></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setMarking(s.id)} className="inline-flex items-center gap-1 rounded-control bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-brand-deep hover:bg-brand/10">
                            <Icon icon={ClipboardList} size={14} /> {t("mark")}
                          </button>
                          <button onClick={() => setEditing(s)} className="rounded-control p-1.5 text-ink-faint hover:bg-bg hover:text-ink" aria-label={t("edit")}><Icon icon={Pencil} size={15} /></button>
                          <button onClick={() => setConfirmDel(s)} className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose" aria-label={t("delete")}><Icon icon={Trash2} size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncSection>
        )}
      </div>

      {editing !== null && <SessionModal courseId={courseId} edit={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {marking !== null && <AttendanceModal courseId={courseId} sessionId={marking} onClose={() => setMarking(null)} />}
      <ConfirmDialog
        open={confirmDel !== null}
        title={t("deleteTitle")}
        message={t("deleteConfirm")}
        loading={del.isPending}
        onConfirm={() => confirmDel && del.mutate(confirmDel.id, { onSuccess: () => { show(t("deleted")); setConfirmDel(null); } })}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}
