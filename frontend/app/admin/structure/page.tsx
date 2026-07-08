"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import CrudTable from "@/components/CrudTable";
import { api } from "@/lib/api";

type Named = { id: number; name_uz: string; name_ru: string };

export default function StructurePage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [tab, setTab] = useState<"faculties" | "departments" | "subjects" | "groups">("faculties");

  const { data: faculties } = useQuery({
    queryKey: ["/faculties"],
    queryFn: () => api<Named[]>("/faculties"),
  });
  const { data: departments } = useQuery({
    queryKey: ["/departments"],
    queryFn: () => api<Named[]>("/departments"),
  });

  const facultyOptions = faculties?.map((f) => ({
    value: f.id,
    label: locale === "ru" ? f.name_ru : f.name_uz,
  })) ?? [];
  const departmentOptions = departments?.map((d) => ({
    value: d.id,
    label: locale === "ru" ? d.name_ru : d.name_uz,
  })) ?? [];
  const lookup = (options: { value: number; label: string }[], key: string) =>
    (row: Record<string, unknown>) =>
      options.find((o) => o.value === row[key])?.label ?? String(row[key]);

  const tabs = [
    { id: "faculties", label: t("faculties") },
    { id: "departments", label: t("departments") },
    { id: "subjects", label: t("subjects") },
    { id: "groups", label: t("groups") },
  ] as const;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
      <div className="mb-4 flex gap-2 border-b">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === id ? "border-sky-600 font-semibold text-sky-700" : "border-transparent text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "faculties" && (
        <CrudTable
          endpoint="/faculties"
          fields={[
            { key: "name_uz", label: t("nameUz") },
            { key: "name_ru", label: t("nameRu") },
          ]}
        />
      )}
      {tab === "departments" && (
        <CrudTable
          endpoint="/departments"
          fields={[
            { key: "faculty_id", label: t("faculty"), type: "select", options: facultyOptions,
              render: lookup(facultyOptions, "faculty_id") },
            { key: "name_uz", label: t("nameUz") },
            { key: "name_ru", label: t("nameRu") },
          ]}
        />
      )}
      {tab === "subjects" && (
        <CrudTable
          endpoint="/subjects"
          fields={[
            { key: "department_id", label: t("department"), type: "select", options: departmentOptions,
              render: lookup(departmentOptions, "department_id") },
            { key: "name_uz", label: t("nameUz") },
            { key: "name_ru", label: t("nameRu") },
          ]}
        />
      )}
      {tab === "groups" && (
        <CrudTable
          endpoint="/groups"
          fields={[
            { key: "faculty_id", label: t("faculty"), type: "select", options: facultyOptions,
              render: lookup(facultyOptions, "faculty_id") },
            { key: "name", label: t("group") },
            { key: "year_of_study", label: t("yearOfStudy"), type: "number" },
          ]}
        />
      )}
    </div>
  );
}
