"use client";

import { useTranslations } from "next-intl";
import CourseList from "@/components/CourseList";
import Shell from "@/components/Shell";
import { useRequireRole } from "@/lib/useAuth";

export default function StudentDashboard() {
  const { me } = useRequireRole("student");
  const t = useTranslations("dash");

  if (!me) return null;
  return (
    <Shell me={me}>
      <h1 className="mb-1 text-2xl font-bold">{t("studentTitle")}</h1>
      <p className="mb-6 text-slate-500">{t("welcome", { name: me.full_name })}</p>
      <h2 className="mb-3 text-lg font-semibold">{t("myCourses")}</h2>
      <CourseList />
    </Shell>
  );
}
