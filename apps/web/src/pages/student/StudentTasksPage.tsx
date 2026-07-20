import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  PlayCircle,
  Sparkles,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, Icon, Spinner, cls } from "@meduni/ui";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMyTasks, useSetMyTaskDone, type AutoTask } from "./api";

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
        // Faqat davomat kabi ro'yxatsiz vazifalar
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

export function StudentTasksPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const navigate = useNavigate();
  const locale = useLocale();
  const q = useMyTasks(true); // bajarilganlar tarixi bilan
  const done = useSetMyTaskDone();
  const [historyOpen, setHistoryOpen] = useState(false);

  const auto = q.data?.auto ?? [];
  const assigned = (q.data?.assigned ?? []).filter((a) => a.status === "OPEN");
  const history = (q.data?.assigned ?? []).filter((a) => a.status !== "OPEN");
  const nothing = auto.length === 0 && assigned.length === 0;
  const fmt = (iso: string) => formatDate(locale === "ru" ? "ru" : "uz", iso, "short");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h1 font-bold text-ink">{t("studentTitle")}</h1>
      <p className="mt-0.5 text-note text-ink-faint">{t("studentHint")}</p>

      {q.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : q.isError ? (
        <Card className="mt-6">
          <p className="py-4 text-center text-body text-rose">{t("error")}</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {/* O'qituvchi topshiriqlari — eng muhim, tepada */}
          {assigned.length > 0 && (
            <section>
              <h2 className="mb-3 text-section font-bold text-ink">{t("teacherAssignedSection")}</h2>
              <div className="space-y-2">
                {assigned.map((task) => {
                  const overdue = task.dueDate && new Date(task.dueDate) < new Date();
                  return (
                    <Card key={task.id} className="flex flex-wrap items-start justify-between gap-3">
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
                            <span className={cls("inline-flex items-center gap-1", overdue && "font-semibold text-rose")}>
                              <Icon icon={Clock} size={13} /> {fmt(task.dueDate)}
                              {overdue && ` · ${t("overdue")}`}
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

          {/* O'quv vazifalari — konkret mavzular bo'yicha */}
          {auto.length > 0 && (
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

          {/* Bajarilganlar tarixi */}
          {history.length > 0 && (
            <section>
              <button
                onClick={() => setHistoryOpen((o) => !o)}
                className="flex items-center gap-2 text-section font-bold text-ink-soft"
              >
                <Icon icon={ChevronDown} size={16} className={cls("transition-transform", !historyOpen && "-rotate-90")} />
                {t("doneSection")}
                <span className="rounded-pill bg-bg px-2 py-0.5 text-note font-semibold">{history.length}</span>
              </button>
              {historyOpen && (
                <Card className="mt-3 divide-y divide-line p-0">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Icon icon={ClipboardCheck} size={15} className="shrink-0 text-emerald" />
                      <p className="min-w-0 flex-1 truncate text-body text-ink-soft line-through">{h.title}</p>
                      {h.doneAt && <span className="shrink-0 text-note text-ink-faint">{fmt(h.doneAt)}</span>}
                    </div>
                  ))}
                </Card>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
