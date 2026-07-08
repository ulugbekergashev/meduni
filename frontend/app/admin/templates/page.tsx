"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { IconPlus, IconTrash, IconUpload } from "@/components/Icons";
import { Badge, Button, Card, Field, Input, PageHeader, cls } from "@/components/ui";
import { api } from "@/lib/api";

type Template = {
  id: number;
  name: string;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  is_default: boolean;
};

const emptyForm = { name: "", primary_color: "0D9488", accent_color: "0F172A", is_default: false };

export default function TemplatesPage() {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const logoRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const { data: templates } = useQuery({
    queryKey: ["/presentation-templates"],
    queryFn: () => api<Template[]>("/presentation-templates"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/presentation-templates"] });

  const create = useMutation({
    mutationFn: () => api("/presentation-templates", { method: "POST", body: form }),
    onSuccess: () => { setForm(emptyForm); setError(null); invalidate(); },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/presentation-templates/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const setDefault = useMutation({
    mutationFn: (tpl: Template) =>
      api(`/presentation-templates/${tpl.id}`, {
        method: "PUT",
        body: { name: tpl.name, primary_color: tpl.primary_color, accent_color: tpl.accent_color, is_default: true },
      }),
    onSuccess: invalidate,
  });

  const uploadLogo = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      return api(`/presentation-templates/${id}/logo`, { method: "POST", formData: fd });
    },
    onSuccess: invalidate,
  });

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card className="mb-4 p-4">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
              className="flex flex-wrap items-end gap-3">
          <Field label={t("name")}>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   className="sm:w-48" />
          </Field>
          <Field label={t("primaryColor")}>
            <div className="flex items-center gap-2">
              <input type="color" value={`#${form.primary_color}`}
                     onChange={(e) => setForm({ ...form, primary_color: e.target.value.slice(1).toUpperCase() })}
                     className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
              <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                     className="w-24" />
            </div>
          </Field>
          <Field label={t("accentColor")}>
            <div className="flex items-center gap-2">
              <input type="color" value={`#${form.accent_color}`}
                     onChange={(e) => setForm({ ...form, accent_color: e.target.value.slice(1).toUpperCase() })}
                     className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
              <Input value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                     className="w-24" />
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default}
                   onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            {t("isDefault")}
          </label>
          <Button type="submit"><IconPlus /> {t("addTemplate")}</Button>
        </form>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {templates?.map((tpl) => (
          <Card key={tpl.id} className="overflow-hidden">
            <div className="flex h-16 items-center gap-3 px-4"
                 style={{ background: `linear-gradient(135deg, #${tpl.primary_color}, #${tpl.accent_color})` }}>
              {tpl.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/v1/media/${tpl.logo_url}`} alt="" className="h-8 rounded bg-white/90 px-1" />
              ) : null}
              <span className="font-bold text-white drop-shadow">{tpl.name}</span>
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                {tpl.is_default ? (
                  <Badge tone="teal">{t("default")}</Badge>
                ) : (
                  <button onClick={() => setDefault.mutate(tpl)}
                          className="text-xs text-slate-400 hover:text-teal-600">
                    {t("isDefault")}
                  </button>
                )}
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="h-4 w-4 rounded" style={{ background: `#${tpl.primary_color}` }} />
                  <span className="h-4 w-4 rounded" style={{ background: `#${tpl.accent_color}` }} />
                </span>
              </div>
              <div className="flex items-center gap-1">
                <label className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-600"
                       title={t("uploadLogo")}>
                  <IconUpload className="text-base" />
                  <input ref={(el) => { logoRefs.current[tpl.id] = el; }} type="file" accept=".png,.jpg,.jpeg"
                         className="hidden"
                         onChange={(e) => e.target.files?.[0] && uploadLogo.mutate({ id: tpl.id, file: e.target.files[0] })} />
                </label>
                <button onClick={() => window.confirm(tc("confirmDelete")) && remove.mutate(tpl.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <IconTrash className="text-base" />
                </button>
              </div>
            </div>
          </Card>
        ))}
        {templates?.length === 0 && (
          <p className={cls("text-sm text-slate-400", "sm:col-span-2")}>{tc("empty")}</p>
        )}
      </div>
    </div>
  );
}
