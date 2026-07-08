"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/lib/api";

export type Course = {
  id: number;
  semester: number;
  academic_year: string;
  subject_name_uz: string;
  subject_name_ru: string;
  teacher_name: string;
  groups: { id: number; name: string }[];
};

export default function CourseList() {
  const t = useTranslations("dash");
  const ta = useTranslations("admin");
  const locale = useLocale();
  const { data: courses, isLoading } = useQuery({
    queryKey: ["me", "courses"],
    queryFn: () => api<Course[]>("/me/courses"),
  });

  if (isLoading) return null;
  if (!courses?.length) {
    return <p className="rounded-lg border border-dashed bg-white p-6 text-slate-500">{t("noCourses")}</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {courses.map((course) => (
        <li key={course.id} className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="font-semibold">
            {locale === "ru" ? course.subject_name_ru : course.subject_name_uz}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {ta("semester")} {course.semester} · {course.academic_year}
          </p>
          <p className="text-sm text-slate-500">{course.teacher_name}</p>
          {course.groups.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              {course.groups.map((g) => g.name).join(", ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
