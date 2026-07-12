import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, GraduationCap, NotebookPen, Users2 } from "lucide-react";
import { Card, Icon, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale, pickName } from "../../lib/useLocale";
import { useTeachGroups, type TeachGroup } from "./api";

function GroupCard({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groups" });
  const locale = useLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

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

      {open && (
        <div className="border-t border-line">
          {/* Students — click to open the full student page */}
          {group.students.length === 0 ? (
            <p className="px-4 py-4 text-center text-[13px] text-ink-faint">{t("noStudents")}</p>
          ) : (
            <ul>
              {group.students.map((s, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => navigate(`/teach/students/${s.id}`)}
                    className={cls("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg", i > 0 && "border-t border-line")}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-ink-soft">
                      {s.fullName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-ink">{s.fullName}</p>
                      <p className="truncate text-[12px] text-ink-faint">{s.email}</p>
                    </div>
                    <Icon icon={ChevronRight} size={16} className="shrink-0 text-ink-faint" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* One group-level shortcut: the journal (attendance + grades) */}
          {group.courses.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
              {group.courses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/teach/courses/${c.id}/sessions?sub=journal`)}
                  className="inline-flex items-center gap-1.5 rounded-control bg-brand-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand-deep transition-colors hover:bg-brand/10"
                >
                  <Icon icon={NotebookPen} size={14} /> {t("journalOf", { name: pickName(locale, c.nameUz, c.nameRu) })}
                </button>
              ))}
            </div>
          )}
          {group.courses.length === 0 && <p className="border-t border-line px-4 py-3 text-[12px] text-ink-faint">{t("noCourses")}</p>}
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
