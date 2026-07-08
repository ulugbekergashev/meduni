"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { IconBook } from "./Icons";
import { Badge, Card, cls } from "./ui";
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

const coverPalette = [
  "from-teal-500 to-emerald-600",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-500",
];

export default function CourseList({ hrefBase }: { hrefBase?: string }) {
  const t = useTranslations("dash");
  const ta = useTranslations("admin");
  const locale = useLocale();
  const { data: courses, isLoading } = useQuery({
    queryKey: ["me", "courses"],
    queryFn: () => api<Course[]>("/me/courses"),
  });

  if (isLoading) return null;
  if (!courses?.length) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-2xl text-teal-600">
          <IconBook />
        </div>
        <p className="max-w-xs text-sm text-slate-500">{t("noCourses")}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {courses.map((course) => {
        const name = locale === "ru" ? course.subject_name_ru : course.subject_name_uz;
        const cover = coverPalette[course.id % coverPalette.length];
        const card = (
          <Card className={cls("overflow-hidden transition-shadow hover:shadow-md", hrefBase && "cursor-pointer")}>
            <div className={`flex h-20 items-end bg-gradient-to-br ${cover} px-4 pb-3`}>
              <span className="line-clamp-1 text-lg font-bold text-white drop-shadow-sm">{name}</span>
            </div>
            <div className="space-y-2 px-4 py-3">
              <p className="text-sm text-slate-600">{course.teacher_name}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="teal">
                  {ta("semester")} {course.semester}
                </Badge>
                <Badge tone="slate">{course.academic_year}</Badge>
                {course.groups.map((g) => (
                  <Badge key={g.id} tone="slate">
                    {g.name}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        );
        return (
          <li key={course.id}>
            {hrefBase ? <Link href={`${hrefBase}/${course.id}`}>{card}</Link> : card}
          </li>
        );
      })}
    </ul>
  );
}
