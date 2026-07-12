import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Palette, Plus, Star, Trash2 } from "lucide-react";
import { Button, Card, Icon, Spinner, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useCreateTemplate, useDeleteTemplate, useSetDefaultTemplate, useTemplates, type Template } from "../api";

/** A miniature branded slide so the admin sees how the template looks. */
function Preview({ primary, secondary, name }: { primary: string; secondary: string; name: string }) {
  return (
    <div className="overflow-hidden rounded-control border border-line" style={{ background: "#F7F8FA" }}>
      <div className="px-3 py-2" style={{ background: primary }}>
        <div className="h-2 w-20 rounded-full bg-white/90" />
      </div>
      <div className="space-y-1.5 p-3">
        <div className="h-1.5 w-3/4 rounded-full" style={{ background: secondary, opacity: 0.85 }} />
        <div className="h-1.5 w-2/3 rounded-full bg-ink-faint/40" />
        <div className="h-1.5 w-1/2 rounded-full bg-ink-faint/40" />
        <div className="mt-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: primary }}>{name}</div>
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "templates" });
  const { show } = useToast();
  const q = useTemplates();
  const create = useCreateTemplate();
  const del = useDeleteTemplate();
  const setDefault = useSetDefaultTemplate();

  const [form, setForm] = useState({ name: "", primary: "#0F9E8E", secondary: "#0F172A" });
  const [confirmDel, setConfirmDel] = useState<Template | null>(null);

  const add = () => {
    if (!form.name.trim()) return;
    create.mutate({ name: form.name, colors: { primary: form.primary, secondary: form.secondary } }, { onSuccess: () => { show(t("created")); setForm({ name: "", primary: "#0F9E8E", secondary: "#0F172A" }); } });
  };

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-[13px] text-ink-soft">{t("subtitle")}</p>

      {/* Create */}
      <Card className="mt-5">
        <h2 className="mb-3 text-section font-bold text-ink">{t("newTemplate")}</h2>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-soft">{t("name")}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("namePlaceholder")} className="w-full rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-soft">{t("primary")}</label>
            <input type="color" value={form.primary} onChange={(e) => setForm({ ...form, primary: e.target.value })} className="h-10 w-16 cursor-pointer rounded-control border border-line" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-soft">{t("secondary")}</label>
            <input type="color" value={form.secondary} onChange={(e) => setForm({ ...form, secondary: e.target.value })} className="h-10 w-16 cursor-pointer rounded-control border border-line" />
          </div>
          <Button onClick={add} disabled={create.isPending || !form.name.trim()}><Icon icon={Plus} size={15} /> {t("add")}</Button>
        </div>
      </Card>

      {/* List */}
      <div className="mt-5">
        {q.isLoading ? <div className="flex justify-center py-10"><Spinner size={24} /></div> : (
          <AsyncSection isLoading={false} isError={q.isError} isEmpty={!!q.data && q.data.length === 0} emptyIcon={<Icon icon={Palette} size={22} />} emptyText={t("empty")} onRetry={() => q.refetch()}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {q.data?.map((tpl) => (
                <Card key={tpl.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-[15px] font-bold text-ink">{tpl.name}</h3>
                    {tpl.isDefault && <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-soft px-2 py-0.5 text-[11px] font-semibold text-emerald"><Icon icon={Star} size={11} /> {t("default")}</span>}
                  </div>
                  <Preview primary={tpl.colors.primary} secondary={tpl.colors.secondary} name={tpl.name} />
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full border border-line" style={{ background: tpl.colors.primary }} />
                    <span className="h-5 w-5 rounded-full border border-line" style={{ background: tpl.colors.secondary }} />
                    <div className="ml-auto flex items-center gap-1">
                      {!tpl.isDefault && (
                        <button onClick={() => setDefault.mutate(tpl.id, { onSuccess: () => show(t("defaultSet")) })} className="inline-flex items-center gap-1 rounded-control border border-line px-2 py-1 text-[12px] font-semibold text-ink-soft hover:bg-bg">
                          <Icon icon={Check} size={13} /> {t("makeDefault")}
                        </button>
                      )}
                      <button onClick={() => setConfirmDel(tpl)} className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"><Icon icon={Trash2} size={15} /></button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </AsyncSection>
        )}
      </div>

      <ConfirmDialog open={confirmDel !== null} title={t("deleteTitle")} message={t("deleteConfirm", { name: confirmDel?.name })} loading={del.isPending}
        onConfirm={() => confirmDel && del.mutate(confirmDel.id, { onSuccess: () => { show(t("deleted")); setConfirmDel(null); } })} onClose={() => setConfirmDel(null)} />
    </div>
  );
}
