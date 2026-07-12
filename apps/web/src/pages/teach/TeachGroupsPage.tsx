import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, CalendarCheck, ChevronDown, GraduationCap, Mail, NotebookPen, Users2 } from "lucide-react";
import { Card, Icon, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale, pickName } from "../../lib/useLocale";
import { useTeachGroups, type TeachGroup } from "./api";

function GroupCard({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groups" });
  const locale = useLocale();
  const navigate = useNavigate();
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

      {/* Courses with quick actions: Jurnal / Yo'qlama / Progress */}
      <div className="space-y-2 px-4 pb-3">
        {group.courses.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint">{t("noCourses")}</p>
        ) : (
          group.courses.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-bg px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{pickName(locale, c.nameUz, c.nameRu)}</span>
              <button
                onClick={() => navigate(`/teach/courses/${c.id}/sessions?sub=journal`)}
                className="inline-flex items-center gap-1 rounded-control bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand-deep transition-colors hover:bg-brand/10"
              >
                <Icon icon={NotebookPen} size={13} /> {t("journal")}
              </button>
              <button
                onClick={() => navigate(`/teach/courses/${c.id}/sessions`)}
                className="inline-flex items-center gap-1 rounded-control bg-amber-soft px-2.5 py-1 text-[12px] font-semibold text-amber transition-colors hover:bg-amber/10"
              >
                <Icon icon={CalendarCheck} size={13} /> {t("attendance")}
              </button>
              <button
                onClick={() => navigate(`/teach/courses/${c.id}/progress`)}
                className="inline-flex items-center gap-1 rounded-control bg-blue-soft px-2.5 py-1 text-[12px] font-semibold text-blue transition-colors hover:bg-blue/10"
              >
                <Icon icon={BarChart3} size={13} /> {t("progress")}
              </button>
            </div>
          ))
        )}
      </div>

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
