"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { IconChevronRight, IconSparkles, IconSpinner } from "./Icons";
import { Badge, Button, Card, cls } from "./ui";
import { api } from "@/lib/api";

type ContentItem = { id: number; kind: string; status: string; factcheck_flags_resolved: boolean };
type TopicContent = { quiz: ContentItem | null; case: ContentItem | null; presentation: ContentItem | null };
type Job = { id: number; status: string; steps_json: { step: string; status: string }[]; error: string | null };

const statusTone = { review: "amber", approved: "green", published: "teal", draft: "slate" } as const;

const genLabel: Record<string, string> = {
  quiz: "generateQuiz", case: "generateCase", presentation: "generatePresentation",
};

function ContentCard({
  kind, item, topicId, onChanged,
}: {
  kind: "quiz" | "case" | "presentation";
  item: ContentItem | null;
  topicId: number;
  onChanged: () => void;
}) {
  const t = useTranslations("content");
  const [jobId, setJobId] = useState<number | null>(null);
  const [count, setCount] = useState(5);
  const [fmt, setFmt] = useState("short");
  const [error, setError] = useState<string | null>(null);

  useQuery({
    queryKey: ["gen-job", jobId],
    queryFn: () => api<Job>(`/jobs/${jobId}`),
    enabled: jobId !== null,
    refetchInterval: (q) => {
      const s = (q.state.data as Job | undefined)?.status;
      if (s === "done" || s === "error") {
        setJobId(null);
        onChanged();
        return false;
      }
      return 1500;
    },
  });

  const generate = useMutation({
    mutationFn: () =>
      api<{ job_id: number }>(`/topics/${topicId}/${kind}/generate`, {
        method: "POST",
        body: kind === "quiz" ? { count } : kind === "case" ? { fmt } : {},
      }),
    onSuccess: (res) => {
      setError(null);
      setJobId(res.job_id);
    },
    onError: (err: Error) => setError(err.message),
  });

  const generating = jobId !== null || generate.isPending;
  const editorHref = `/teach/content/${kind}/${item?.id}`;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          {t(kind)}
          {item && (
            <Badge tone={statusTone[item.status as keyof typeof statusTone] ?? "slate"}>
              {t(`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}` as never)}
            </Badge>
          )}
          {item && !item.factcheck_flags_resolved && <Badge tone="red">factcheck</Badge>}
        </h3>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {kind === "quiz" && (
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">{t("questionCount")}</span>
            <input type="number" min={1} max={20} value={count}
                   onChange={(e) => setCount(Number(e.target.value))}
                   className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
        )}
        {kind === "case" && (
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">{t("caseFormat")}</span>
            <select value={fmt} onChange={(e) => setFmt(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
              <option value="short">{t("short")}</option>
              <option value="extended">{t("extended")}</option>
            </select>
          </label>
        )}
        <Button onClick={() => generate.mutate()} disabled={generating}
                variant={item ? "outline" : "primary"}>
          {generating ? <IconSpinner /> : <IconSparkles />}
          {generating ? "..." : item ? t("regenerate") : t(genLabel[kind] as never)}
        </Button>
        {item && !generating && (
          <Link href={editorHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700">
            {t("open")} <IconChevronRight className="text-base" />
          </Link>
        )}
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Card>
  );
}

export default function TopicContentSection({ topicId, enabled }: { topicId: number; enabled: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["topic-content", topicId],
    queryFn: () => api<TopicContent>(`/topics/${topicId}/content`),
    enabled,
  });

  const onChanged = () => queryClient.invalidateQueries({ queryKey: ["topic-content", topicId] });

  return (
    <div className={cls("grid gap-4 sm:grid-cols-2", !enabled && "pointer-events-none opacity-50")}>
      <ContentCard kind="quiz" item={data?.quiz ?? null} topicId={topicId} onChanged={onChanged} />
      <ContentCard kind="case" item={data?.case ?? null} topicId={topicId} onChanged={onChanged} />
      <ContentCard kind="presentation" item={data?.presentation ?? null} topicId={topicId} onChanged={onChanged} />
    </div>
  );
}
