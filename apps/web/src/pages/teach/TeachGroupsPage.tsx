import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, GraduationCap, Mail, Users2 } from "lucide-react";
import { Card, Icon, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale, pickName } from "../../lib/useLocale";
import { useTeachGroups, type TeachGroup } from "./api";

function GroupCard({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groups" });
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          <Icon icon={Users2} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-ink">{group.name}</p>
          <p className="truncate text-[12.5px] text-ink-faint">
            {t("yearN", { n: group.yearOfStudy })} · {pickName(locale, group.facultyNameUz, group.facultyNameRu)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-blue-soft px-2.5 py-1 text-[12.5px] font-semibold text-blue">
          <Icon icon={GraduationCap} size={14} /> {group.studentCount}
        </span>
        <Icon icon={ChevronDown} size={18} className={cls("shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>

      {/* Subjects this teacher gives the group */}
      {group.subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {group.subjects.map((s) => (
            <span key={s.uz} className="rounded-pill bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-brand-deep">{pickName(locale, s.uz, s.ru)}</span>
          ))}
        </div>
      )}

      {open && (
        <div className="border-t border-line">
          {group.students.length === 0 ? (
            <p className="px-4 py-4 text-center text-[13px] text-ink-faint">{t("noStudents")}</p>
          ) : (
            <ul>
              {group.students.map((s, i) => (
                <li key={s.id} className={cls("flex items-center gap-3 px-4 py-2.5", i > 0 && "border-t border-line")}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-ink-soft">
                    {s.fullName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{s.fullName}</p>
                    <p className="flex items-center gap-1 truncate text-[12px] text-ink-faint"><Icon icon={Mail} size={11} /> {s.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export function TeachGroupsPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "groups" });
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
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.map((g) => <GroupCard key={g.id} group={g} />)}
          </div>
        </AsyncSection>
      </div>
    </div>
  );
}
