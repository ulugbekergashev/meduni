import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Users } from "lucide-react";
import { Badge, Card, Icon } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { pickName, useLocale } from "../../lib/useLocale";
import { useTeachCourses } from "./api";

export function TeachDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const locale = useLocale();
  const navigate = useNavigate();
  const list = useTeachCourses();
  const courses = list.data ?? [];

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("myCourses")}</h1>

      <div className="mt-6">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={courses.length === 0}
          emptyIcon={<Icon icon={BookOpen} size={22} />}
          emptyText={t("empty")}
          onRetry={() => list.refetch()}
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id}>
                <Card interactive onClick={() => navigate(`/teach/courses/${c.id}`)} className="h-full">
                  <div className="mb-3 flex h-14 items-end rounded-control bg-gradient-to-br from-brand to-brand-deep px-3 pb-2">
                    <span className="line-clamp-1 text-[15px] font-bold text-white">
                      {pickName(locale, c.subjectNameUz, c.subjectNameRu)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="brand">
                      {t("semester")} {c.semester}
                    </Badge>
                    <Badge tone="slate">{c.academicYear}</Badge>
                    {c.groups.map((g) => (
                      <Badge key={g.id} tone="slate">
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-soft">
                    <Icon icon={Users} size={15} />
                    {c.studentCount} {t("students")}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </AsyncSection>
      </div>
    </div>
  );
}
