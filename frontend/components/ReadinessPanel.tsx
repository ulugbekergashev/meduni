"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { IconCheck, IconLock } from "./Icons";
import { Button, Card, cls } from "./ui";
import { api } from "@/lib/api";

type Readiness = {
  digest_approved: boolean;
  reviewed: boolean;
  factcheck_resolved: boolean;
  can_approve: boolean;
  can_publish: boolean;
};

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={cls("flex h-5 w-5 items-center justify-center rounded-full",
        ok ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300")}>
        {ok ? <IconCheck className="text-xs" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
      </span>
      <span className={ok ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </li>
  );
}

/** Чеклист готовности + утверждение/публикация (план §9.3). */
export default function ReadinessPanel({
  contentId,
  status,
  onChanged,
}: {
  contentId: number;
  status: string;
  onChanged: () => void;
}) {
  const t = useTranslations("content");
  const queryClient = useQueryClient();

  const { data: r } = useQuery({
    queryKey: ["readiness", contentId],
    queryFn: () => api<Readiness>(`/content/${contentId}/readiness`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["readiness", contentId] });
    onChanged();
  };

  const approve = useMutation({
    mutationFn: () => api(`/content/${contentId}/approve`, { method: "POST" }),
    onSuccess: invalidate,
  });
  const publish = useMutation({
    mutationFn: () => api(`/content/${contentId}/publish`, { method: "POST" }),
    onSuccess: invalidate,
  });

  if (!r) return null;
  const published = status === "published";

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("readiness")}</h3>
      <ul className="mb-4 space-y-2">
        <CheckRow ok={r.digest_approved} label={t("checkDigest")} />
        <CheckRow ok={r.reviewed} label={t("checkReviewed")} />
        <CheckRow ok={r.factcheck_resolved} label={t("checkFactcheck")} />
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {status === "approved" || published ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
            <IconCheck /> {t("statusApproved")}
          </span>
        ) : (
          <Button onClick={() => approve.mutate()} disabled={!r.can_approve || approve.isPending}>
            {r.can_approve ? <IconCheck /> : <IconLock />}
            {t("approve")}
          </Button>
        )}
        {published ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white">
            <IconCheck /> {t("published")}
          </span>
        ) : (
          <Button variant="outline" onClick={() => publish.mutate()} disabled={!r.can_publish || publish.isPending}>
            {t("publish")}
          </Button>
        )}
      </div>
    </Card>
  );
}
