"use client";

import { useTranslations } from "next-intl";
import CourseList from "@/components/CourseList";
import Shell from "@/components/Shell";
import { useRequireRole } from "@/lib/useAuth";

export default function TeacherDashboard() {
  const { me } = useRequireRole("teacher");
  const t = useTranslations("dash");

  if (!me) return null;
  return (
    <Shell me={me}>
      <h1 className="mb-1 text-2xl font-bold">{t("teacherTitle")}</h1>
      <p className="mb-6 text-slate-500">{t("welcome", { name: me.full_name })}</p>
      <CourseList />
    </Shell>
  );
}
