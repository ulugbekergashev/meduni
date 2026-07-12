import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button, Icon, Modal, Spinner, cls, useToast } from "@meduni/ui";
import { useLocale, pickName } from "../../../lib/useLocale";
import { useAiUsage, useQuotas, useSetQuota, type Quota } from "../api";

function Bar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[11px] text-ink-faint">—</span>;
  const tone = pct >= 100 ? "bg-rose" : pct >= 80 ? "bg-amber" : "bg-brand";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-pill bg-bg"><div className={cls("h-full rounded-pill", tone)} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
      <span className={cls("text-[11.5px] font-semibold tabular-nums", pct >= 100 ? "text-rose" : pct >= 80 ? "text-amber" : "text-ink-soft")}>{pct}%</span>
    </div>
  );
}

function QuotaModal({ quota, onClose }: { quota: Quota; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "ai" });
  const { show } = useToast();
  const save = useSetQuota();
  const [tok, setTok] = useState(String(quota.quota.monthlyTokenLimit));
  const [img, setImg] = useState(String(quota.quota.monthlyImageLimit));
  const [cost, setCost] = useState(String(quota.quota.monthlyCostLimit));

  return (
    <Modal open onClose={onClose} title={t("editQuota")}>
      <p className="mb-3 text-[13px] text-ink-soft">{quota.nameUz} · <span className="text-ink-faint">{t("zeroUnlimited")}</span></p>
      <div className="space-y-3">
        {[{ l: t("tokenLimit"), v: tok, s: setTok }, { l: t("imageLimit"), v: img, s: setImg }, { l: t("costLimit"), v: cost, s: setCost }].map((f) => (
          <div key={f.l}>
            <label className="mb-1 block text-[12.5px] font-semibold text-ink-soft">{f.l}</label>
            <input type="number" min={0} value={f.v} onChange={(e) => f.s(e.target.value)} className="w-full rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={() => save.mutate({ departmentId: quota.departmentId, monthlyTokenLimit: Number(tok), monthlyImageLimit: Number(img), monthlyCostLimit: Number(cost) }, { onSuccess: () => { show(t("saved")); onClose(); } })} disabled={save.isPending}>{t("save")}</Button>
      </div>
    </Modal>
  );
}

const KIND_LABEL: Record<string, string> = { DIGEST: "Konspekt", QUIZ: "Test", CASE: "Keys", SLIDES: "Slaydlar", IMAGE: "Rasmlar", VIDEO: "Video", TTS: "Ovoz", FACTCHECK: "Faktcheck" };

export function AiMonitoringPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "ai" });
  const locale = useLocale();
  const usage = useAiUsage();
  const quotas = useQuotas();
  const [editing, setEditing] = useState<Quota | null>(null);

  if (usage.isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;
  const u = usage.data;

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-[13px] text-ink-soft">{t("subtitle")}</p>

      {/* This month total */}
      {u && (
        <div className="mt-5 rounded-card bg-gradient-to-br from-brand-deep to-brand p-5 text-white shadow-md">
          <div className="flex items-center gap-2"><Icon icon={Sparkles} size={18} className="text-white/90" /><p className="text-[12.5px] font-medium uppercase tracking-wide text-white/80">{t("thisMonth")}</p></div>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            <div><p className="text-[28px] font-bold leading-none tabular-nums">{u.totals.tokens.toLocaleString()}</p><p className="mt-1 text-[12px] text-white/75">{t("tokens")}</p></div>
            <div><p className="text-[28px] font-bold leading-none tabular-nums">{u.totals.images}</p><p className="mt-1 text-[12px] text-white/75">{t("images")}</p></div>
            <div><p className="text-[28px] font-bold leading-none tabular-nums">${u.totals.cost.toFixed(2)}</p><p className="mt-1 text-[12px] text-white/75">{t("cost")}</p></div>
          </div>
        </div>
      )}

      {/* By kind */}
      {u && u.byKind.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-section font-bold text-ink">{t("byKind")}</h2>
          <div className="flex flex-wrap gap-2">
            {u.byKind.map((k) => (
              <div key={k.kind} className="rounded-card border border-line bg-surface px-3 py-2">
                <p className="text-[12px] font-semibold text-ink-soft">{KIND_LABEL[k.kind] ?? k.kind}</p>
                <p className="text-[16px] font-bold tabular-nums text-ink">{k.images > 0 ? `${k.images} 🖼` : k.ttsChars > 0 ? `${k.ttsChars} ✍` : k.tokens.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* By department + quota */}
      <section className="mt-6">
        <h2 className="mb-3 text-section font-bold text-ink">{t("byDept")}</h2>
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-bg text-left text-[11.5px] font-bold uppercase text-ink-faint">
                <th className="px-3 py-2.5">{t("dept")}</th><th className="px-3 py-2.5">{t("tokens")}</th><th className="px-3 py-2.5">{t("images")}</th><th className="px-3 py-2.5">{t("cost")}</th><th className="px-3 py-2.5">{t("quotaUse")}</th><th className="px-3 py-2.5 text-right">{t("quota")}</th>
              </tr>
            </thead>
            <tbody>
              {(quotas.data ?? []).map((qd) => {
                const tokenPct = qd.quota.monthlyTokenLimit > 0 ? Math.round((qd.used.tokens / qd.quota.monthlyTokenLimit) * 100) : null;
                return (
                  <tr key={qd.departmentId} className="border-b border-line last:border-0 hover:bg-bg">
                    <td className="px-3 py-2.5 font-medium text-ink">{pickName(locale, qd.nameUz, qd.nameRu)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-soft">{qd.used.tokens.toLocaleString()}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-soft">{qd.used.images}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-soft">${qd.used.cost.toFixed(2)}</td>
                    <td className="px-3 py-2.5"><Bar pct={tokenPct} /></td>
                    <td className="px-3 py-2.5 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(qd)}>{t("setQuota")}</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editing && <QuotaModal quota={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
