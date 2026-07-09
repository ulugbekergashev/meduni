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
    <Shell me={me} variant="top">
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 px-5 py-6 text-white shadow-sm">
        <h1 className="text-xl font-bold sm:text-2xl">{t("welcome", { name: me.full_name.split(" ")[0] })}</h1>
        <p className="mt-1 text-sm text-teal-100">{t("studentTitle")}</p>
      </div>
      <h2 className="mb-3 text-lg font-semibold text-slate-800">{t("myCourses")}</h2>
      <CourseList hrefBase="/app/courses" />
    </Shell>
  );
}
