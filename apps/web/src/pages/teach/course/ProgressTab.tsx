import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Download, GraduationCap, LayoutGrid, List, ListPlus, Search, TrendingUp, Unlock, Users } from "lucide-react";
import { Badge, Button, Card, Icon, Modal, Spinner, StatCard, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { QuickTaskModal } from "../../../components/QuickTaskModal";
import {
  API_URL,
  useCourseProgress,
  useManualUnlock,
  type CellState,
  type CourseProgress,
  type ProgressCell,
  type ProgressStudent,
  type ProgressTopic,
} from "../api";

type Filter = "all" | "active" | "behind" | "completed";

const cellClass: Record<CellState, string> = {
  COMPLETED: "bg-emerald text-white",
  IN_PROGRESS: "bg-amber-soft text-amber",
  AVAILABLE: "bg-bg text-ink-faint",
  LOCKED: "bg-surface text-ink-faint/50",
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function LastActive({ iso }: { iso: string | null }) {
  const { t } = useTranslation(undefined, { keyPrefix: "progress" });
  const d = daysSince(iso);
  if (d === null) return <span className="text-ink-faint">{t("neverActive")}</span>;
  if (d >= 7) return <span className="font-semibold text-rose">{t("inactiveDays", { count: d })}</span>;
  if (d === 0) return <span className="text-ink-soft">{t("today")}</span>;
  return <span className="text-ink-soft">{t("daysAgo", { count: d })}</span>;
}

function cellSummary(c: ProgressCell, t: (k: string) => string): string {
  const e = c.elements;
  const parts: string[] = [];
  if (e.video.exists) parts.push(`${t("elVideo")} ${e.video.watchedPct}%`);
  if (e.slides.exists) parts.push(`${t("elSlides")} ${e.slides.viewed ? "✓" : "—"}`);
  if (e.quiz.exists) parts.push(`${t("elQuiz")} ${e.quiz.score !== null ? e.quiz.score + "%" : "—"}`);
  if (e.case.exists) parts.push(`${t("elCase")} ${e.case.reviewed ? "✓" : e.case.submitted ? "…" : "—"}`);
  return parts.join(" · ") || "—";
}

function StudentModal({ student, topics, courseId, onClose, onAssign }: { student: ProgressStudent; topics: ProgressTopic[]; courseId: number; onClose: () => void; onAssign: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "progress" });
  const { show } = useToast();
  const navigate = useNavigate();
  const unlock = useManualUnlock(courseId);
  const byTopic = new Map(student.cells.map((c) => [c.topicId, c]));

  return (
    <Modal open onClose={onClose} title={student.fullName} className="max-w-xl">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[14px]">
        <span className="text-ink-soft">{t("overall")}: <span className="font-bold text-ink">{student.overallPct}%</span></span>
        <span className="text-ink-soft">{t("avgTest")}: <span className="font-bold text-ink">{student.avgQuizScore ?? "—"}%</span></span>
        <LastActive iso={student.lastActiveAt} />
        <div className="ml-auto flex items-center gap-3">
          <button onClick={onAssign} className="inline-flex items-center gap-1 font-semibold text-brand-deep hover:underline">
            <Icon icon={ListPlus} size={14} /> {t("assignTask")}
          </button>
          <button onClick={() => navigate(`/teach/students/${student.id}`)} className="font-semibold text-brand-deep hover:underline">
            {t("openProfile")} →
          </button>
        </div>
      </div>

      <div className="max-h-[55vh] space-y-2 overflow-y-auto">
        {topics.map((tp) => {
          const c = byTopic.get(tp.id);
          if (!c) return null;
          return (
            <div key={tp.id} className="rounded-control border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14.5px] font-semibold text-ink">
                  {tp.orderIndex}. {tp.title}
                </p>
                <Badge tone={c.state === "COMPLETED" ? "emerald" : c.state === "IN_PROGRESS" ? "amber" : c.state === "LOCKED" ? "slate" : "blue"}>
                  {t(`state.${c.state}`)}
                </Badge>
              </div>
              <p className="mt-1 text-[13.5px] text-ink-soft">{cellSummary(c, t)}</p>
              {c.state !== "COMPLETED" && (
                <button
                  onClick={() => unlock.mutate({ studentId: student.id, topicId: tp.id }, { onSuccess: () => show(t("unlocked")) })}
                  disabled={unlock.isPending}
                  className="mt-2 inline-flex items-center gap-1 rounded-control border border-amber/40 bg-amber-soft px-2.5 py-1 text-[13px] font-semibold text-amber transition-colors hover:bg-amber/10"
                >
                  <Icon icon={Unlock} size={13} /> {t("manualUnlock")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function Heatmap({ data, students, onPick }: { data: CourseProgress; students: ProgressStudent[]; onPick: (s: ProgressStudent) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "progress" });
  // group average per topic = % of students who COMPLETED it
  const avgByTopic = useMemo(() => {
    const m = new Map<number, number>();
    for (const tp of data.topics) {
      const done = data.students.filter((s) => s.cells.find((c) => c.topicId === tp.id)?.state === "COMPLETED").length;
      m.set(tp.id, data.students.length ? Math.round((done / data.students.length) * 100) : 0);
    }
    return m;
  }, [data]);

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="border-collapse text-[13.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-line bg-surface px-3 py-2 text-left font-bold text-ink-soft">
              {t("student")}
            </th>
            {data.topics.map((tp) => (
              <th key={tp.id} className="min-w-[38px] border-b border-line bg-surface px-1 py-2 text-center font-bold text-ink-soft" title={tp.title}>
                {tp.orderIndex}
              </th>
            ))}
            <th className="min-w-[52px] border-b border-l border-line bg-surface px-2 py-2 text-center font-bold text-ink-soft">%</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const byTopic = new Map(s.cells.map((c) => [c.topicId, c]));
            return (
              <tr key={s.id} className="hover:bg-bg">
                <td
                  className={cls("sticky left-0 z-10 max-w-[160px] cursor-pointer truncate border-b border-r border-line bg-surface px-3 py-1.5 font-medium", s.behind ? "text-rose" : "text-ink")}
                  onClick={() => onPick(s)}
                  title={s.fullName}
                >
                  {s.behind && <span className="mr-1">•</span>}
                  {s.fullName}
                </td>
                {data.topics.map((tp) => {
                  const c = byTopic.get(tp.id);
                  return (
                    <td key={tp.id} className="border-b border-line p-0.5">
                      <button
                        onClick={() => onPick(s)}
                        title={c ? `${s.fullName} · ${t("topic")} ${tp.orderIndex}: ${cellSummary(c, t)}` : ""}
                        className={cls("flex h-8 w-full items-center justify-center rounded text-[11px] font-bold transition-transform hover:scale-110", cellClass[c?.state ?? "LOCKED"])}
                      >
                        {c?.state === "COMPLETED" ? "✓" : c?.state === "IN_PROGRESS" ? `${c.pct}` : ""}
                      </button>
                    </td>
                  );
                })}
                <td className="border-b border-l border-line px-2 py-1.5 text-center font-bold tabular-nums text-ink">{s.overallPct}</td>
              </tr>
            );
          })}
          {/* group average row */}
          <tr className="bg-bg">
            <td className="sticky left-0 z-10 border-r border-line bg-bg px-3 py-2 text-[12.5px] font-bold uppercase text-ink-faint">{t("groupAvg")}</td>
            {data.topics.map((tp) => (
              <td key={tp.id} className="px-1 py-2 text-center text-[12px] font-semibold text-ink-soft">{avgByTopic.get(tp.id)}%</td>
            ))}
            <td className="border-l border-line px-2 py-2 text-center text-[12px] font-bold text-ink-soft">{data.stats.avgProgress}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ListView({ students, onPick }: { students: ProgressStudent[]; onPick: (s: ProgressStudent) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "progress" });
  return (
    <div className="space-y-2">
      {students.map((s) => (
        <Card key={s.id} className={cls("flex flex-wrap items-center gap-4", s.behind && "border-rose/40")}>
          <div className="min-w-[140px] flex-1">
            <p className={cls("text-[15px] font-semibold", s.behind ? "text-rose" : "text-ink")}>{s.fullName}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-28 overflow-hidden rounded-pill bg-bg">
                <div className="h-full rounded-pill bg-brand" style={{ width: `${Math.max(s.overallPct, 2)}%` }} />
              </div>
              <span className="text-[13px] font-semibold text-ink-soft">{s.overallPct}%</span>
            </div>
          </div>
          <div className="text-[13.5px] text-ink-soft">
            {t("completedN", { n: s.completedCount })}
          </div>
          <div className="text-[13.5px]">
            <LastActive iso={s.lastActiveAt} />
          </div>
          <div className="text-[13.5px] text-ink-soft">
            {t("avgTest")}: <span className="font-semibold text-ink">{s.avgQuizScore ?? "—"}%</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onPick(s)}>
            {t("details")}
          </Button>
        </Card>
      ))}
    </div>
  );
}

export function ProgressTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "progress" });
  const q = useCourseProgress(courseId);
  const data = q.data;

  const [view, setView] = useState<"heatmap" | "list">("heatmap");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"progress" | "name">("progress");
  const [picked, setPicked] = useState<ProgressStudent | null>(null);
  const [assignTo, setAssignTo] = useState<{ id: number; name: string } | null>(null);

  const students = useMemo(() => {
    if (!data) return [];
    let list = [...data.students];
    if (filter === "behind") list = list.filter((s) => s.behind);
    else if (filter === "active") list = list.filter((s) => s.lastActiveAt !== null || s.overallPct > 0);
    else if (filter === "completed") list = list.filter((s) => data.topics.length > 0 && s.completedCount === data.topics.length);
    if (search.trim()) list = list.filter((s) => s.fullName.toLowerCase().includes(search.trim().toLowerCase()));
    list.sort((a, b) =>
      sort === "name" ? a.fullName.localeCompare(b.fullName) : Number(b.behind) - Number(a.behind) || a.overallPct - b.overallPct
    );
    return list;
  }, [data, filter, search, sort]);

  return (
    <div>
      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection
          isLoading={false}
          isError={q.isError}
          isEmpty={!!data && data.students.length === 0 && data.topics.length === 0}
          emptyIcon={<Icon icon={Users} size={22} />}
          emptyText={t("empty")}
          onRetry={() => q.refetch()}
        >
          {data && (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard compact icon={Users} label={t("statTotal")} value={data.stats.total} tone="bg-blue-soft text-blue" selected={filter === "all"} onClick={() => setFilter("all")} />
                <StatCard compact icon={TrendingUp} label={t("statActive")} value={data.stats.active} tone="bg-brand-soft text-brand-deep" selected={filter === "active"} onClick={() => setFilter("active")} />
                <StatCard compact icon={AlertTriangle} label={t("statBehind")} value={data.stats.behind} tone="bg-rose-soft text-rose" selected={filter === "behind"} onClick={() => setFilter("behind")} />
                <StatCard compact icon={TrendingUp} label={t("statAvg")} value={`${data.stats.avgProgress}%`} tone="bg-amber-soft text-amber" onClick={() => setFilter("all")} />
                <StatCard compact icon={GraduationCap} label={t("statCompleted")} value={data.stats.completed} tone="bg-emerald-soft text-emerald" selected={filter === "completed"} onClick={() => setFilter("completed")} />
              </div>

              {/* Filter bar */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("searchStudent")}
                    className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[14.5px] outline-none focus:border-brand"
                  />
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value as "progress" | "name")} className="rounded-control border border-line bg-surface px-2 py-2 text-[14px] outline-none focus:border-brand">
                  <option value="progress">{t("sortProgress")}</option>
                  <option value="name">{t("sortName")}</option>
                </select>
                <div className="flex overflow-hidden rounded-control border border-line">
                  <button onClick={() => setView("heatmap")} className={cls("flex items-center gap-1 px-3 py-2 text-[14px] font-medium", view === "heatmap" ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg")}>
                    <Icon icon={LayoutGrid} size={15} /> {t("heatmap")}
                  </button>
                  <button onClick={() => setView("list")} className={cls("flex items-center gap-1 px-3 py-2 text-[14px] font-medium", view === "list" ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg")}>
                    <Icon icon={List} size={15} /> {t("list")}
                  </button>
                </div>
                <a href={`${API_URL}/api/v1/teach/courses/${courseId}/progress/export?view=${view}`} className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:bg-bg">
                  <Icon icon={Download} size={15} /> Excel
                </a>
              </div>

              {/* View */}
              <div className="mt-4">
                {students.length === 0 ? (
                  <Card><p className="py-6 text-center text-[14.5px] text-ink-soft">{t("noMatch")}</p></Card>
                ) : view === "heatmap" ? (
                  <Heatmap data={data} students={students} onPick={setPicked} />
                ) : (
                  <ListView students={students} onPick={setPicked} />
                )}
              </div>

              {view === "heatmap" && (
                <div className="mt-3 flex flex-wrap gap-3 text-[12.5px] text-ink-soft">
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald" /> {t("state.COMPLETED")}</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-soft" /> {t("state.IN_PROGRESS")}</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-bg" /> {t("state.AVAILABLE")}</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-line bg-surface" /> {t("state.LOCKED")}</span>
                </div>
              )}
            </>
          )}
        </AsyncSection>
      )}

      {picked && data && (
        <StudentModal
          student={data.students.find((s) => s.id === picked.id) ?? picked}
          topics={data.topics}
          courseId={courseId}
          onClose={() => setPicked(null)}
          onAssign={() => setAssignTo({ id: picked.id, name: picked.fullName })}
        />
      )}

      <QuickTaskModal
        open={assignTo !== null}
        onClose={() => setAssignTo(null)}
        prefill={assignTo ? { studentId: assignTo.id, studentName: assignTo.name } : undefined}
      />
    </div>
  );
}
