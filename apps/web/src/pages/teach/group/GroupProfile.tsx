import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BarChart3, CalendarDays, ChevronRight, GraduationCap, ListPlus, NotebookPen, Users2 } from "lucide-react";
import { Badge, Button, Card, Icon, ProgressBar, ProgressRing, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { QuickTaskModal } from "../../../components/QuickTaskModal";
import { useLocale } from "../../../lib/useLocale";
import { useTeachGroup, type GroupStudent, type TeachGroup } from "../api";
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

/** Group-level metric cards (progress ring + attendance + behind + count). */
function GroupStats({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Card className="flex items-center gap-3">
        <ProgressRing value={group.avgProgress} size={62} stroke={7} tone="brand" />
        <span className="text-note font-medium text-ink-soft">{t("avgProgress")}</span>
      </Card>
      <Card className="flex items-center gap-3">
        <ProgressRing value={group.avgAttendance ?? 0} size={62} stroke={7} tone="blue" />
        <span className="text-note font-medium text-ink-soft">{t("avgAttendance")}</span>
      </Card>
      <Card className={cls("flex flex-col justify-center", group.behindCount > 0 && "border-rose/30 bg-rose-soft")}>
        <span className={cls("text-[28px] font-bold leading-none tabular-nums", group.behindCount > 0 ? "text-rose" : "text-ink")}>{group.behindCount}</span>
        <span className="mt-1 text-note font-medium text-ink-soft">{t("behindCount")}</span>
      </Card>
      <Card className="flex flex-col justify-center">
        <span className="text-[28px] font-bold leading-none tabular-nums text-ink">{group.studentCount}</span>
        <span className="mt-1 text-note font-medium text-ink-soft">{t("studentsCount")}</span>
      </Card>
    </div>
  );
}

function StudentRow({
  s,
  onClick,
  onAssign,
  tRel,
}: {
  s: GroupStudent;
  onClick: () => void;
  onAssign: () => void;
  tRel: (iso: string | null) => string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const initials = s.fullName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
  const lowAtt = s.attendancePct !== null && s.attendancePct < 75;
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-bg">
      {/* Reyting o'rni — guruh ichidagi tartib (progress, keyin test balli) */}
      <span
        className={cls(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums",
          s.rank <= 3 ? "bg-brand-soft text-brand-deep" : "bg-bg text-ink-faint"
        )}
        title={t("rankHint")}
      >
        {s.rank}
      </span>
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-deep">{initials}</div>
        <div className="min-w-0 flex-[2]">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-medium text-ink">{s.fullName}</p>
            {s.behind && <Badge tone="rose">{t("behind")}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-note text-ink-faint">{tRel(s.lastActiveAt)}</p>
        </div>
        <div className="hidden min-w-0 flex-1 sm:block">
          <div className="flex items-center gap-2">
            <ProgressBar value={s.overallPct} className="flex-1" />
            <span className="w-9 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink-soft">{s.overallPct}%</span>
          </div>
        </div>
        <div className="hidden w-14 shrink-0 text-right sm:block">
          <span className="text-[13px] text-ink-faint">{t("quiz")}</span>
          <p className="text-[14px] font-bold tabular-nums text-ink">{s.avgQuizScore === null ? "—" : `${s.avgQuizScore}%`}</p>
        </div>
        <div className="w-14 shrink-0 text-right">
          <span className="text-[13px] text-ink-faint">{t("att")}</span>
          <p className={cls("text-[14px] font-bold tabular-nums", lowAtt ? "text-rose" : "text-ink")}>{s.attendancePct === null ? "—" : `${s.attendancePct}%`}</p>
        </div>
      </button>
      <button
        onClick={onAssign}
        title={t("assignToStudent")}
        aria-label={t("assignToStudent")}
        className="shrink-0 rounded-control p-1.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep"
      >
        <Icon icon={ListPlus} size={16} />
      </button>
      <Icon icon={ChevronRight} size={16} className="shrink-0 text-ink-faint" />
    </div>
  );
}

function StudentsTab({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const navigate = useNavigate();
  const locale = useLocale();
  const [assign, setAssign] = useState<{ studentId?: number; studentName?: string } | null>(null);

  const relTime = (iso: string | null) => {
    if (!iso) return t("neverActive");
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return t("activeToday");
    if (days === 1) return t("activeYesterday");
    return locale === "ru" ? `${days} дн. назад` : `${days} kun oldin`;
  };

  if (group.students.length === 0) {
    return <Card><p className="py-8 text-center text-body text-ink-soft">{t("noStudents")}</p></Card>;
  }
  // Behind students first, then by progress descending (rank raqami saqlanadi).
  const sorted = [...group.students].sort((a, b) => Number(b.behind) - Number(a.behind) || b.overallPct - a.overallPct);
  return (
    <>
      <div className="mb-2.5 flex justify-end">
        <Button variant="soft" size="sm" icon={<Icon icon={ListPlus} size={15} />} onClick={() => setAssign({})}>
          {t("assignToGroup")}
        </Button>
      </div>
      <Card className="divide-y divide-line p-0">
        {sorted.map((s) => (
          <StudentRow
            key={s.id}
            s={s}
            onClick={() => navigate(`/teach/students/${s.id}`)}
            onAssign={() => setAssign({ studentId: s.id, studentName: s.fullName })}
            tRel={relTime}
          />
        ))}
      </Card>

      <QuickTaskModal
        open={assign !== null}
        onClose={() => setAssign(null)}
        prefill={{ ...(assign ?? {}), groupId: group.id }}
      />
    </>
  );
}

/** Course picker shown above journal/sessions/report when the group takes >1 course. */
function CoursePicker({ group, courseId, onPick }: { group: TeachGroup; courseId: number; onPick: (id: number) => void }) {
  if (group.courses.length <= 1) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {group.courses.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c.id)}
          className={cls(
            "rounded-pill px-3 py-1.5 text-[14px] font-semibold transition-colors",
            c.id === courseId ? "bg-brand text-white" : "bg-surface text-ink-soft border border-line hover:bg-bg"
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

export function GroupProfile() {
  const { id } = useParams();
  const groupId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
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
      <button onClick={() => navigate("/teach/groups")} className="mb-3 flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline">
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
                  <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-ink-soft">
                    <span>{t("yearN", { n: group.yearOfStudy })}</span>
                    <span>·</span>
                    <span>{group.facultyName}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Icon icon={GraduationCap} size={14} /> {t("studentsN", { n: group.studentCount })}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.courses.map((c) => (
                    <button key={c.id} onClick={() => navigate(`/teach/courses/${c.id}`)} className="rounded-pill bg-brand-soft px-2.5 py-1 text-[13.5px] font-semibold text-brand-deep transition-colors hover:bg-brand/10">
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group metrics */}
              <GroupStats group={group} />

              {/* Tabs — segmented track, active tab sits on a brand chip */}
              <div className="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-control border border-line bg-surface p-1 shadow-card">
                {TABS.map((x) => (
                  <button
                    key={x.key}
                    onClick={() => setTab(x.key)}
                    className={cls(
                      "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] px-4 py-2 text-[15px] font-semibold transition-all",
                      tab === x.key ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink"
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
                  <Card><p className="py-8 text-center text-[14.5px] text-ink-soft">{t("noCourses")}</p></Card>
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
