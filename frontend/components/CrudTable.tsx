"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/lib/api";

export type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: { value: string | number; label: string }[];
  /** как отобразить значение в таблице (по умолчанию — как есть) */
  render?: (row: Record<string, unknown>) => React.ReactNode;
};

/** Универсальная CRUD-таблица для справочников (факультеты, кафедры, ...). */
export default function CrudTable({ endpoint, fields }: { endpoint: string; fields: Field[] }) {
  const t = useTranslations("common");
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: rows } = useQuery({
    queryKey: [endpoint],
    queryFn: () => api<Record<string, unknown>[]>(endpoint),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [endpoint] });
  const onError = (err: Error) => setError(err.message);

  const save = useMutation({
    mutationFn: (payload: { id: number | null; body: Record<string, unknown> }) =>
      payload.id === null
        ? api(endpoint, { method: "POST", body: payload.body })
        : api(`${endpoint}/${payload.id}`, { method: "PUT", body: payload.body }),
    onSuccess: () => {
      setForm({});
      setEditingId(null);
      setError(null);
      invalidate();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = form[field.key] ?? "";
      body[field.key] =
        field.type === "number" || field.type === "select" ? Number(raw) : raw;
    }
    save.mutate({ id: editingId, body });
  };

  const startEdit = (row: Record<string, unknown>) => {
    setEditingId(row.id as number);
    setForm(Object.fromEntries(fields.map((f) => [f.key, String(row[f.key] ?? "")])));
  };

  return (
    <div>
      <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-2">
        {fields.map((field) => (
          <label key={field.key} className="text-sm">
            <span className="mb-1 block text-slate-500">{field.label}</span>
            {field.type === "select" ? (
              <select
                required
                value={form[field.key] ?? ""}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="rounded border bg-white px-2 py-1.5"
              >
                <option value="" disabled>
                  —
                </option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                type={field.type ?? "text"}
                value={form[field.key] ?? ""}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="w-40 rounded border px-2 py-1.5"
              />
            )}
          </label>
        ))}
        <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700">
          {editingId === null ? t("add") : t("save")}
        </button>
        {editingId !== null && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({});
            }}
            className="rounded border px-3 py-1.5 text-sm"
          >
            {t("cancel")}
          </button>
        )}
      </form>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">#</th>
              {fields.map((f) => (
                <th key={f.key} className="px-3 py-2">{f.label}</th>
              ))}
              <th className="px-3 py-2 text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((row) => (
              <tr key={row.id as number} className="border-t">
                <td className="px-3 py-2 text-slate-400">{row.id as number}</td>
                {fields.map((f) => (
                  <td key={f.key} className="px-3 py-2">
                    {f.render ? f.render(row) : String(row[f.key] ?? "")}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <button onClick={() => startEdit(row)} className="mr-2 text-sky-600 hover:underline">
                    {t("edit")}
                  </button>
                  <button
                    onClick={() => remove.mutate(row.id as number)}
                    className="text-red-500 hover:underline"
                  >
                    {t("delete")}
                  </button>
                </td>
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={fields.length + 2} className="px-3 py-6 text-center text-slate-400">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
