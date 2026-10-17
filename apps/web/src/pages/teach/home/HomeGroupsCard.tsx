import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users2 } from "lucide-react";
import { EmptyState, Icon, cls } from "@meduni/ui";
import { BentoCard, BentoRow } from "../../../components/bento";
import { useTeachGroups } from "../api";

/** Bosh sahifada ko'rinadigan guruhlar — qolgani "Barchasi" ortida. */
const MAX_GROUPS = 4;

/** Mening guruhlarim — har guruh: talabalar soni, o'rtacha progress, orqada qolganlar. */
export function HomeGroupsCard() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();
  const q = useTeachGroups();
  const groups = q.data ?? [];

  return (
    <BentoCard
      title={t("myGroups")}
      count={groups.length}
      action={{ label: t("seeAll"), onClick: () => navigate("/teach/groups") }}
      isLoading={q.isLoading}
      isError={q.isError}
      onRetry={() => q.refetch()}
      bodyClassName="px-2 pb-3"
    >
      {groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-2 py-4">
          <EmptyState icon={<Icon icon={Users2} size={20} />} text={t("noGroups")} />
        </div>
      ) : (
        <ul className="space-y-0.5">
          {groups.slice(0, MAX_GROUPS).map((g) => (
            <li key={g.id}>
              <BentoRow
                icon={Users2}
                iconTone="bg-blue-soft text-blue"
                title={g.name}
                sub={
                  <>
                    {t("studentsN", { n: g.studentCount })}
                    {g.behindCount > 0 && <span className="text-rose"> · {t("behindN", { n: g.behindCount })}</span>}
                  </>
                }
                right={<span className={cls(g.studentCount === 0 && "text-ink-faint")}>{g.avgProgress}%</span>}
                onClick={() => navigate(`/teach/groups/${g.id}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}
