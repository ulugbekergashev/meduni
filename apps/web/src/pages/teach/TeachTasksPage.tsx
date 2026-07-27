import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileClock,
  FileStack,
  ListTodo,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, EmptyState, Icon, MiniBars, Spinner, StatCard, cls, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TaskFeedRow } from "../../components/TaskFeedRow";
import { QuickTaskModal } from "../../components/QuickTaskModal";
import { formatDate, monthShortLabel } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { RollCallModal } from "./course/attendance/RollCallModal";
import { useDeleteMyTask, useSetTaskDone, useTaskBoard, type TeacherTaskItem } from "./api";

const KIND_META: Record<string, { icon: LucideIcon; labelKey: string }> = {
  cases_review: { icon: ClipboardCheck, labelKey: "casesReview" },
  material_missing: { icon: FileStack, labelKey: "materialMissing" },
  digest_approve: { icon: BookOpen, labelKey: "digestApprove" },
  content_create: { icon: Sparkles, labelKey: "contentCreate" },
  content_publish: { icon: FileClock, labelKey: "contentPublish" },
  attendance_unmarked: { icon: CalendarCheck, labelKey: "attendanceUnmarked" },
  students_behind: { icon: UserX, labelKey: "studentsBehind" },
  assigned: { icon: ClipboardList, labelKey: "assignedKind" },
  students_assignment: { icon: Send, labelKey: "studentsAssignmentKind" },
};

// Filtr: qaysi qatorlar ko'rinadi. Har biri stat-karta/chip bilan bog'liq.
type Filter = "todo" | "overdue" | "kafedra" | "students" | "done" | "all";

function matchesFilter(item: TeacherTaskItem, f: Filter): boolean {
  switch (f) {
    case "todo":
      return item.status !== "done" && (item.source === "auto" || item.source === "kafedra");
    case "overdue":
      return item.status === "overdue";
    case "kafedra":
      return item.source === "kafedra";
    case "students":
      return item.source === "students";
    case "done":
      return item.status === "done";
    case "all":
      return true;
  }
}

interface RollCallTarget {
  courseId: number;
  date: string;
  startTime: string;
  groupId: number | null;
  heading: string;
}

export function TeachTasksPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const { t: ta } = useTranslation(undefined, { keyPrefix: "teachAssign" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const navigate = useNavigate();
  const locale = useLocale();
  const { show } = useToast();
  const q = useTaskBoard();
  const done = useSetTaskDone();
  const del = useDeleteMyTask();
  const board = q.data;

  const [filter, setFilter] = useState<Filter>("todo");
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleting, setDeleting] = useState<TeacherTaskItem | null>(null);
  const [rollCall, setRollCall] = useState<RollCallTarget | null>(null);

  const visible = useMemo(() => (board?.items ?? []).filter((i) => matchesFilter(i, filter)), [board, filter]);

  const ageText = (item: TeacherTaskItem): { text: string | null; overdue: boolean } => {
    if (item.status === "done") {
      const iso = item.completedIso ?? item.sinceIso;
      return { text: iso ? formatDate(locale === "ru" ? "ru" : "uz", iso, "short") : null, overdue: false };
    }
    if (item.dueIso) {
      const overdue = new Date(item.dueIso) < new Date();
      return { text: `${t("dueShort")}: ${formatDate(locale === "ru" ? "ru" : "uz", item.dueIso, "short")}`, overdue };
    }
    if (!item.sinceIso) return { text: null, overdue: false };
    const days = Math.floor((Date.now() - new Date(item.sinceIso).getTime()) / 86_400_000);
    if (days <= 0) return { text: t("todayShort"), overdue: false };
    if (days === 1) return { text: t("yesterdayShort"), overdue: false };
    if (days < 30) return { text: t("daysAgo", { n: days }), overdue: false };
    return { text: formatDate(locale === "ru" ? "ru" : "uz", item.sinceIso, "short"), overdue: false };
  };

  const handleRowClick = (item: TeacherTaskItem) => {
    if (item.quickAction?.type === "attendance") {
      const qa = item.quickAction;
      setRollCall({
        courseId: qa.courseId,
        date: qa.date,
        startTime: qa.startTime,
        groupId: qa.groupId,
        heading: `${item.title}${item.subtitle ? " · " + item.subtitle : ""}`,
      });
      return;
    }
    if (item.link) navigate(item.link);
  };

  const st = board?.stats;
  const cnt = board?.counts;

  // Filtr chiplari — stat kartalaridan tashqari qo'shimcha kesimlar.
  const chips: { key: Filter; label: string; count?: number; tone?: "rose" | "emerald" }[] = [
    { key: "all", label: t("filterAll"), count: cnt?.all },
    { key: "kafedra", label: t("filterKafedra"), count: cnt?.kafedra },
    { key: "students", label: t("filterStudents"), count: cnt?.students },
    { key: "done", label: t("filterDone"), count: cnt?.done, tone: "emerald" },
  ];

  const monthTone = filter === "done" ? "emerald" : "brand";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("myTasks")}</h1>
          <p className="mt-0.5 text-note text-ink-faint">{t("myTasksHint")}</p>
        </div>
        <Button icon={<Icon icon={Plus} size={16} />} onClick={() => setAssignOpen(true)}>
          {ta("newBtn")}
        </Button>
      </div>

      {/* Statistika — bosiladigan stat kartalar (aynan vaqtida filtr vazifasini
          bajaradi): bajarilishi kerak / muddati o'tgan / talabalar kutmoqda /
          bajarilgan. Sonlar borsdan keladi. */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={ListTodo}
          tone="bg-brand-soft text-brand-deep"
          value={q.isLoading ? "—" : st?.toDo ?? 0}
          label={t("statToDo")}
          compact
          selected={filter === "todo"}
          onClick={() => setFilter("todo")}
        />
        <StatCard
          icon={Clock}
          tone="bg-rose-soft text-rose"
          value={q.isLoading ? "—" : st?.overdue ?? 0}
          label={t("statOverdue")}
          compact
          selected={filter === "overdue"}
          onClick={() => setFilter("overdue")}
        />
        <StatCard
          icon={Send}
          tone="bg-blue-soft text-blue"
          value={q.isLoading ? "—" : st?.waiting ?? 0}
          label={t("statWaiting")}
          compact
          selected={filter === "students"}
          onClick={() => setFilter("students")}
        />
        <StatCard
          icon={CheckCircle2}
          tone="bg-emerald-soft text-emerald"
          value={q.isLoading ? "—" : st?.done ?? 0}
          label={t("statDoneMonths", { n: 6 })}
          compact
          selected={filter === "done"}
          onClick={() => setFilter("done")}
        />
      </div>

      {/* Qo'shimcha filtr chiplari + oylik bajarilgan grafigi */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={cls(
              "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-note font-semibold transition-all",
              filter === c.key
                ? "border-brand bg-brand-soft text-brand-deep"
                : "border-line bg-surface text-ink-soft hover:bg-bg hover:text-ink"
            )}
          >
            {c.label}
            {c.count !== undefined && (
              <span
                className={cls(
                  "rounded-pill px-1.5 text-micro tabular-nums",
                  filter === c.key ? "bg-brand/15" : c.tone === "emerald" ? "text-emerald" : c.tone === "rose" ? "text-rose" : "text-ink-faint"
                )}
              >
                {c.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Vazifalar ro'yxati (filtr bo'yicha) */}
      <section className="mt-3">
        {q.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner size={22} />
          </div>
        ) : q.isError ? (
          <Card>
            <p className="py-4 text-center text-body text-rose">{t("error")}</p>
          </Card>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Icon icon={filter === "done" ? ListTodo : CheckCircle2} size={26} />}
            text={filter === "done" ? t("noDoneYet") : filter === "todo" || filter === "all" ? t("allDone") : t("noMatchFilter")}
          />
        ) : (
          <Card className="divide-y divide-line overflow-hidden p-0">
            {visible.map((item) => {
              const meta = KIND_META[item.kind] ?? KIND_META.assigned;
              const age = ageText(item);
              const qa = item.quickAction;
              const badge =
                item.status === "done" ? (
                  <span className="inline-flex items-center gap-1 text-micro font-semibold text-emerald">
                    <Icon icon={CheckCircle2} size={12} /> {t("statusDone")}
                  </span>
                ) : item.status === "overdue" ? (
                  <span className="inline-flex items-center gap-1 text-micro font-semibold text-rose">
                    <Icon icon={Clock} size={12} /> {t("statusOverdue")}
                  </span>
                ) : item.progress ? (
                  <span className="text-micro font-semibold text-ink-faint tabular-nums">
                    {item.progress.done}/{item.progress.total}
                  </span>
                ) : null;

              const trailing =
                qa?.type === "attendance" ? (
                  <Button size="sm" variant="soft">
                    {t("markAttendanceBtn")}
                  </Button>
                ) : qa?.type === "done" ? (
                  <Button
                    size="sm"
                    variant="soft"
                    icon={<Icon icon={CheckCircle2} size={14} />}
                    disabled={done.isPending && done.variables === qa.taskId}
                    onClick={(e) => {
                      e.stopPropagation();
                      done.mutate(qa.taskId);
                    }}
                  >
                    {t("markDone")}
                  </Button>
                ) : item.deletableTaskIds && item.deletableTaskIds.length > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(item);
                    }}
                    className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose"
                    aria-label={tc("delete")}
                  >
                    <Icon icon={Trash2} size={16} />
                  </button>
                ) : item.link ? (
                  <Icon icon={ChevronRight} size={16} className="text-ink-faint" />
                ) : undefined;

              return (
                <TaskFeedRow
                  key={item.id}
                  icon={meta.icon}
                  tone={item.tone}
                  kicker={t(meta.labelKey)}
                  title={item.title}
                  subtitle={item.subtitle}
                  description={item.description}
                  meta={age.text}
                  metaTone={age.overdue ? "rose" : null}
                  badge={badge}
                  done={item.status === "done"}
                  onClick={item.quickAction || item.link ? () => handleRowClick(item) : undefined}
                  trailing={trailing}
                />
              );
            })}
          </Card>
        )}
      </section>

      {/* Oylik bajarilgan vazifalar grafigi (statistika) */}
      {board && board.months.some((m) => m.count > 0) && (
        <section className="mt-4">
          <h2 className="mb-2 text-section font-bold text-ink">{t("historyTitle")}</h2>
          <Card>
            <p className="mb-3 text-note text-ink-faint">{t("historyDoneLastMonths", { n: 6 })}</p>
            <MiniBars
              tone={monthTone}
              height={80}
              data={board.months.map((m) => ({ label: monthShortLabel(locale, m.key), value: m.count }))}
            />
          </Card>
        </section>
      )}

      <QuickTaskModal open={assignOpen} onClose={() => setAssignOpen(false)} />

      {rollCall && (
        <RollCallModal
          courseId={rollCall.courseId}
          date={rollCall.date}
          startTime={rollCall.startTime}
          groupId={rollCall.groupId ?? undefined}
          heading={rollCall.heading}
          onClose={() => setRollCall(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={ta("deleteTitle")}
        message={ta("deleteMsg")}
        loading={del.isPending}
        onConfirm={() =>
          deleting?.deletableTaskIds &&
          del.mutate(deleting.deletableTaskIds[0], {
            onSuccess: () => {
              setDeleting(null);
              show(tc("deleted"));
            },
          })
        }
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
