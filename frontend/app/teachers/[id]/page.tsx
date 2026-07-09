"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconLogo } from "@/components/Icons";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Avatar, Badge, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/useAuth";

type Course = {
  id: number; semester: number; academic_year: string;
  subject_name_uz: string; subject_name_ru: string;
};
type TeacherPage = {
  id: number; full_name: string; avatar_url: string | null;
  department_name_uz: string; department_name_ru: string;
  position: string | null; bio: string | null; courses: Course[];
};

export default function TeacherPage() {
  const t = useTranslations("teacherPage");
  const locale = useLocale();
  const params = useParams();
  const { data: me } = useMe();

  const { data } = useQuery({
    queryKey: ["teacher", params.id],
    queryFn: () => api<TeacherPage>(`/public/teachers/${params.id}`),
  });

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href={me ? "/" : "/login"} className="flex items-center gap-2">
            <IconLogo className="text-2xl text-teal-600" />
            <span className="text-lg font-bold text-slate-900">MedUni AI</span>
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Card className="mb-8 flex flex-wrap items-center gap-5 p-6">
          <div className="scale-150"><Avatar name={data.full_name} /></div>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-slate-900">{data.full_name}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {data.position && <span>{data.position} · </span>}
              {locale === "ru" ? data.department_name_ru : data.department_name_uz}
            </p>
          </div>
        </Card>

        {data.bio && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-semibold text-slate-800">{t("bio")}</h2>
            <p className="text-sm text-slate-600">{data.bio}</p>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">{t("courses")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.courses.map((course) => (
              <Card key={course.id} className="p-4">
                <p className="font-medium text-slate-800">
                  {locale === "ru" ? course.subject_name_ru : course.subject_name_uz}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="teal">{course.semester} sem</Badge>
                  <Badge tone="slate">{course.academic_year}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
