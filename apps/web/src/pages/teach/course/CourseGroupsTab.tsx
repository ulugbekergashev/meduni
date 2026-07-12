import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GraduationCap, Users2 } from "lucide-react";
import { Card, Icon, Spinner } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { useLocale, pickName } from "../../../lib/useLocale";
import { useCourseGroupsStats } from "../api";

// Which groups this course is taught in — each card opens the group profile.
export function CourseGroupsTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "courseGroups" });
  const locale = useLocale();
  const navigate = useNavigate();

  const q = useCourseGroupsStats(courseId);
  const groups = q.data ?? [];

  return (
    <div>
      <p className="mb-4 text-[13px] text-ink-soft">{t("subtitle")}</p>
      {q.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
      ) : (
        <AsyncSection
          isLoading={false}
          isError={q.isError}
          isEmpty={groups.length === 0}
          emptyIcon={<Icon icon={Users2} size={22} />}
          emptyText={t("empty")}
          onRetry={() => q.refetch()}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Card key={g.groupId} interactive onClick={() => navigate(`/teach/groups/${g.groupId}`)} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold text-ink">{g.name}</h3>
                    <p className="truncate text-[12px] text-ink-faint">
                      {t("yearN", { n: g.yearOfStudy })} · {pickName(locale, g.facultyNameUz, g.facultyNameRu)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                    <Icon icon={Users2} size={18} />
                  </div>
                </div>
                <div className="mt-auto space-y-1.5">
                  <div className="flex items-center justify-between text-[12.5px] text-ink-soft">
                    <span className="inline-flex items-center gap-1.5"><Icon icon={GraduationCap} size={14} /> {t("studentsN", { n: g.studentCount })}</span>
                    <span className="font-semibold text-ink">{g.avgProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg">
                    <div className="h-full rounded-pill bg-gradient-to-r from-brand to-brand-deep transition-all" style={{ width: `${Math.max(g.avgProgress, 2)}%` }} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </AsyncSection>
      )}
    </div>
  );
}
