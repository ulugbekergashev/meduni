"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2 text-sm">
          <label className="cursor-pointer rounded border px-3 py-1.5 hover:bg-slate-100">
            {t("importXlsx")}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importXlsx.mutate(e.target.files[0])}
            />
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded border bg-white px-2 py-1.5"
          >
            <option value="">{t("role")}: —</option>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-400">{t("importHint")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createUser.mutate();
        }}
        className="mb-4 flex flex-wrap items-end gap-2 text-sm"
      >
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="rounded border bg-white px-2 py-1.5"
        >
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input required placeholder={t("fullName")} value={form.full_name}
               onChange={(e) => setForm({ ...form, full_name: e.target.value })}
               className="w-44 rounded border px-2 py-1.5" />
        <input required type="email" placeholder="email" value={form.email}
               onChange={(e) => setForm({ ...form, email: e.target.value })}
               className="w-48 rounded border px-2 py-1.5" />
        <input required type="text" placeholder={t("newPassword")} value={form.password}
               onChange={(e) => setForm({ ...form, password: e.target.value })}
               className="w-36 rounded border px-2 py-1.5" />
        <input placeholder={t("phone")} value={form.phone}
               onChange={(e) => setForm({ ...form, phone: e.target.value })}
               className="w-36 rounded border px-2 py-1.5" />
        <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">
          {tc("add")}
        </button>
      </form>

      {message && <p className="mb-2 text-sm text-sky-700">{message}</p>}
      {importErrors.length > 0 && (
        <ul className="mb-3 max-h-40 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {importErrors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">{t("fullName")}</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">{t("role")}</th>
              <th className="px-3 py-2">{t("active")}</th>
              <th className="px-3 py-2 text-right">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-3 py-2 text-slate-400">{user.id}</td>
                <td className="px-3 py-2">{user.full_name}</td>
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">{roleLabels[user.role] ?? user.role}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleActive.mutate(user)}
                    className={`rounded px-2 py-0.5 text-xs ${
                      user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.is_active ? t("active") : t("inactive")}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => {
                      const password = window.prompt(t("newPassword"));
                      if (password) resetPassword.mutate({ id: user.id, password });
                    }}
                    className="text-sky-600 hover:underline"
                  >
                    {t("newPassword")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
