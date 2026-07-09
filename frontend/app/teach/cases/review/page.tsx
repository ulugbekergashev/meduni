"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { IconCheck, IconHome, IconUsers } from "@/components/Icons";
import Shell from "@/components/Shell";
import { Avatar, Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type ReviewItem = {
  id: number;
  student_name: string;
  topic_title: string;
  answers_json: string[];
  submitted_at: string;
};

function ReviewCard({ item, onReviewed }: { item: ReviewItem; onReviewed: () => void }) {
  const t = useTranslations("review");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(80);

  const review = useMutation({
    mutationFn: () =>
      api(`/teach/case-attempts/${item.id}/review`, { method: "POST", body: { feedback, score } }),
    onSuccess: onReviewed,
  });

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar name={item.student_name} size="sm" />
        <div>
          <p className="font-medium text-slate-800">{item.student_name}</p>
          <p className="text-xs text-slate-400">{item.topic_title}</p>
        </div>
      </div>
      <div className="mb-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("answers")}</p>
        {item.answers_json.map((a, i) => (
          <p key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {i + 1}. {a}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-xs text-slate-500">{t("feedback")}</span>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2}
                    className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">{t("score")}</span>
          <input type="number" min={0} max={100} value={score}
                 onChange={(e) => setScore(Number(e.target.value))}
                 className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm" />
        </label>
        <Button onClick={() => review.mutate()} disabled={review.isPending || !feedback.trim()}>
          <IconCheck /> {t("submit")}
        </Button>
      </div>
    </Card>
  );
}

export default function CaseReviewPage() {
  const { me } = useRequireRole("teacher");
  const t = useTranslations("review");
  const tn = useTranslations("nav");
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["case-review"],
    queryFn: () => api<ReviewItem[]>("/teach/case-review"),
    enabled: !!me,
  });

  if (!me) return null;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["case-review"] });

  return (
    <Shell me={me} variant="sidebar"
           nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome /> },
                 { href: "/teach/cases/review", label: t("queue"), icon: <IconUsers /> }]}>
      <PageHeader title={t("queue")} />
      {data?.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-slate-400">{t("noItems")}</Card>
      ) : (
        <div className="space-y-4">
          {data?.map((item) => <ReviewCard key={item.id} item={item} onReviewed={invalidate} />)}
        </div>
      )}
    </Shell>
  );
}
