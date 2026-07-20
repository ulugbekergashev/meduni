import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ListChecks,
  PlayCircle,
  Sparkles,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, Icon, Spinner, cls } from "@meduni/ui";
import { HeroCard, HeroTile, RailCard } from "../../components/HeroStats";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMySchedule, useMyTasks, useSetMyTaskDone, type AutoTask } from "./api";

const META: Record<string, { icon: LucideIcon; labelKey: string; chip: string }> = {
  study: { icon: PlayCircle, labelKey: "study", chip: "bg-brand-soft text-brand-deep" },
  quiz_todo: { icon: ClipboardList, labelKey: "quizTodo", chip: "bg-blue-soft text-blue" },
  case_todo: { icon: Stethoscope, labelKey: "caseTodo", chip: "bg-rose-soft text-rose" },
  case_graded: { icon: CheckCircle2, labelKey: "caseGraded", chip: "bg-emerald-soft text-emerald" },
  attendance_low: { icon: CalendarCheck, labelKey: "attendanceLow", chip: "bg-amber-soft text-amber" },
};

/** Avto-vazifa bo'limi: sarlavha + KONKRET qatorlar (qaysi mavzu, qaysi fan). */
function AutoTaskGroup({ task }: { task: AutoTask }) {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const navigate = useNavigate();
  const meta = META[task.type];
  if (!meta) return null;
  const items = task.items ?? [];

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <div className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.chip)}>
          <Icon icon={meta.icon} size={15} />
        </div>
        <h3 className="text-body font-bold text-ink">{t(meta.labelKey)}</h3>
        <span className="rounded-pill bg-bg px-2 py-0.5 text-note font-semibold text-ink-soft">
          {task.type === "attendance_low" ? `${task.count}%` : task.count}
        </span>
      </div>

      {items.length === 0 ? (
        <Card interactive onClick={() => navigate(task.link)} className="flex items-center gap-3 py-3">
          <p className="min-w-0 flex-1 text-body text-ink">{t("attendanceLowHint", { pct: task.count })}</p>
          <Icon icon={ArrowRight} size={16} className="shrink-0 text-ink-faint" />
        </Card>
      ) : (
        <Card className="divide-y divide-line p-0">
          {items.map((it, i) => (
            <button
              key={`${it.topicId}-${i}`}
              onClick={() => navigate(it.link)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-ink">{it.topicTitle}</p>
                <p className="truncate text-note text-ink-faint">{it.courseName}</p>
              </div>
              {it.value !== undefined && it.value !== null && (
                <span className="shrink-0 text-[17px] font-bold tabular-nums text-emerald">{it.value}</span>
              )}
              <Icon icon={ArrowRight} size={16} className="shrink-0 text-ink-faint" />
            </button>
          ))}
        </Card>
      )}
    </section>
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
  const fmt = (iso: string) => formatDate(locale === "ru" ? "ru" : "uz", iso, "short");

  const overdue = assignedAll.filter((a) => a.dueDate && new Date(a.dueDate) < new Date());
  const studyCount = auto.reduce((n, a) => n + (a.items?.length ?? (a.type === "attendance_low" ? 1 : 0)), 0);
  const totalOpen = assignedAll.length + studyCount;

  // Filtrga qarab nimani ko'rsatamiz
  const showTeacher = filter === "all" || filter === "teacher" || filter === "overdue";
  const showStudy = filter === "all" || filter === "study";
  const assigned = filter === "overdue" ? overdue : assignedAll;
  const nothing = totalOpen === 0;
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));

  return (
    <div>
      <HeroCard title={t("studentTitle")} subtitle={t("studentHint")}>
        <HeroTile
          icon={ListChecks}
          value={String(totalOpen)}
          label={t("statOpen")}
          tone="bg-brand-soft text-brand-deep"
          onClick={() => setFilter("all")}
          selected={filter === "all"}
        />
        <HeroTile
          icon={UserRound}
          value={String(assignedAll.length)}
          label={t("statFromTeacher")}
          tone="bg-violet-soft text-violet"
          onClick={() => toggle("teacher")}
          selected={filter === "teacher"}
        />
        <HeroTile
          icon={AlertTriangle}
          value={String(overdue.length)}
          label={t("statOverdue")}
          tone={overdue.length > 0 ? "bg-rose-soft text-rose" : "bg-bg text-ink-faint"}
          onClick={() => toggle("overdue")}
          selected={filter === "overdue"}
        />
        <HeroTile
          icon={CheckCircle2}
          value={String(history.length)}
          label={t("statDone")}
          tone="bg-emerald-soft text-emerald"
          onClick={() => setHistoryOpen(true)}
        />
      </HeroCard>

      {q.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : q.isError ? (
        <Card className="mt-5">
          <p className="py-4 text-center text-body text-rose">{t("error")}</p>
        </Card>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            {/* O'qituvchi topshiriqlari */}
            {showTeacher && assigned.length > 0 && (
              <section>
                <h2 className="mb-3 text-section font-bold text-ink">{t("teacherAssignedSection")}</h2>
                <div className="space-y-2">
                  {assigned.map((task) => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                    return (
                      <Card
                        key={task.id}
                        className={cls("flex flex-wrap items-start justify-between gap-3", isOverdue && "border-rose/40")}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-body font-semibold text-ink">{task.title}</p>
                            {task.priority === "HIGH" && <Badge tone="rose">{t("priorityHigh")}</Badge>}
                          </div>
                          {task.description && <p className="mt-0.5 text-note text-ink-soft">{task.description}</p>}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-note text-ink-faint">
                            <span className="inline-flex items-center gap-1">
                              <Icon icon={UserRound} size={13} /> {task.createdByName}
                            </span>
                            {task.dueDate && (
                              <span className={cls("inline-flex items-center gap-1", isOverdue && "font-semibold text-rose")}>
                                <Icon icon={Clock} size={13} /> {fmt(task.dueDate)}
                                {isOverdue && ` · ${t("overdue")}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {task.linkUrl && (
                            <Button variant="ghost" size="sm" onClick={() => navigate(task.linkUrl!)}>
                              {t("open")}
                            </Button>
                          )}
                          <Button
                            variant="soft"
                            size="sm"
                            icon={<Icon icon={CheckCircle2} size={15} />}
                            onClick={() => done.mutate(task.id)}
                            disabled={done.isPending && done.variables === task.id}
                          >
                            {t("markDone")}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* O'quv vazifalari — konkret mavzular */}
            {showStudy && auto.length > 0 && (
              <section>
                <h2 className="mb-3 text-section font-bold text-ink">{t("studySection")}</h2>
                <div className="space-y-5">
                  {auto.map((task) => (
                    <AutoTaskGroup key={task.type} task={task} />
                  ))}
                </div>
              </section>
            )}

            {nothing && (
              <Card className="flex items-center gap-3 border-emerald/40 bg-emerald-soft">
                <Icon icon={Sparkles} size={22} className="text-emerald" />
                <p className="text-body font-semibold text-emerald">{t("studentAllDone")}</p>
              </Card>
            )}

            {!nothing && ((showTeacher && assigned.length === 0 && filter !== "all") || (showStudy && auto.length === 0 && filter === "study")) && (
              <Card>
                <p className="py-4 text-center text-body text-ink-faint">{t("noMatchFilter")}</p>
              </Card>
            )}
          </div>

          {/* O'ng ustun — kontekst */}
          <aside className="min-w-0 space-y-5">
            <RailCard
              title={t("upcomingLessons")}
              icon={CalendarDays}
              action={{ label: t("open"), onClick: () => navigate("/app/schedule") }}
            >
              {schedule.length === 0 ? (
                <p className="px-4 py-4 text-note text-ink-faint">{t("noLessonsShort")}</p>
              ) : (
                <div className="divide-y divide-line">
                  {schedule.slice(0, 3).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate("/app/schedule")}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg"
                    >
                      <div className="w-10 shrink-0 text-center">
                        <p className="text-[16px] font-bold leading-none tabular-nums text-brand-deep">
                          {new Date(s.date).getDate()}
                        </p>
                        <p className="mt-0.5 text-[11.5px] tabular-nums text-ink-faint">
                          {`${String(new Date(s.date).getHours()).padStart(2, "0")}:${String(new Date(s.date).getMinutes()).padStart(2, "0")}`}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1 border-l border-line pl-3">
                        <p className="truncate text-body font-semibold text-ink">{s.title ?? s.courseName}</p>
                        <p className="truncate text-note text-ink-faint">{s.courseName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </RailCard>

            <RailCard title={t("doneSection")} icon={ClipboardCheck}>
              {history.length === 0 ? (
                <p className="px-4 py-4 text-note text-ink-faint">{t("noDoneYet")}</p>
              ) : (
                <>
                  <button
                    onClick={() => setHistoryOpen((o) => !o)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-note font-semibold text-ink-soft transition-colors hover:bg-bg"
                  >
                    <Icon
                      icon={ChevronDown}
                      size={14}
                      className={cls("transition-transform", !historyOpen && "-rotate-90")}
                    />
                    {t("doneCountN", { n: history.length })}
                  </button>
                  {historyOpen && (
                    <div className="divide-y divide-line border-t border-line">
                      {history.slice(0, 8).map((h) => (
                        <div key={h.id} className="flex items-center gap-2.5 px-4 py-2.5">
                          <Icon icon={CheckCircle2} size={14} className="shrink-0 text-emerald" />
                          <p className="min-w-0 flex-1 truncate text-note text-ink-soft line-through">{h.title}</p>
                          {h.doneAt && <span className="shrink-0 text-[12px] text-ink-faint">{fmt(h.doneAt)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </RailCard>
          </aside>
        </div>
      )}
    </div>
  );
}
