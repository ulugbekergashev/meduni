"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Course } from "@/components/CourseList";

type Named = { id: number; name_uz: string; name_ru: string };
type UserRow = { id: number; full_name: string };
type Group = { id: number; name: string };

export default function CoursesPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ subject_id: "", teacher_id: "", semester: "1", academic_year: "2026/2027" });
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: subjects } = useQuery({ queryKey: ["/subjects"], queryFn: () => api<Named[]>("/subjects") });
  const { data: teachers } = useQuery({ queryKey: ["/users", "teacher"], queryFn: () => api<UserRow[]>("/users?role=teacher") });
  const { data: groups } = useQuery({ queryKey: ["/groups"], queryFn: () => api<Group[]>("/groups") });
  const { data: courses } = useQuery({ queryKey: ["/courses"], queryFn: () => api<Course[]>("/courses") });

  const create = useMutation({
    mutationFn: () =>
      api("/courses", {
        method: "POST",
        body: {
          subject_id: Number(form.subject_id),
          teacher_id: Number(form.teacher_id),
          semester: Number(form.semester),
          academic_year: form.academic_year,
          group_ids: groupIds,
        },
      }),
    onSuccess: () => {
      setError(null);
      setGroupIds([]);
      queryClient.invalidateQueries({ queryKey: ["/courses"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/courses"] }),
  });

  const subjectName = (named: Named) => (locale === "ru" ? named.name_ru : named.name_uz);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("createCourse")}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="mb-6 flex flex-wrap items-end gap-2 text-sm"
      >
        <label>
          <span className="mb-1 block text-slate-500">{t("subject")}</span>
          <select required value={form.subject_id}
                  onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                  className="rounded border bg-white px-2 py-1.5">
            <option value="" disabled>—</option>
            {subjects?.map((s) => <option key={s.id} value={s.id}>{subjectName(s)}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-slate-500">{t("teacher")}</span>
          <select required value={form.teacher_id}
                  onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                  className="rounded border bg-white px-2 py-1.5">
            <option value="" disabled>—</option>
            {teachers?.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-slate-500">{t("semester")}</span>
          <input required type="number" min={1} max={12} value={form.semester}
                 onChange={(e) => setForm({ ...form, semester: e.target.value })}
                 className="w-20 rounded border px-2 py-1.5" />
        </label>
        <label>
          <span className="mb-1 block text-slate-500">{t("academicYear")}</span>
          <input required value={form.academic_year}
                 onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                 className="w-28 rounded border px-2 py-1.5" />
        </label>
        <fieldset className="rounded border px-3 py-1.5">
          <legend className="px-1 text-xs text-slate-500">{t("groups")}</legend>
          <div className="flex flex-wrap gap-2">
            {groups?.map((group) => (
              <label key={group.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={groupIds.includes(group.id)}
                  onChange={(e) =>
                    setGroupIds(e.target.checked
                      ? [...groupIds, group.id]
                      : groupIds.filter((id) => id !== group.id))
                  }
                />
                {group.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">
          {tc("add")}
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">{t("subject")}</th>
              <th className="px-3 py-2">{t("teacher")}</th>
              <th className="px-3 py-2">{t("semester")}</th>
              <th className="px-3 py-2">{t("academicYear")}</th>
              <th className="px-3 py-2">{t("groups")}</th>
              <th className="px-3 py-2 text-right">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {courses?.map((course) => (
              <tr key={course.id} className="border-t">
                <td className="px-3 py-2 text-slate-400">{course.id}</td>
                <td className="px-3 py-2">
                  {locale === "ru" ? course.subject_name_ru : course.subject_name_uz}
                </td>
                <td className="px-3 py-2">{course.teacher_name}</td>
                <td className="px-3 py-2">{course.semester}</td>
                <td className="px-3 py-2">{course.academic_year}</td>
                <td className="px-3 py-2">{course.groups.map((g) => g.name).join(", ")}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => remove.mutate(course.id)} className="text-red-500 hover:underline">
                    {tc("delete")}
                  </button>
                </td>
              </tr>
            ))}
            {courses?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">{tc("empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
