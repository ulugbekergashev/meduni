import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GraduationCap, Users2 } from "lucide-react";
import { Card, Icon } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useTeachGroups } from "./api";

// Simple grid of group cards — click opens the group profile.
export function TeachGroupsPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "groups" });
  const navigate = useNavigate();
  const q = useTeachGroups();
  const groups = q.data ?? [];

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-[13px] text-ink-soft">{t("subtitle")}</p>

      <div className="mt-6">
        <AsyncSection
          isLoading={q.isLoading}
          isError={q.isError}
          isEmpty={groups.length === 0}
          emptyIcon={<Icon icon={Users2} size={22} />}
          emptyText={t("empty")}
          onRetry={() => q.refetch()}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Card key={g.id} interactive onClick={() => navigate(`/teach/groups/${g.id}`)} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold text-ink">{g.name}</h3>
                    <p className="truncate text-[12px] text-ink-faint">
                      {t("yearN", { n: g.yearOfStudy })} · {g.facultyName}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                    <Icon icon={Users2} size={18} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.courses.map((c) => (
                    <span key={c.id} className="rounded-pill bg-bg px-2 py-0.5 text-[12px] text-ink-soft">{c.name}</span>
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-[13px] text-ink-soft">
                  <Icon icon={GraduationCap} size={15} /> {t("studentsN", { n: g.studentCount })}
                </div>
              </Card>
            ))}
          </div>
        </AsyncSection>
      </div>
    </div>
  );
}
