import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ScrollText, Search } from "lucide-react";
import { Badge, Icon, Modal, Spinner, type BadgeTone } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { useAudit, type AuditItem } from "../api";

function actionTone(action: string): BadgeTone {
  const a = action.toUpperCase();
  if (/PUBLISH|APPROVE|ACTIVATE/.test(a)) return "emerald";
  if (/DELETE|DEACTIVATE/.test(a)) return "rose";
  if (/UPDATE|MARK|RE_REVIEW|QUOTA|UNLOCK/.test(a)) return "amber";
  return "blue";
}

export function AuditPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "audit" });
  const [filters, setFilters] = useState({ actor: "", action: "", from: "", to: "", page: 1 });
  const [detail, setDetail] = useState<AuditItem | null>(null);
  const q = useAudit(filters);
  const data = q.data;

  const patch = (p: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...p, page: p.page ?? 1 }));

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-[14px] text-ink-soft">{t("subtitle")}</p>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[150px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={filters.actor} onChange={(e) => patch({ actor: e.target.value })} placeholder={t("actor")} className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[14.5px] outline-none focus:border-brand" />
        </div>
        <select value={filters.action} onChange={(e) => patch({ action: e.target.value })} className="rounded-control border border-line bg-surface px-2 py-2 text-[14px] outline-none focus:border-brand">
          <option value="">{t("allActions")}</option>
          {(data?.actions ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => patch({ from: e.target.value })} className="rounded-control border border-line px-2 py-2 text-[14px] outline-none focus:border-brand" />
        <span className="text-ink-faint">—</span>
        <input type="date" value={filters.to} onChange={(e) => patch({ to: e.target.value })} className="rounded-control border border-line px-2 py-2 text-[14px] outline-none focus:border-brand" />
      </div>

      <div className="mt-4">
        {q.isLoading ? <div className="flex justify-center py-10"><Spinner size={24} /></div> : (
          <AsyncSection isLoading={false} isError={q.isError} isEmpty={!!data && data.items.length === 0} emptyIcon={<Icon icon={ScrollText} size={22} />} emptyText={t("empty")} onRetry={() => q.refetch()}>
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-line bg-bg text-left text-[12.5px] font-bold uppercase text-ink-faint">
                    <th className="px-3 py-2.5">{t("time")}</th><th className="px-3 py-2.5">{t("who")}</th><th className="px-3 py-2.5">{t("action")}</th><th className="px-3 py-2.5">{t("object")}</th><th className="px-3 py-2.5 text-right">{t("details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((it) => (
                    <tr key={it.id} className="border-b border-line last:border-0 hover:bg-bg">
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">{new Date(it.createdAt).toLocaleString("ru-RU")}</td>
                      <td className="px-3 py-2.5"><span className="font-medium text-ink">{it.actorName}</span> <span className="text-[12px] text-ink-faint">{it.actorRole}</span></td>
                      <td className="px-3 py-2.5"><Badge tone={actionTone(it.action)}>{it.action}</Badge></td>
                      <td className="px-3 py-2.5 text-ink-soft">{it.entity} #{it.entityId}</td>
                      <td className="px-3 py-2.5 text-right">{it.details ? <button onClick={() => setDetail(it)} className="text-[13.5px] font-medium text-brand-deep hover:underline">{t("view")}</button> : <span className="text-ink-faint">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.pages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <button disabled={filters.page <= 1} onClick={() => patch({ page: filters.page - 1 })} className="rounded-control border border-line p-1.5 text-ink-soft disabled:opacity-40 hover:bg-bg"><Icon icon={ChevronLeft} size={16} /></button>
                <span className="text-[14px] text-ink-soft">{filters.page} / {data.pages}</span>
                <button disabled={filters.page >= data.pages} onClick={() => patch({ page: filters.page + 1 })} className="rounded-control border border-line p-1.5 text-ink-soft disabled:opacity-40 hover:bg-bg"><Icon icon={ChevronRight} size={16} /></button>
              </div>
            )}
          </AsyncSection>
        )}
      </div>

      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail?.action}>
        <pre className="max-h-[50vh] overflow-auto rounded-control bg-bg p-3 text-[13px] text-ink">{JSON.stringify(detail?.details, null, 2)}</pre>
      </Modal>
    </div>
  );
}
