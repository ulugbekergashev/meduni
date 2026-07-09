"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import CourseList from "@/components/CourseList";
import { IconCheck, IconHome, IconUsers } from "@/components/Icons";
import Shell from "@/components/Shell";
import { Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Tasks = { pending_cases: number; content_in_review: number };

export default function TeacherDashboard() {
  const { me } = useRequireRole("teacher");
  const t = useTranslations("dash");
  const tn = useTranslations("nav");
  const tr = useTranslations("review");
  const ta = useTranslations("analytics");

  const { data: tasks } = useQuery({
    queryKey: ["/teach/tasks"], queryFn: () => api<Tasks>("/teach/tasks"), enabled: !!me,
  });

  if (!me) return null;
  const hasTasks = tasks && (tasks.pending_cases > 0 || tasks.content_in_review > 0);

  return (
    <Shell
      me={me}
      variant="sidebar"
      nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome />, exact: true },
            { href: "/teach/cases/review", label: tr("queue"), icon: <IconUsers /> }]}
    >
      <PageHeader title={t("teacherTitle")} subtitle={t("welcome", { name: me.full_name })} />

      {/* Задачи */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{ta("tasks")}</h2>
        {hasTasks ? (
          <div className="space-y-2">
            {tasks!.pending_cases > 0 && (
              <Link href="/teach/cases/review"
                    className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100">
                <IconUsers className="text-base" /> {ta("casesToReview", { n: tasks!.pending_cases })}
              </Link>
            )}
            {tasks!.content_in_review > 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <IconCheck className="text-base" /> {ta("contentToApprove", { n: tasks!.content_in_review })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{ta("noTasks")}</p>
        )}
      </Card>

      <CourseList hrefBase="/teach/courses" />
    </Shell>
  );
}
