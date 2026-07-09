"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Card, PageHeader, Table, td, th } from "@/components/ui";
import { api } from "@/lib/api";

type Stats = {
  students: number; teachers: number; courses: number;
  topics_published: number; content_published: number;
  pending_cases: number; tokens_this_month: number;
};
type Usage = {
  department_id: number; name_uz: string; name_ru: string;
  tokens: number; generations: number; quota: number;
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </Card>
  );
}

export default function AdminDashboard() {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [quotaEdits, setQuotaEdits] = useState<Record<number, string>>({});

  const { data: stats } = useQuery({ queryKey: ["/admin/stats"], queryFn: () => api<Stats>("/admin/stats") });
  const { data: usage } = useQuery({ queryKey: ["/admin/ai-usage"], queryFn: () => api<Usage[]>("/admin/ai-usage") });

  const saveQuota = useMutation({
    mutationFn: (payload: { department_id: number; monthly_tokens: number }) =>
      api("/admin/quotas", { method: "PUT", body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/admin/ai-usage"] }),
  });

  return (
    <div>
      <PageHeader title={t("dashboard")} />

      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t("students")} value={stats.students} />
          <StatCard label={t("teachers")} value={stats.teachers} />
          <StatCard label={t("courses")} value={stats.courses} />
          <StatCard label={t("topicsPublished")} value={stats.topics_published} />
          <StatCard label={t("contentPublished")} value={stats.content_published} />
          <StatCard label={t("pendingCases")} value={stats.pending_cases} />
          <StatCard label={t("tokensMonth")} value={stats.tokens_this_month} />
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-slate-800">{t("aiUsage")}</h2>
      <Table
        head={
          <>
            <th className={th}>{t("department")}</th>
            <th className={th}>{t("tokens")}</th>
            <th className={th}>{t("generations")}</th>
            <th className={th}>{t("quota")}</th>
            <th className={th}></th>
          </>
        }
      >
        {usage?.map((row) => {
          const over = row.quota > 0 && row.tokens >= row.quota;
          return (
            <tr key={row.department_id} className="hover:bg-slate-50/60">
              <td className={td}>{locale === "ru" ? row.name_ru : row.name_uz}</td>
              <td className={`${td} ${over ? "font-semibold text-rose-600" : ""}`}>
                {row.tokens.toLocaleString()}
              </td>
              <td className={td}>{row.generations}</td>
              <td className={td}>
                <input
                  type="number"
                  defaultValue={row.quota || ""}
                  placeholder={t("noLimit")}
                  onChange={(e) => setQuotaEdits({ ...quotaEdits, [row.department_id]: e.target.value })}
                  className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </td>
              <td className={td}>
                <button
                  onClick={() => saveQuota.mutate({
                    department_id: row.department_id,
                    monthly_tokens: Number(quotaEdits[row.department_id] ?? row.quota) || 0,
                  })}
                  className="rounded-md bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700"
                >
                  {t("saveQuota")}
                </button>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
