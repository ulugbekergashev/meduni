"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "./ui";
import { api } from "@/lib/api";

type Heatmap = {
  topics: { id: number; title_uz: string; title_ru: string }[];
  rows: { student_id: number; name: string; cells: string[] }[];
};

const cellColor: Record<string, string> = {
  completed: "bg-emerald-500",
  in_progress: "bg-teal-300",
  available: "bg-slate-200",
  locked: "bg-slate-100",
};

export default function ProgressHeatmap({ courseId }: { courseId: number }) {
  const t = useTranslations("analytics");
  const tl = useTranslations("learn");
  const locale = useLocale();

  const { data } = useQuery({
    queryKey: ["heatmap", courseId],
    queryFn: () => api<Heatmap>(`/teach/courses/${courseId}/heatmap`),
  });

  if (!data || data.rows.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-slate-800">{t("heatmap")}</h2>
      <Card className="overflow-x-auto p-4">
        <table className="border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white" />
              {data.topics.map((topic, i) => (
                <th key={topic.id} className="px-1 pb-1 text-center font-medium text-slate-400"
                    title={locale === "ru" ? topic.title_ru : topic.title_uz}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.student_id}>
                <td className="sticky left-0 whitespace-nowrap bg-white pr-2 text-slate-600">{row.name}</td>
                {row.cells.map((state, j) => (
                  <td key={j}>
                    <span className={`block h-6 w-6 rounded ${cellColor[state] ?? "bg-slate-100"}`}
                          title={tl(state as never)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {/* легенда */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          {(["completed", "in_progress", "available", "locked"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${cellColor[s]}`} /> {tl(s)}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
