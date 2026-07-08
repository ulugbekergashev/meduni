"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { IconKey, IconPlus, IconUpload } from "@/components/Icons";
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Select, Table, cls, td, th } from "@/components/ui";
import { api } from "@/lib/api";

type UserRow = {
  id: number;
  role: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
};

const emptyForm = { role: "student", full_name: "", email: "", password: "", phone: "" };

const roleTones = { admin: "amber", teacher: "teal", student: "slate" } as const;

export default function UsersPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const roleLabels: Record<string, string> = {
    admin: t("roleAdmin"),
    teacher: t("roleTeacher"),
    student: t("roleStudent"),
  };

  const { data: users } = useQuery({
    queryKey: ["/users", roleFilter],
    queryFn: () => api<UserRow[]>(`/users${roleFilter ? `?role=${roleFilter}` : ""}`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/users"] });
  const onError = (err: Error) => setMessage(err.message);

  const createUser = useMutation({
    mutationFn: () => api("/users", { method: "POST", body: { ...form, phone: form.phone || null } }),
    onSuccess: () => {
      setForm(emptyForm);
      setMessage(null);
      invalidate();
    },
    onError,
  });

  const toggleActive = useMutation({
    mutationFn: (user: UserRow) =>
      api(`/users/${user.id}`, { method: "PATCH", body: { is_active: !user.is_active } }),
    onSuccess: invalidate,
    onError,
  });

  const resetPassword = useMutation({
    mutationFn: (payload: { id: number; password: string }) =>
      api(`/users/${payload.id}`, { method: "PATCH", body: { password: payload.password } }),
    onSuccess: () => setMessage(null),
    onError,
  });

  const importXlsx = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api<{ created: number; errors: string[] }>("/users/import", {
        method: "POST",
        formData,
      });
    },
    onSuccess: (report) => {
      setMessage(t("importResult", { created: report.created }));
      setImportErrors(report.errors);
      invalidate();
      if (fileRef.current) fileRef.current.value = "";
    },
    onError,
  });

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("importHint")}
        actions={
          <>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700">
              <IconUpload />
              {t("importXlsx")}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importXlsx.mutate(e.target.files[0])}
              />
            </label>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-auto"
            >
              <option value="">{t("role")}: —</option>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createUser.mutate();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label={t("role")}>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("fullName")} className="grow sm:grow-0">
            <Input required value={form.full_name}
                   onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                   className="sm:w-52" />
          </Field>
          <Field label="Email">
            <Input required type="email" value={form.email}
                   onChange={(e) => setForm({ ...form, email: e.target.value })}
                   className="sm:w-56" placeholder="name@meduni.uz" />
          </Field>
          <Field label={t("newPassword")}>
            <Input required value={form.password}
                   onChange={(e) => setForm({ ...form, password: e.target.value })}
                   className="sm:w-36" />
          </Field>
          <Field label={t("phone")}>
            <Input value={form.phone}
                   onChange={(e) => setForm({ ...form, phone: e.target.value })}
                   className="sm:w-36" placeholder="+998..." />
          </Field>
          <Button type="submit">
            <IconPlus />
            {tc("add")}
          </Button>
        </form>
        {message && <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{message}</p>}
        {importErrors.length > 0 && (
          <ul className="mt-3 max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {importErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        )}
      </Card>

      <Table
        head={
          <>
            <th className={th}>{t("fullName")}</th>
            <th className={th}>Email</th>
            <th className={th}>{t("role")}</th>
            <th className={th}>{t("active")}</th>
            <th className={cls(th, "text-right")}>{tc("actions")}</th>
          </>
        }
      >
        {users?.map((user) => (
          <tr key={user.id} className={cls("hover:bg-slate-50/60", !user.is_active && "opacity-60")}>
            <td className={td}>
              <div className="flex items-center gap-2.5">
                <Avatar name={user.full_name} size="sm" />
                <span className="font-medium text-slate-800">{user.full_name}</span>
              </div>
            </td>
            <td className={cls(td, "text-slate-500")}>{user.email}</td>
            <td className={td}>
              <Badge tone={roleTones[user.role as keyof typeof roleTones] ?? "slate"}>
                {roleLabels[user.role] ?? user.role}
              </Badge>
            </td>
            <td className={td}>
              <Badge tone={user.is_active ? "green" : "red"} onClick={() => toggleActive.mutate(user)}>
                {user.is_active ? t("active") : t("inactive")}
              </Badge>
            </td>
            <td className={cls(td, "text-right")}>
              <button
                onClick={() => {
                  const password = window.prompt(t("newPassword"));
                  if (password) resetPassword.mutate({ id: user.id, password });
                }}
                title={t("newPassword")}
                className="rounded-md p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-600"
              >
                <IconKey />
              </button>
            </td>
          </tr>
        ))}
        {users?.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">{tc("empty")}</td>
          </tr>
        )}
      </Table>
    </div>
  );
}
