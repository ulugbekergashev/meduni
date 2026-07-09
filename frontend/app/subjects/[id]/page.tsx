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
  subject_name_uz: string; subject_name_ru: string; teacher_name: string;
};
type SubjectPage = {
  id: number; name_uz: string; name_ru: string; description: string | null;
  department_name_uz: string; department_name_ru: string;
  teachers: { id: number; full_name: string; avatar_url: string | null }[];
  courses: Course[];
};

export default function SubjectPage() {
  const t = useTranslations("subject");
  const locale = useLocale();
  const params = useParams();
  const { data: me } = useMe();

  const { data } = useQuery({
    queryKey: ["subject", params.id],
    queryFn: () => api<SubjectPage>(`/public/subjects/${params.id}`),
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
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 px-6 py-8 text-white">
          <p className="text-sm text-teal-100">{locale === "ru" ? data.department_name_ru : data.department_name_uz}</p>
          <h1 className="mt-1 text-3xl font-bold">{locale === "ru" ? data.name_ru : data.name_uz}</h1>
          {data.description && <p className="mt-3 max-w-2xl text-teal-50">{data.description}</p>}
        </div>

        {data.teachers.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">{t("teachers")}</h2>
            <div className="flex flex-wrap gap-3">
              {data.teachers.map((teacher) => (
                <Link key={teacher.id} href={`/teachers/${teacher.id}`}>
                  <Card className="flex items-center gap-2.5 p-3 transition-shadow hover:shadow-md">
                    <Avatar name={teacher.full_name} />
                    <span className="text-sm font-medium text-slate-700">{teacher.full_name}</span>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">{t("courses")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.courses.map((course) => (
              <Card key={course.id} className="p-4">
                <p className="font-medium text-slate-800">{course.teacher_name}</p>
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
