import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  PlayCircle,
  Sparkles,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button, Icon, cls } from "@meduni/ui";
import { BentoCard, BentoRow, MetricTile, PageHeader } from "../../components/bento";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMySchedule, useMyTasks, useSetMyTaskDone, type AssignedTask, type AutoTask } from "./api";

const META: Record<string, { icon: LucideIcon; labelKey: string; chip: string }> = {
  study: { icon: PlayCircle, labelKey: "study", chip: "bg-brand-soft text-brand-deep" },
  quiz_todo: { icon: ClipboardList, labelKey: "quizTodo", chip: "bg-blue-soft text-blue" },
  case_todo: { icon: Stethoscope, labelKey: "caseTodo", chip: "bg-rose-soft text-rose" },
  case_graded: { icon: CheckCircle2, labelKey: "caseGraded", chip: "bg-emerald-soft text-emerald" },
  attendance_low: { icon: CalendarCheck, labelKey: "attendanceLow", chip: "bg-amber-soft text-amber" },
  makeup_due: { icon: ClipboardCheck, labelKey: "makeupDue", chip: "bg-rose-soft text-rose" },
};

const SCHEDULE_URL = "/app/attendance?sub=jadval";

/** Avto-vazifa bo'limi: sarlavha + KONKRET qatorlar (qaysi mavzu, qaysi fan). */
function AutoTaskGroup({ task }: { task: AutoTask }) {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const navigate = useNavigate();
  const meta = META[task.type];
  if (!meta) return null;
  const items = task.items ?? [];

  return (
    <BentoCard
      title={
        <span className="flex items-center gap-2">
          <span className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.chip)}>
            <Icon icon={meta.icon} size={14} />
          </span>
          {t(meta.labelKey)}
        </span>
      }
      count={task.count}
      bodyClassName="px-2 pb-2"
    >
      {items.length === 0 ? (
        <BentoRow title={t("attendanceLowHint", { pct: task.count })} onClick={() => navigate(task.link)} />
      ) : (
        <ul className="divide-y divide-line-soft">
          {items.map((it, i) => (
            <li key={`${it.topicId}-${i}`}>
              <BentoRow
                title={it.topicTitle}
                sub={it.courseName}
                onClick={() => navigate(it.link)}
                right={
                  it.value !== undefined && it.value !== null ? (
                    // Koridor qatorida bu — LIMITGACHA QOLGAN SOAT. 0 bo'lsa
                    // yashil emas: bu yomon xabar (yakuniy nazoratga kiritilmaydi).
                    <span
                      className={cls(
                        "text-section font-semibold",
                        task.type === "attendance_low" ? (it.value === 0 ? "text-rose" : "text-amber") : "text-emerald"
                      )}
                    >
                      {it.value}
                      {task.type === "attendance_low" && <span className="ml-1 text-micro">{t("hoursLeft")}</span>}
                    </span>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}

/** O'qituvchi topshirig'i — tavsif, muallif, muddat va ikki amal. */
function AssignedRow({
  task,
  onDone,
  busy,
  fmt,
}: {
  task: AssignedTask;
  onDone: () => void;
  busy: boolean;
  fmt: (iso: string) => string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const navigate = useNavigate();
  const isOverdue = !!task.dueDate && new Date(task.dueDate) < new Date();
  return (
    <li
      className={cls(
        "flex flex-wrap items-start gap-3 rounded-control px-2 py-3",
        isOverdue && "bg-rose-soft"
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
        <Icon icon={ClipboardCheck} size={15} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 text-body font-semibold text-ink">{task.title}</p>
          {task.priority === "HIGH" && (
            <span className="rounded-pill bg-rose-soft px-2 py-0.5 text-micro font-semibold text-rose">{t("priorityHigh")}</span>
          )}
        </div>
        {task.description && <p className="mt-1 text-note leading-relaxed text-ink-2">{task.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-ink-soft">
          <span className="inline-flex items-center gap-1">
            <Icon icon={UserRound} size={12} /> {task.createdByName}
          </span>
          {task.dueDate && (
            <span className={cls("inline-flex items-center gap-1 tabular-nums", isOverdue && "font-semibold text-rose")}>
              <Icon icon={Clock} size={12} /> {fmt(task.dueDate)}
              {isOverdue && ` · ${t("overdue")}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task.linkUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-pill"
            icon={<Icon icon={ExternalLink} size={13} />}
            onClick={() => navigate(task.linkUrl!)}
          >
            {t("open")}
          </Button>
        )}
        <Button
          variant={isOverdue ? "danger" : "primary"}
          size="sm"
          className="rounded-pill"
          icon={<Icon icon={CheckCircle2} size={14} />}
          onClick={onDone}
          disabled={busy}
        >
          {t("markDone")}
        </Button>
      </div>
    </li>
  );
}

type Filter = "all" | "teacher" | "study" | "overdue";

export function StudentTasksPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const navigate = useNavigate();
  const locale = useLocale();
  const q = useMyTasks(true); // bajarilganlar tarixi bilan
  const scheduleQ = useMySchedule();
  const done = useSetMyTaskDone();
  const [historyOpen, setHistoryOpen] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const auto = q.data?.auto ?? [];
  const assignedAll = useMemo(() => (q.data?.assigned ?? []).filter((a) => a.status === "OPEN"), [q.data]);
  const history = (q.data?.assigned ?? []).filter((a) => a.status !== "OPEN");
  const schedule = scheduleQ.data ?? [];
  const lang = locale === "ru" ? "ru" : "uz";
  const fmt = (iso: string) => formatDate(lang, iso, "short");

  const overdue = assignedAll.filter((a) => a.dueDate && new Date(a.dueDate) < new Date());
  const studyCount = auto.reduce((n, a) => n + (a.items?.length ?? (a.type === "attendance_low" ? 1 : 0)), 0);
  const totalOpen = assignedAll.length + studyCount;

  // Filtrga qarab nimani ko'rsatamiz
  const showTeacher = filter === "all" || filter === "teacher" || filter === "overdue";
  const showStudy = filter === "all" || filter === "study";
  const assigned = filter === "overdue" ? overdue : assignedAll;
  const nothing = totalOpen === 0;
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));
  const openHistory = () => {
    setHistoryOpen(true);
    document.getElementById("tasks-history")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="space-y-3">
      <PageHeader className="mb-0" title={t("studentTitle")} subtitle={t("studentHint")} />

      {/* STAT DIETASI: 4 karta — uchtasi FILTR, to'rtinchisi tarixga o'tish. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          size="stat"
          tone="brand"
          label={t("statOpen")}
          value={totalOpen}
          onClick={() => setFilter("all")}
          selected={filter === "all"}
        />
        <MetricTile
          size="stat"
          label={t("statFromTeacher")}
          value={assignedAll.length}
          onClick={() => toggle("teacher")}
          selected={filter === "teacher"}
        />
        <MetricTile
          size="stat"
          tone={overdue.length > 0 ? "rose" : "plain"}
          valueTone={overdue.length > 0 ? "rose" : "ink"}
          label={t("statOverdue")}
          value={overdue.length}
          onClick={() => toggle("overdue")}
          selected={filter === "overdue"}
        />
        <MetricTile size="stat" label={t("statDone")} value={history.length} onClick={openHistory} />
      </div>

      {q.isLoading || q.isError ? (
        <BentoCard isLoading={q.isLoading} isError={q.isError} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-3">
            {/* O'qituvchi topshiriqlari */}
            {showTeacher && assigned.length > 0 && (
              <BentoCard title={t("teacherAssignedSection")} count={assigned.length} bodyClassName="px-2 pb-2">
                <ul className="space-y-1">
                  {assigned.map((task) => (
                    <AssignedRow
                      key={task.id}
                      task={task}
                      fmt={fmt}
                      onDone={() => done.mutate(task.id)}
                      busy={done.isPending && done.variables === task.id}
                    />
                  ))}
                </ul>
              </BentoCard>
            )}

            {/* O'quv vazifalari — konkret mavzular */}
            {showStudy && auto.length > 0 && (
              <>
                <h2 className="px-1 pt-1 text-section font-semibold text-ink">{t("studySection")}</h2>
                <div className="grid gap-3 xl:grid-cols-2">
                  {auto.map((task) => (
                    <AutoTaskGroup key={task.type} task={task} />
                  ))}
                </div>
              </>
            )}

            {nothing && (
              <BentoCard tone="emerald" bodyClassName="flex items-center gap-3 px-4 pb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/70 text-emerald">
                  <Icon icon={Sparkles} size={20} />
                </span>
                <p className="text-body font-semibold text-emerald">{t("studentAllDone")}</p>
              </BentoCard>
            )}

            {!nothing &&
              ((showTeacher && assigned.length === 0 && filter !== "all") ||
                (showStudy && auto.length === 0 && filter === "study")) && (
                <div className="rounded-card border border-dashed border-line p-4 text-center text-body text-ink-soft">
                  {t("noMatchFilter")}
                </div>
              )}
          </div>

          {/* O'ng ustun — kontekst */}
          <aside className="min-w-0 space-y-3">
            <BentoCard
              title={t("upcomingLessons")}
              action={{ label: t("open"), onClick: () => navigate(SCHEDULE_URL) }}
              isLoading={scheduleQ.isLoading}
              isError={scheduleQ.isError}
              onRetry={() => scheduleQ.refetch()}
              bodyClassName="px-2 pb-2"
            >
              {schedule.length === 0 ? (
                <p className="px-2 py-3 text-note text-ink-soft">{t("noLessonsShort")}</p>
              ) : (
                <ul>
                  {schedule.slice(0, 3).map((s) => {
                    const d = new Date(s.date);
                    return (
                      <li key={s.key}>
                        <BentoRow
                          lead={
                            <span className="flex w-11 shrink-0 flex-col items-center rounded-control bg-surface-raised py-1">
                              <span className="text-section font-semibold leading-none tabular-nums text-ink">{d.getDate()}</span>
                              <span className="mt-0.5 font-data text-micro tabular-nums text-ink-soft">
                                {`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`}
                              </span>
                            </span>
                          }
                          title={s.title ?? s.courseName}
                          sub={s.courseName}
                          onClick={() => navigate(SCHEDULE_URL)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </BentoCard>

            <div id="tasks-history">
              <BentoCard title={t("doneSection")} count={history.length} bodyClassName="px-2 pb-2">
                {history.length === 0 ? (
                  <p className="px-2 py-3 text-note text-ink-soft">{t("noDoneYet")}</p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setHistoryOpen((o) => !o)}
                      aria-expanded={historyOpen}
                      className="flex w-full items-center gap-2 rounded-control px-2 py-2 text-left text-note font-semibold text-ink-soft transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <Icon icon={ChevronDown} size={15} className={cls("transition-transform", !historyOpen && "-rotate-90")} />
                      {t("doneCountN", { n: history.length })}
                    </button>
                    {historyOpen && (
                      <ul className="divide-y divide-line-soft">
                        {history.slice(0, 8).map((h) => (
                          <li key={h.id} className="flex items-center gap-3 px-2 py-2">
                            <Icon icon={CheckCircle2} size={15} className="shrink-0 text-emerald" />
                            <p className="min-w-0 flex-1 truncate text-note text-ink-soft line-through">{h.title}</p>
                            {h.doneAt && (
                              <span className="shrink-0 font-data text-micro tabular-nums text-ink-faint">{fmt(h.doneAt)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </BentoCard>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
