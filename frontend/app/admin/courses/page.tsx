"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import type { Course } from "@/components/CourseList";
import { IconChevronRight, IconPlus, IconTrash } from "@/components/Icons";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table, cls, td, th } from "@/components/ui";
import { api } from "@/lib/api";

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
      <PageHeader title={t("createCourse")} />

      <Card className="mb-4 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label={t("subject")}>
            <Select required value={form.subject_id}
                    onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                    className="sm:w-56">
              <option value="" disabled>—</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{subjectName(s)}</option>)}
            </Select>
          </Field>
          <Field label={t("teacher")}>
            <Select required value={form.teacher_id}
                    onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                    className="sm:w-52">
              <option value="" disabled>—</option>
              {teachers?.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("semester")}>
            <Input required type="number" min={1} max={12} value={form.semester}
                   onChange={(e) => setForm({ ...form, semester: e.target.value })}
                   className="w-20" />
          </Field>
          <Field label={t("academicYear")}>
            <Input required value={form.academic_year}
                   onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                   className="w-28" />
          </Field>
          <Field label={t("groups")}>
            <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5">
              {groups?.length === 0 && <span className="text-sm text-slate-400">—</span>}
              {groups?.map((group) => {
                const selected = groupIds.includes(group.id);
                return (
                  <Badge
                    key={group.id}
                    tone={selected ? "teal" : "slate"}
                    onClick={() =>
                      setGroupIds(selected
                        ? groupIds.filter((id) => id !== group.id)
                        : [...groupIds, group.id])
                    }
                  >
                    {group.name}
                  </Badge>
                );
              })}
            </div>
          </Field>
          <Button type="submit">
            <IconPlus />
            {tc("add")}
          </Button>
        </form>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </Card>

      <Table
        head={
          <>
            <th className={th}>{t("subject")}</th>
            <th className={th}>{t("teacher")}</th>
            <th className={th}>{t("semester")}</th>
            <th className={th}>{t("academicYear")}</th>
            <th className={th}>{t("groups")}</th>
            <th className={cls(th, "text-right")}>{tc("actions")}</th>
          </>
        }
      >
        {courses?.map((course) => (
          <tr key={course.id} className="hover:bg-slate-50/60">
            <td className={cls(td, "font-medium")}>
              <Link href={`/teach/courses/${course.id}`}
                    className="inline-flex items-center gap-1 text-teal-700 hover:underline">
                {locale === "ru" ? course.subject_name_ru : course.subject_name_uz}
                <IconChevronRight className="text-sm text-slate-400" />
              </Link>
            </td>
            <td className={cls(td, "text-slate-500")}>{course.teacher_name}</td>
            <td className={td}>{course.semester}</td>
            <td className={td}>{course.academic_year}</td>
            <td className={td}>
              <div className="flex flex-wrap gap-1">
                {course.groups.map((g) => (
                  <Badge key={g.id} tone="slate">{g.name}</Badge>
                ))}
              </div>
            </td>
            <td className={cls(td, "text-right")}>
              <button
                onClick={() => window.confirm(tc("confirmDelete")) && remove.mutate(course.id)}
                title={tc("delete")}
                className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <IconTrash />
              </button>
            </td>
          </tr>
        ))}
        {courses?.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">{tc("empty")}</td>
          </tr>
        )}
      </Table>
    </div>
  );
}
