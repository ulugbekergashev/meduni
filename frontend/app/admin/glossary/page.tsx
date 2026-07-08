"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import CrudTable from "@/components/CrudTable";
import { PageHeader, cls } from "@/components/ui";
import { api } from "@/lib/api";

type Named = { id: number; name_uz: string; name_ru: string };

export default function GlossaryPage() {
  const t = useTranslations("glossary");
  const locale = useLocale();
  const [departmentId, setDepartmentId] = useState<number | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["/departments"],
    queryFn: () => api<Named[]>("/departments"),
  });

  const departmentOptions = departments?.map((d) => ({
    value: d.id,
    label: locale === "ru" ? d.name_ru : d.name_uz,
  })) ?? [];

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Фильтр по кафедре — глоссарий обычно смотрят по одной кафедре */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setDepartmentId(null)}
          className={cls("rounded-lg px-3 py-1.5 text-sm font-medium",
            departmentId === null ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
        >
          {t("allDepartments")}
        </button>
        {departmentOptions.map((d) => (
          <button
            key={d.value}
            onClick={() => setDepartmentId(d.value)}
            className={cls("rounded-lg px-3 py-1.5 text-sm font-medium",
              departmentId === d.value ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            {d.label}
          </button>
        ))}
      </div>

      <CrudTable
        key={departmentId ?? "all"}
        endpoint={departmentId ? `/glossary?department_id=${departmentId}` : "/glossary"}
        createEndpoint="/glossary"
        fields={[
          {
            key: "department_id", label: t("department"), type: "select",
            options: departmentOptions, defaultValue: departmentId ?? undefined,
            render: (row) => departmentOptions.find((o) => o.value === row.department_id)?.label ?? String(row.department_id),
          },
          { key: "term_ru", label: t("termRu") },
          { key: "term_uz", label: t("termUz") },
          { key: "term_lat", label: t("termLat"), required: false },
        ]}
      />
    </div>
  );
}
