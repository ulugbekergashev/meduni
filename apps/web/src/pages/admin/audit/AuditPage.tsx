import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ScrollText, Search } from "lucide-react";
import { Badge, Icon, Input, Modal, Select, Spinner, type BadgeTone } from "@meduni/ui";
import { PageHeader } from "../../../components/bento";
import { AsyncSection } from "../../../components/AsyncSection";
import { TableCard } from "../components";
import { useAudit, type AuditItem } from "../api";

function actionTone(action: string): BadgeTone {
  const a = action.toUpperCase();
  if (/PUBLISH|APPROVE|ACTIVATE/.test(a)) return "emerald";
  if (/DELETE|DEACTIVATE/.test(a)) return "rose";
  if (/UPDATE|MARK|RE_REVIEW|QUOTA|UNLOCK/.test(a)) return "amber";
  return "blue";
}

const pageBtn =
  "flex h-8 w-8 items-center justify-center rounded-full border border-line-raised text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40";

export function AuditPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "audit" });
  const [filters, setFilters] = useState({ actor: "", action: "", from: "", to: "", page: 1 });
  const [detail, setDetail] = useState<AuditItem | null>(null);
  const q = useAudit(filters);
  const data = q.data;

  const patch = (p: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...p, page: p.page ?? 1 }));

  return (
    <div className="space-y-3">
      <PageHeader className="mb-0" title={t("title")} subtitle={t("subtitle")} />

      <TableCard
        toolbar={
          <>
            <div className="relative min-w-0 flex-1 basis-48">
              <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input className="pl-9" value={filters.actor} onChange={(e) => patch({ actor: e.target.value })} placeholder={t("actor")} />
            </div>
            <div className="w-full sm:w-56">
              <Select value={filters.action} onChange={(e) => patch({ action: e.target.value })}>
                <option value="">{t("allActions")}</option>
                {(data?.actions ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Input type="date" className="min-w-0 flex-1" value={filters.from} onChange={(e) => patch({ from: e.target.value })} aria-label="from" />
              <span className="text-ink-faint">—</span>
              <Input type="date" className="min-w-0 flex-1" value={filters.to} onChange={(e) => patch({ to: e.target.value })} aria-label="to" />
            </div>
          </>
        }
        footer={
          data && data.pages > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <button type="button" aria-label="prev" disabled={filters.page <= 1} onClick={() => patch({ page: filters.page - 1 })} className={pageBtn}><Icon icon={ChevronLeft} size={16} /></button>
              <span className="font-data text-note tabular-nums text-ink-soft">{filters.page} / {data.pages}</span>
              <button type="button" aria-label="next" disabled={filters.page >= data.pages} onClick={() => patch({ page: filters.page + 1 })} className={pageBtn}><Icon icon={ChevronRight} size={16} /></button>
            </div>
          ) : undefined
        }
      >
        {q.isLoading ? (
          <div className="flex justify-center py-6"><Spinner size={24} /></div>
        ) : (
          <div className={!data || data.items.length === 0 ? "p-3" : undefined}>
            <AsyncSection isLoading={false} isError={q.isError} isEmpty={!!data && data.items.length === 0} emptyIcon={<Icon icon={ScrollText} size={22} />} emptyText={t("empty")} onRetry={() => q.refetch()}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-note">
                  <thead>
                    <tr className="border-b border-line bg-surface-raised text-left text-micro font-semibold text-ink-soft">
                      <th className="px-4 py-2.5">{t("time")}</th><th className="px-4 py-2.5">{t("who")}</th><th className="px-4 py-2.5">{t("action")}</th><th className="px-4 py-2.5">{t("object")}</th><th className="px-4 py-2.5 text-right">{t("details")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((it) => (
                      <tr key={it.id} className="border-b border-line last:border-0 hover:bg-surface-raised">
                        <td className="whitespace-nowrap px-4 py-2.5 font-data tabular-nums text-ink-soft">{new Date(it.createdAt).toLocaleString("ru-RU")}</td>
                        <td className="px-4 py-2.5"><span className="font-semibold text-ink">{it.actorName}</span> <span className="text-micro text-ink-soft">{it.actorRole}</span></td>
                        <td className="px-4 py-2.5"><Badge tone={actionTone(it.action)}>{it.action}</Badge></td>
                        <td className="px-4 py-2.5 text-ink-2">{it.entity} #{it.entityId}</td>
                        <td className="px-4 py-2.5 text-right">
                          {it.details ? (
                            <button type="button" onClick={() => setDetail(it)} className="rounded-control text-note font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                              {t("view")}
                            </button>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AsyncSection>
          </div>
        )}
      </TableCard>

      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail?.action}>
        <pre className="max-h-[50vh] overflow-auto rounded-control bg-surface-raised p-3 font-data text-note text-ink">{JSON.stringify(detail?.details, null, 2)}</pre>
      </Modal>
    </div>
  );
}
