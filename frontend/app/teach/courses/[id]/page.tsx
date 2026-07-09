"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  IconArrowLeft, IconArrowUp, IconChevronRight, IconHome, IconPlus, IconTrash,
} from "@/components/Icons";
import Shell from "@/components/Shell";
import UnlockRuleEditor from "@/components/UnlockRuleEditor";
import { Badge, Button, Card, Field, Input, PageHeader, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Topic = {
  id: number;
  title_uz: string;
  title_ru: string;
  order_index: number;
  status: string;
};

export default function TeacherCoursePage() {
  const { me } = useRequireRole("teacher");
  const t = useTranslations("topics");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const tu = useTranslations("unlock");
  const locale = useLocale();
  const params = useParams();
  const courseId = Number(params.id);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title_uz: "", title_ru: "" });
  const [error, setError] = useState<string | null>(null);

  const { data: topics } = useQuery({
    queryKey: ["course-topics", courseId],
    queryFn: () => api<Topic[]>(`/courses/${courseId}/topics`),
    enabled: !!me,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["course-topics", courseId] });

  const create = useMutation({
    mutationFn: () => api(`/courses/${courseId}/topics`, { method: "POST", body: form }),
    onSuccess: () => {
      setForm({ title_uz: "", title_ru: "" });
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/topics/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (ids: number[]) =>
      api("/topics/reorder", { method: "PATCH", body: { course_id: courseId, topic_ids: ids } }),
    onSuccess: invalidate,
  });

  const togglePublish = useMutation({
    mutationFn: (topic: Topic) =>
      api(`/topics/${topic.id}/${topic.status === "published" ? "unpublish" : "publish"}`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  const move = (index: number, dir: -1 | 1) => {
    if (!topics) return;
    const ids = topics.map((x) => x.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  if (!me) return null;
  return (
    <Shell me={me} variant="sidebar" nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome /> }]}>
      <Link href="/teach" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700">
        <IconArrowLeft className="text-base" />
        {tn("dashboard")}
      </Link>
      <PageHeader title={t("title")} />

      <Card className="mb-5 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label={t("topicTitleUz")} className="grow">
            <Input required value={form.title_uz}
                   onChange={(e) => setForm({ ...form, title_uz: e.target.value })}
                   placeholder="Yurak anatomiyasi" />
          </Field>
          <Field label={t("topicTitleRu")} className="grow">
            <Input required value={form.title_ru}
                   onChange={(e) => setForm({ ...form, title_ru: e.target.value })}
                   placeholder="Анатомия сердца" />
          </Field>
          <Button type="submit">
            <IconPlus />
            {t("newTopic")}
          </Button>
        </form>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </Card>

      {topics?.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          {t("noTopics")}
        </div>
      ) : (
        <ol className="space-y-2">
          {topics?.map((topic, index) => (
            <li key={topic.id}>
              <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-md">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-sm font-semibold text-teal-700">
                  {index + 1}
                </span>
                <Link href={`/teach/topics/${topic.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">
                    {locale === "ru" ? topic.title_ru : topic.title_uz}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {locale === "ru" ? topic.title_uz : topic.title_ru}
                  </p>
                </Link>
                <Badge tone={topic.status === "published" ? "green" : "slate"}
                       onClick={() => togglePublish.mutate(topic)}>
                  {topic.status === "published" ? "published" : "draft"}
                </Badge>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    title={t("moveUp")}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <IconArrowUp className="text-base" />
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === (topics.length - 1)}
                    title={t("moveDown")}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <IconArrowUp className="rotate-180 text-base" />
                  </button>
                  <button
                    onClick={() => window.confirm(tc("confirmDelete")) && remove.mutate(topic.id)}
                    title={tc("delete")}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <IconTrash className="text-base" />
                  </button>
                  <Link
                    href={`/teach/topics/${topic.id}`}
                    className={cls("rounded-md p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-600")}
                    title={t("open")}
                  >
                    <IconChevronRight className="text-base" />
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8">
        <UnlockRuleEditor endpoint={`/courses/${courseId}/default-unlock-rule`}
                          title={tu("defaultRule")} />
      </div>
    </Shell>
  );
}
