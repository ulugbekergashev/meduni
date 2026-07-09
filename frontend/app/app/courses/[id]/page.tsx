"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconArrowLeft, IconCheck, IconChevronRight, IconLock } from "@/components/Icons";
import Shell from "@/components/Shell";
import { Card, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Node = {
  id: number;
  title_uz: string;
  title_ru: string;
  order_index: number;
  state: "locked" | "available" | "in_progress" | "completed";
  video_pct: number;
};
type CourseMap = {
  course_id: number;
  subject_name_uz: string;
  subject_name_ru: string;
  teacher_name: string;
  topics: Node[];
  completed_count: number;
  total_count: number;
};

const stateStyles = {
  completed: { dot: "bg-emerald-500 text-white", ring: "ring-emerald-200", label: "completed" },
  in_progress: { dot: "bg-teal-500 text-white", ring: "ring-teal-200", label: "inProgress" },
  available: { dot: "bg-teal-500 text-white", ring: "ring-teal-200", label: "available" },
  locked: { dot: "bg-slate-200 text-slate-400", ring: "ring-slate-100", label: "locked" },
} as const;

export default function StudentCoursePage() {
  const { me } = useRequireRole("student");
  const t = useTranslations("learn");
  const locale = useLocale();
  const params = useParams();
  const courseId = Number(params.id);

  const { data } = useQuery({
    queryKey: ["course-map", courseId],
    queryFn: () => api<CourseMap>(`/me/learn/courses/${courseId}`),
    enabled: !!me,
  });

  if (!me || !data) return null;
  const pct = data.total_count ? Math.round((100 * data.completed_count) / data.total_count) : 0;

  return (
    <Shell me={me} variant="top">
      <Link href="/app" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700">
        <IconArrowLeft className="text-base" /> {t("courseMap")}
      </Link>

      <div className="mb-6 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 px-5 py-5 text-white shadow-sm">
        <h1 className="text-xl font-bold">{locale === "ru" ? data.subject_name_ru : data.subject_name_uz}</h1>
        <p className="mt-0.5 text-sm text-teal-100">{data.teacher_name}</p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-teal-100">
            <span>{t("progress", { done: data.completed_count, total: data.total_count })}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Путь тем */}
      <ol className="relative space-y-2 pl-2">
        {data.topics.map((node, i) => {
          const s = stateStyles[node.state];
          const locked = node.state === "locked";
          const isLast = i === data.topics.length - 1;
          const card = (
            <Card className={cls("flex items-center gap-3 p-3 ring-1", s.ring,
              locked ? "opacity-70" : "transition-shadow hover:shadow-md")}>
              <div className="min-w-0 flex-1">
                <p className={cls("truncate font-medium", locked ? "text-slate-400" : "text-slate-800")}>
                  {locale === "ru" ? node.title_ru : node.title_uz}
                </p>
                <p className="text-xs text-slate-400">
                  {t(s.label)}
                  {node.state === "in_progress" && node.video_pct > 0 && ` · ${t("watchedPct", { pct: node.video_pct })}`}
                </p>
              </div>
              {locked ? <IconLock className="text-slate-300" />
                : <IconChevronRight className="text-slate-400" />}
            </Card>
          );
          return (
            <li key={node.id} className="relative flex items-start gap-3">
              {/* соединительная линия + узел */}
              <div className="flex flex-col items-center">
                <span className={cls("z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", s.dot)}>
                  {node.state === "completed" ? <IconCheck className="text-sm" /> : i + 1}
                </span>
                {!isLast && <span className="w-0.5 grow bg-slate-200" style={{ minHeight: 16 }} />}
              </div>
              <div className="flex-1 pb-2">
                {locked ? card : <Link href={`/app/topics/${node.id}`}>{card}</Link>}
              </div>
            </li>
          );
        })}
      </ol>
    </Shell>
  );
}
