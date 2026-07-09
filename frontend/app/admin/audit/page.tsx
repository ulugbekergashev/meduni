"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Badge, PageHeader, Table, td, th } from "@/components/ui";
import { api } from "@/lib/api";

type Log = {
  id: number; actor: string; action: string; entity: string;
  entity_id: number | null; payload: string | null; ts: string;
};

export default function AuditPage() {
  const t = useTranslations("analytics");

  const { data } = useQuery({
    queryKey: ["/admin/audit"],
    queryFn: () => api<Log[]>("/admin/audit"),
  });

  return (
    <div>
      <PageHeader title={t("audit")} />
      <Table
        head={
          <>
            <th className={th}>{t("when")}</th>
            <th className={th}>{t("actor")}</th>
            <th className={th}>{t("action")}</th>
            <th className={th}>{t("department")}</th>
          </>
        }
      >
        {data?.map((log) => (
          <tr key={log.id} className="hover:bg-slate-50/60">
            <td className={`${td} whitespace-nowrap text-slate-500`}>
              {new Date(log.ts).toLocaleString()}
            </td>
            <td className={td}>{log.actor}</td>
            <td className={td}><Badge tone="slate">{log.action}</Badge></td>
            <td className={`${td} text-slate-500`}>
              {log.entity}{log.entity_id ? ` #${log.entity_id}` : ""}
              {log.payload ? ` · ${log.payload}` : ""}
            </td>
          </tr>
        ))}
        {data?.length === 0 && (
          <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">—</td></tr>
        )}
      </Table>
    </div>
  );
}
