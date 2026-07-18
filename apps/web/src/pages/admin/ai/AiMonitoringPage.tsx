import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Coins, Image as ImageIcon, Mic, Sparkles } from "lucide-react";
import { Button, Card, Icon, MiniBars, Modal, Spinner, cls, useToast } from "@meduni/ui";
import { useLocale } from "../../../lib/useLocale";
import { formatDate } from "../../../lib/date";
import { useAiUsage, useSetQuota, type AiUsage } from "../api";

type DeptRow = AiUsage["byDept"][number];

const KIND_LABEL: Record<string, string> = {
  DIGEST: "Konspekt", QUIZ: "Test", CASE: "Keys", SLIDES: "Slaydlar",
  IMAGE: "Rasmlar", VIDEO: "Video", TTS: "Ovoz", FACTCHECK: "Faktcheck",
};
function modelLabel(m: string): string {
  if (m.includes("image")) return "Rasm (Nano Banana)";
  if (m.includes("tts")) return "Ovoz (TTS)";
  if (m.includes("lite")) return "Flash-Lite";
  if (m.includes("flash")) return "Flash";
  if (m.includes("pro")) return "Pro";
  return m;
}
const money = (n: number) => "$" + n.toFixed(n < 1 ? 3 : 2);

/** Proportional rank row: label + bar (share of max) + right-aligned value. */
function RankRow({ label, value, max, display, color = "var(--brand)" }: { label: string; value: number; max: number; display: string; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-40 shrink-0 truncate text-body text-ink">{label}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-bg">
        <span className="block h-full rounded-pill transition-all" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="w-20 shrink-0 text-right text-[14px] font-bold tabular-nums text-ink">{display}</span>
    </div>
  );
}

function QuotaBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[12px] text-ink-faint">—</span>;
  const tone = pct >= 100 ? "bg-rose" : pct >= 80 ? "bg-amber" : "bg-brand";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-pill bg-bg"><div className={cls("h-full rounded-pill", tone)} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
      <span className={cls("w-9 text-[12.5px] font-semibold tabular-nums", pct >= 100 ? "text-rose" : pct >= 80 ? "text-amber" : "text-ink-soft")}>{pct}%</span>
    </div>
  );
}

function QuotaModal({ dept, onClose }: { dept: DeptRow; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "ai" });
  const { show } = useToast();
  const save = useSetQuota();
  const [tok, setTok] = useState(String(dept.quota?.token ?? 0));
  const [img, setImg] = useState(String(dept.quota?.image ?? 0));
  const [cost, setCost] = useState(String(dept.quota?.cost ?? 0));

  return (
    <Modal open onClose={onClose} title={t("editQuota")}>
      <p className="mb-3 text-body text-ink-soft">{dept.name} · <span className="text-ink-faint">{t("zeroUnlimited")}</span></p>
      <div className="space-y-3">
        {[{ l: t("tokenLimit"), v: tok, s: setTok }, { l: t("imageLimit"), v: img, s: setImg }, { l: t("costLimit"), v: cost, s: setCost }].map((f) => (
          <div key={f.l}>
            <label className="mb-1 block text-[13.5px] font-semibold text-ink-soft">{f.l}</label>
            <input type="number" min={0} value={f.v} onChange={(e) => f.s(e.target.value)} className="w-full rounded-control border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-brand" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={() => save.mutate({ departmentId: dept.departmentId, monthlyTokenLimit: Number(tok), monthlyImageLimit: Number(img), monthlyCostLimit: Number(cost) }, { onSuccess: () => { show(t("saved")); onClose(); } })} disabled={save.isPending}>{t("save")}</Button>
      </div>
    </Modal>
  );
}

function HeroMetric({ icon, value, label }: { icon: typeof Coins; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-white/15"><Icon icon={icon} size={20} /></div>
      <div>
        <p className="text-[26px] font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1 text-[13.5px] font-medium text-white/70">{label}</p>
      </div>
    </div>
  );
}

export function AiMonitoringPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "ai" });
  const locale = useLocale();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const usage = useAiUsage(month);
  const [editing, setEditing] = useState<DeptRow | null>(null);
  const u = usage.data;

  const maxKindCost = Math.max(0, ...(u?.byKind ?? []).map((k) => k.cost));
  const maxModelCost = Math.max(0, ...(u?.byModel ?? []).map((m) => m.cost));
  const maxUserCost = Math.max(0, ...(u?.byUser ?? []).map((x) => x.cost));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
          <p className="mt-1 text-body text-ink-soft">{t("subtitle")}</p>
        </div>
        <input
          type="month"
          value={month}
          max={new Date().toISOString().slice(0, 7)}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-control border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-brand"
        />
      </div>

      {usage.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : usage.isError || !u ? (
        <Card className="mt-5"><p className="py-6 text-center text-body text-rose">{t("error")}</p></Card>
      ) : (
        <>
          {/* Hero totals */}
          <div className="mt-5 rounded-card bg-gradient-to-br from-brand-deep to-brand p-6 text-white shadow-card">
            <div className="flex items-center gap-2"><Icon icon={Sparkles} size={16} className="text-white/90" /><p className="text-[13.5px] font-medium uppercase tracking-wide text-white/75">{t("thisMonth")}</p></div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <HeroMetric icon={Coins} value={u.totals.tokens.toLocaleString()} label={t("tokens")} />
              <HeroMetric icon={ImageIcon} value={String(u.totals.images)} label={t("images")} />
              <HeroMetric icon={Mic} value={u.totals.ttsChars.toLocaleString()} label={t("ttsChars")} />
              <HeroMetric icon={Sparkles} value={money(u.totals.cost)} label={t("cost")} />
            </div>
          </div>

          {/* Daily timeline */}
          <Card className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-section font-bold text-ink">{t("timeline")}</h2>
              <span className="text-note text-ink-faint">{t("timelineHint")}</span>
            </div>
            {u.byDay.some((d) => d.tokens > 0) ? (
              <MiniBars
                height={128}
                data={u.byDay.map((d) => ({
                  label: d.day,
                  value: d.tokens,
                  tip: `${formatDate(locale === "ru" ? "ru" : "uz", d.day, "short")} · ${d.tokens.toLocaleString()} tok · ${money(d.cost)}`,
                }))}
              />
            ) : (
              <p className="py-8 text-center text-body text-ink-faint">{t("empty")}</p>
            )}
          </Card>

          {/* Cost by kind + by model */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-2 text-section font-bold text-ink">{t("byKind")}</h2>
              {u.byKind.length ? (
                <div>{u.byKind.map((k) => (
                  <RankRow key={k.kind} label={KIND_LABEL[k.kind] ?? k.kind} value={k.cost} max={maxKindCost} display={money(k.cost)} />
                ))}</div>
              ) : <p className="py-6 text-center text-body text-ink-faint">{t("empty")}</p>}
            </Card>
            <Card>
              <h2 className="mb-2 text-section font-bold text-ink">{t("byModel")}</h2>
              {u.byModel.length ? (
                <div>{u.byModel.map((m) => (
                  <RankRow key={m.model} label={modelLabel(m.model)} value={m.cost} max={maxModelCost} display={money(m.cost)} color="var(--blue)" />
                ))}</div>
              ) : <p className="py-6 text-center text-body text-ink-faint">{t("empty")}</p>}
            </Card>
          </div>

          {/* Top teachers */}
          {u.byUser.length > 0 && (
            <Card className="mt-4">
              <h2 className="mb-2 text-section font-bold text-ink">{t("topTeachers")}</h2>
              <div>{u.byUser.map((x) => (
                <RankRow key={x.userId} label={x.name} value={x.cost} max={maxUserCost} display={money(x.cost)} color="var(--violet)" />
              ))}</div>
            </Card>
          )}

          {/* By department + quota */}
          <section className="mt-6">
            <h2 className="mb-3 text-section font-bold text-ink">{t("byDept")}</h2>
            {u.byDept.length ? (
              <div className="overflow-x-auto rounded-card border border-line shadow-card">
                <table className="w-full border-collapse text-body">
                  <thead>
                    <tr className="border-b border-line bg-bg text-left text-[12.5px] font-bold uppercase text-ink-faint">
                      <th className="px-4 py-3">{t("dept")}</th><th className="px-4 py-3">{t("cost")}</th>
                      <th className="px-4 py-3">{t("tokenQuota")}</th><th className="px-4 py-3">{t("imageQuota")}</th><th className="px-4 py-3">{t("costQuota")}</th>
                      <th className="px-4 py-3 text-right">{t("quota")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.byDept.map((d) => (
                      <tr key={d.departmentId} className="border-b border-line last:border-0 hover:bg-bg">
                        <td className="px-4 py-3 font-medium text-ink">{d.name}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-ink">{money(d.cost)}</td>
                        <td className="px-4 py-3"><QuotaBar pct={d.tokenPct} /></td>
                        <td className="px-4 py-3"><QuotaBar pct={d.imagePct} /></td>
                        <td className="px-4 py-3"><QuotaBar pct={d.costPct} /></td>
                        <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(d)}>{t("setQuota")}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Card><p className="py-6 text-center text-body text-ink-faint">{t("empty")}</p></Card>}
          </section>
        </>
      )}

      {editing && <QuotaModal dept={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
