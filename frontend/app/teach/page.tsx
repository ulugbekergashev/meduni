"use client";

import { useTranslations } from "next-intl";
import CourseList from "@/components/CourseList";
import { IconHome } from "@/components/Icons";
import Shell from "@/components/Shell";
import { PageHeader } from "@/components/ui";
import { useRequireRole } from "@/lib/useAuth";

export default function TeacherDashboard() {
  const { me } = useRequireRole("teacher");
  const t = useTranslations("dash");
  const tn = useTranslations("nav");

  if (!me) return null;
  return (
    <Shell
      me={me}
      variant="sidebar"
      nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome /> }]}
    >
      <PageHeader title={t("teacherTitle")} subtitle={t("welcome", { name: me.full_name })} />
      <CourseList hrefBase="/teach/courses" />
    </Shell>
  );
}
