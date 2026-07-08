"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/lib/api";
import { IconPencil, IconPlus, IconTrash } from "./Icons";
import { Button, Card, Field, Input, Select, Table, cls, td, th } from "./ui";

export type FieldSpec = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: { value: string | number; label: string }[];
  render?: (row: Record<string, unknown>) => React.ReactNode;
  required?: boolean;
  defaultValue?: string | number;
};

/**
 * Универсальная CRUD-таблица для справочников.
 * endpoint — GET списка (может содержать ?query); createEndpoint / itemEndpoint —
 * база для POST / PUT / DELETE (по умолчанию — endpoint без query-строки).
 */
export default function CrudTable({
  endpoint,
  createEndpoint,
  fields,
}: {
  endpoint: string;
  createEndpoint?: string;
  fields: FieldSpec[];
}) {
  const t = useTranslations("common");
  const queryClient = useQueryClient();
  const itemBase = createEndpoint ?? endpoint.split("?")[0];
  const defaults = () =>
    Object.fromEntries(
      fields.filter((f) => f.defaultValue !== undefined).map((f) => [f.key, String(f.defaultValue)]),
    );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>(defaults);
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
        ? api(itemBase, { method: "POST", body: payload.body })
        : api(`${itemBase}/${payload.id}`, { method: "PUT", body: payload.body }),
    onSuccess: () => {
      setForm(defaults());
      setEditingId(null);
      setError(null);
      invalidate();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`${itemBase}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = form[field.key] ?? "";
      if ((field.type === "number" || field.type === "select")) {
        body[field.key] = raw === "" ? null : Number(raw);
      } else {
        body[field.key] = raw === "" ? null : raw;
      }
    }
    save.mutate({ id: editingId, body });
  };

  const startEdit = (row: Record<string, unknown>) => {
    setEditingId(row.id as number);
    setForm(Object.fromEntries(fields.map((f) => [f.key, String(row[f.key] ?? "")])));
  };

  return (
    <div className="space-y-4">
      <Card className={cls("p-4", editingId !== null && "ring-2 ring-teal-500/30")}>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          {fields.map((field) => (
            <Field key={field.key} label={field.label} className="w-full sm:w-auto">
              {field.type === "select" ? (
                <Select
                  required={field.required !== false}
                  value={form[field.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="sm:w-52"
                >
                  <option value="" disabled>
                    —
                  </option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  required={field.required !== false}
                  type={field.type ?? "text"}
                  value={form[field.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="sm:w-52"
                />
              )}
            </Field>
          ))}
          <div className="flex gap-2">
            <Button type="submit">
              <IconPlus className={cls(editingId !== null && "hidden")} />
              {editingId === null ? t("add") : t("save")}
            </Button>
            {editingId !== null && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm({});
                }}
              >
                {t("cancel")}
              </Button>
            )}
          </div>
        </form>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </Card>

      <Table
        head={
          <>
            {fields.map((f) => (
              <th key={f.key} className={th}>
                {f.label}
              </th>
            ))}
            <th className={cls(th, "w-24 text-right")}>{t("actions")}</th>
          </>
        }
      >
        {rows?.map((row) => (
          <tr key={row.id as number} className="hover:bg-slate-50/60">
            {fields.map((f) => (
              <td key={f.key} className={td}>
                {f.render ? f.render(row) : String(row[f.key] ?? "")}
              </td>
            ))}
            <td className={cls(td, "text-right")}>
              <div className="inline-flex gap-1">
                <button
                  onClick={() => startEdit(row)}
                  title={t("edit")}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-600"
                >
                  <IconPencil />
                </button>
                <button
                  onClick={() => window.confirm(t("confirmDelete")) && remove.mutate(row.id as number)}
                  title={t("delete")}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <IconTrash />
                </button>
              </div>
            </td>
          </tr>
        ))}
        {rows?.length === 0 && (
          <tr>
            <td colSpan={fields.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">
              {t("empty")}
            </td>
          </tr>
        )}
      </Table>
    </div>
  );
}
