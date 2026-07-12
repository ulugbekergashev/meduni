import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BarChart3, CalendarDays, ChevronRight, GraduationCap, NotebookPen, Users2 } from "lucide-react";
import { Card, Icon, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { useLocale, pickName } from "../../../lib/useLocale";
import { useTeachGroup, type TeachGroup } from "../api";
import { JournalView } from "../course/attendance/JournalView";
import { SessionsView } from "../course/attendance/SessionsView";
import { ReportView } from "../course/attendance/ReportView";

type TabKey = "students" | "journal" | "sessions" | "report";

const TABS: { key: TabKey; icon: typeof Users2 }[] = [
  { key: "students", icon: Users2 },
  { key: "journal", icon: NotebookPen },
  { key: "sessions", icon: CalendarDays },
  { key: "report", icon: BarChart3 },
];

function StudentsTab({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const navigate = useNavigate();

  if (group.students.length === 0) {
    return <Card><p className="py-8 text-center text-[13.5px] text-ink-soft">{t("noStudents")}</p></Card>;
  }
  return (
    <Card className="p-0">
      <ul>
        {group.students.map((s, i) => (
          <li key={s.id}>
            <button
              onClick={() => navigate(`/teach/students/${s.id}`)}
              className={cls("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg", i > 0 && "border-t border-line")}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-bold text-brand-deep">
                {s.fullName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{s.fullName}</p>
                <p className="truncate text-[12px] text-ink-faint">{s.email}</p>
              </div>
              <Icon icon={ChevronRight} size={16} className="shrink-0 text-ink-faint" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Course picker shown above journal/sessions/report when the group takes >1 course. */
function CoursePicker({ group, courseId, onPick }: { group: TeachGroup; courseId: number; onPick: (id: number) => void }) {
  const locale = useLocale();
  if (group.courses.length <= 1) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {group.courses.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c.id)}
          className={cls(
            "rounded-pill px-3 py-1.5 text-[13px] font-semibold transition-colors",
            c.id === courseId ? "bg-brand text-white" : "bg-surface text-ink-soft border border-line hover:bg-bg"
          )}
        >
          {pickName(locale, c.nameUz, c.nameRu)}
        </button>
      ))}
    </div>
  );
}

export function GroupProfile() {
  const { id } = useParams();
  const groupId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const locale = useLocale();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = useTeachGroup(groupId);
  const group = q.data;

  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = raw && TABS.some((x) => x.key === raw) ? raw : "students";
  const setTab = (k: TabKey) => setParams({ tab: k }, { replace: true });

  // Journal/sessions/report operate on one course of this group.
  const [courseId, setCourseId] = useState<number | null>(null);
  const activeCourseId = courseId ?? group?.courses[0]?.id ?? null;

  return (
    <div>
      <button onClick={() => navigate("/teach/groups")} className="mb-3 flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {group && (
            <>
              {/* Profile header */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                  <Icon icon={Users2} size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-h1 font-bold text-ink">{group.name}</h1>
                  <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-soft">
                    <span>{t("yearN", { n: group.yearOfStudy })}</span>
                    <span>·</span>
                    <span>{pickName(locale, group.facultyNameUz, group.facultyNameRu)}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Icon icon={GraduationCap} size={14} /> {t("studentsN", { n: group.studentCount })}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.courses.map((c) => (
                    <button key={c.id} onClick={() => navigate(`/teach/courses/${c.id}`)} className="rounded-pill bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-brand-deep transition-colors hover:bg-brand/10">
                      {pickName(locale, c.nameUz, c.nameRu)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
                {TABS.map((x) => (
                  <button
                    key={x.key}
                    onClick={() => setTab(x.key)}
                    className={cls(
                      "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
                      tab === x.key ? "border-brand text-brand-deep" : "border-transparent text-ink-soft hover:text-ink"
                    )}
                  >
                    <Icon icon={x.icon} size={16} />
                    {t(`tabs.${x.key}`)}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                {tab === "students" && <StudentsTab group={group} />}
                {tab !== "students" && activeCourseId === null && (
                  <Card><p className="py-8 text-center text-[13.5px] text-ink-soft">{t("noCourses")}</p></Card>
                )}
                {tab !== "students" && activeCourseId !== null && (
                  <>
                    <CoursePicker group={group} courseId={activeCourseId} onPick={setCourseId} />
                    {tab === "journal" && <JournalView courseId={activeCourseId} groupId={groupId} />}
                    {tab === "sessions" && <SessionsView courseId={activeCourseId} groupId={groupId} />}
                    {tab === "report" && <ReportView courseId={activeCourseId} groupId={groupId} />}
                  </>
                )}
              </div>
            </>
          )}
        </AsyncSection>
      )}
    </div>
  );
}
