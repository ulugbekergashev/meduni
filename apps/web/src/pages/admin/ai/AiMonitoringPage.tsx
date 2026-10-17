import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Coins, Image as ImageIcon, Mic, Sparkles } from "lucide-react";
import { Button, Icon, Input, MiniBars, Modal, Spinner, cls, useToast } from "@meduni/ui";
import { BentoCard, PageHeader } from "../../../components/bento";
import { AsyncSection } from "../../../components/AsyncSection";
import { TableCard } from "../components";
import { useLocale } from "../../../lib/useLocale";
import { formatDate } from "../../../lib/date";
import { Link } from "react-router-dom";
import { useAiUsage, useDeptAiKeys, useSetQuota, type AiUsage } from "../api";

type DeptRow = AiUsage["byDept"][number];

function modelLabel(m: string): string {
  if (m.includes("image")) return "Rasm (Nano Banana)";
  if (m.includes("tts")) return "Ovoz (TTS)";
  if (m.includes("lite")) return "Flash-Lite";
  if (m.includes("flash")) return "Flash";
  if (m.includes("pro")) return "Pro";
  return m;
}
const money = (n: number) => "$" + n.toFixed(n < 1 ? 3 : 2);

const RANK_TONE = { brand: "bg-brand", blue: "bg-blue", violet: "bg-violet" };

/** Proportional rank row: label + bar (share of max) + right-aligned value. */
function RankRow({ label, value, max, display, tone = "brand" }: { label: string; value: number; max: number; display: string; tone?: keyof typeof RANK_TONE }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-32 shrink-0 truncate text-note text-ink sm:w-40">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-raised">
        <span className={cls("block h-full rounded-pill transition-all", RANK_TONE[tone])} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-16 shrink-0 text-right font-data text-note font-semibold tabular-nums text-ink">{display}</span>
    </div>
  );
}

function QuotaBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-micro text-ink-faint">—</span>;
  const tone = pct >= 100 ? "bg-rose" : pct >= 80 ? "bg-amber" : "bg-brand";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-pill bg-surface-raised">
        <div className={cls("h-full rounded-pill", tone)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={cls("w-9 font-data text-micro font-semibold tabular-nums", pct >= 100 ? "text-rose" : pct >= 80 ? "text-amber" : "text-ink-soft")}>{pct}%</span>
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
            <label className="mb-1 block text-note font-semibold text-ink-soft">{f.l}</label>
            <Input type="number" min={0} value={f.v} onChange={(e) => f.s(e.target.value)} />
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

function HeroFigure({ icon, value, label }: { icon: typeof Coins; value: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-micro font-semibold text-ink-2">
        <Icon icon={icon} size={13} /> {label}
      </p>
      <p className="mt-1 text-stat font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-note text-ink-soft">{text}</p>;
}

export function AiMonitoringPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "ai" });
  const locale = useLocale();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const usage = useAiUsage(month);
  const keys = useDeptAiKeys();
  const keyByDept = new Map((keys.data ?? []).map((k) => [k.departmentId, k]));
  const [editing, setEditing] = useState<DeptRow | null>(null);
  const u = usage.data;

  const maxKindCost = Math.max(0, ...(u?.byKind ?? []).map((k) => k.cost));
  const maxModelCost = Math.max(0, ...(u?.byModel ?? []).map((m) => m.cost));
  const maxUserCost = Math.max(0, ...(u?.byUser ?? []).map((x) => x.cost));
  const kindLabel = (k: string) => t(`kind.${k}`, { defaultValue: k });

  return (
    <div className="space-y-3">
      <PageHeader
        className="mb-0"
        title={t("title")}
        subtitle={t("subtitle")}
        right={
          <input
            type="month"
            value={month}
            max={new Date().toISOString().slice(0, 7)}
            onChange={(e) => setMonth(e.target.value)}
            aria-label={t("thisMonth")}
            className="h-10 rounded-pill border border-line-raised bg-surface px-4 text-note font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        }
      />

      {usage.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : usage.isError || !u ? (
        <AsyncSection isLoading={false} isError isEmpty={false} emptyText="" onRetry={() => usage.refetch()}>{null}</AsyncSection>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Oy jami — sahifaning yagona pastel yuzasi */}
          <section className="flex flex-col gap-4 rounded-card bg-violet-soft p-5 sm:flex-row sm:items-stretch">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="inline-flex items-center gap-1.5 self-start rounded-pill bg-surface/70 px-2.5 py-1 text-micro font-semibold text-violet">
                <Icon icon={Sparkles} size={13} /> {t("thisMonth")}
              </span>
              <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-3 pt-4 sm:grid-cols-3">
                <HeroFigure icon={Coins} value={u.totals.tokens.toLocaleString()} label={t("tokens")} />
                <HeroFigure icon={ImageIcon} value={String(u.totals.images)} label={t("images")} />
                <HeroFigure icon={Mic} value={u.totals.ttsChars.toLocaleString()} label={t("ttsChars")} />
              </div>
            </div>
            <div className="flex shrink-0 flex-row items-end justify-between gap-2 border-t border-ink/10 pt-3 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0 sm:text-right">
              <p className="text-display font-semibold tabular-nums text-ink">{money(u.totals.cost)}</p>
              <p className="text-micro text-ink-2">{t("cost")}</p>
            </div>
          </section>

          <BentoCard title={t("byKind")}>
            {u.byKind.length ? (
              <div>{u.byKind.map((k) => (
                <RankRow key={k.kind} label={kindLabel(k.kind)} value={k.cost} max={maxKindCost} display={money(k.cost)} />
              ))}</div>
            ) : <Empty text={t("empty")} />}
          </BentoCard>

          {/* Daily timeline */}
          <BentoCard title={t("timeline")} meta={t("timelineHint")}>
            {u.byDay.some((d) => d.tokens > 0) ? (
              <div className="flex flex-1 flex-col justify-end">
                <MiniBars
                  height={128}
                  data={u.byDay.map((d) => ({
                    label: d.day,
                    value: d.tokens,
                    tip: `${formatDate(locale === "ru" ? "ru" : "uz", d.day, "short")} · ${d.tokens.toLocaleString()} tok · ${money(d.cost)}`,
                  }))}
                />
              </div>
            ) : (
              <Empty text={t("empty")} />
            )}
          </BentoCard>

          <BentoCard title={t("byModel")}>
            {u.byModel.length ? (
              <div>{u.byModel.map((m) => (
                <RankRow key={m.model} label={modelLabel(m.model)} value={m.cost} max={maxModelCost} display={money(m.cost)} tone="blue" />
              ))}</div>
            ) : <Empty text={t("empty")} />}
          </BentoCard>

          {/* Top teachers */}
          {u.byUser.length > 0 && (
            <BentoCard className="xl:col-span-2" title={t("topTeachers")} count={u.byUser.length}>
              <div className="grid gap-x-8 lg:grid-cols-2">{u.byUser.map((x) => (
                <RankRow key={x.userId} label={x.name} value={x.cost} max={maxUserCost} display={money(x.cost)} tone="violet" />
              ))}</div>
            </BentoCard>
          )}

          {/* By department + quota */}
          <TableCard className="xl:col-span-2" title={t("byDept")} count={u.byDept.length}>
            {u.byDept.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-note">
                  <thead>
                    <tr className="border-b border-line bg-surface-raised text-left text-micro font-semibold text-ink-soft">
                      <th className="px-4 py-3">{t("dept")}</th><th className="px-4 py-3">{t("keyCol")}</th><th className="px-4 py-3">{t("cost")}</th>
                      <th className="px-4 py-3">{t("tokenQuota")}</th><th className="px-4 py-3">{t("imageQuota")}</th><th className="px-4 py-3">{t("costQuota")}</th>
                      <th className="px-4 py-3 text-right">{t("quota")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.byDept.map((d) => (
                      <tr key={d.departmentId} className="border-b border-line last:border-0 hover:bg-surface-raised">
                        <td className="px-4 py-3 font-semibold text-ink">{d.name}</td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/admin/staff/d/${d.departmentId}`}
                            className={cls(
                              "inline-flex items-center rounded-pill px-2 py-0.5 text-micro font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                              keyByDept.has(d.departmentId) ? "bg-emerald-soft text-emerald" : "bg-amber-soft text-amber"
                            )}
                          >
                            {keyByDept.has(d.departmentId) ? `••••${keyByDept.get(d.departmentId)!.last4}` : t("keyMissing")}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-data font-semibold tabular-nums text-ink">{money(d.cost)}</td>
                        <td className="px-4 py-3"><QuotaBar pct={d.tokenPct} /></td>
                        <td className="px-4 py-3"><QuotaBar pct={d.imagePct} /></td>
                        <td className="px-4 py-3"><QuotaBar pct={d.costPct} /></td>
                        <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(d)}>{t("setQuota")}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty text={t("empty")} />}
          </TableCard>
        </div>
      )}

      {editing && <QuotaModal dept={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
