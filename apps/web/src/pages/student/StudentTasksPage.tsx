import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, type Variants } from "framer-motion";
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

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
    <motion.section variants={itemVariants}>
      <div className="mb-3 flex items-center gap-2.5">
        <div className={cls("flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm", meta.chip)}>
          <Icon icon={meta.icon} size={16} />
        </div>
        <h3 className="text-[16px] font-bold text-ink">{t(meta.labelKey)}</h3>
        <span className="rounded-pill bg-surface border border-line px-2.5 py-0.5 text-[12.5px] font-bold text-ink-soft shadow-sm">
          {task.type === "attendance_low" ? `${task.count}%` : task.count}
        </span>
      </div>

      {items.length === 0 ? (
        <Card interactive onClick={() => navigate(task.link)} className="flex items-center gap-3 py-4 transition-all hover:border-brand/30 hover:bg-bg">
          <p className="min-w-0 flex-1 text-[15px] font-medium text-ink">{t("attendanceLowHint", { pct: task.count })}</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Icon icon={ArrowRight} size={16} className="shrink-0" />
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-line p-0 overflow-hidden">
          {items.map((it, i) => (
            <button
              key={`${it.topicId}-${i}`}
              onClick={() => navigate(it.link)}
              className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-bg"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink transition-colors group-hover:text-brand-deep">{it.topicTitle}</p>
                <p className="truncate text-[13.5px] text-ink-soft mt-0.5">{it.courseName}</p>
              </div>
              {it.value !== undefined && it.value !== null && (
                <span className="shrink-0 text-[18px] font-bold tabular-nums text-emerald">{it.value}</span>
              )}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-ink-soft transition-colors group-hover:bg-brand-soft group-hover:text-brand">
                <Icon icon={ArrowRight} size={16} />
              </div>
            </button>
          ))}
        </Card>
      )}
    </motion.section>
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
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants}>
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
      </motion.div>

      {q.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : q.isError ? (
        <Card className="mt-5">
          <p className="py-4 text-center text-body text-rose">{t("error")}</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-8">
            {/* O'qituvchi topshiriqlari */}
            {showTeacher && assigned.length > 0 && (
              <motion.section variants={itemVariants}>
                <h2 className="mb-4 text-section font-bold tracking-tight text-ink">{t("teacherAssignedSection")}</h2>
                <div className="space-y-3">
                  <AnimatePresence>
                  {assigned.map((task) => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
                      >
                        <Card
                          className={cls("flex flex-wrap items-start justify-between gap-4 transition-all hover:shadow-md", isOverdue ? "border-rose/40 bg-rose/5" : "bg-surface")}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[15.5px] font-bold text-ink">{task.title}</p>
                              {task.priority === "HIGH" && <Badge tone="rose">{t("priorityHigh")}</Badge>}
                            </div>
                            {task.description && <p className="mt-1 text-[14px] text-ink-soft leading-relaxed">{task.description}</p>}
                            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-ink-faint">
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <Icon icon={UserRound} size={14} className="text-ink-soft" /> {task.createdByName}
                              </span>
                              {task.dueDate && (
                                <span className={cls("inline-flex items-center gap-1.5 font-medium", isOverdue && "font-bold text-rose")}>
                                  <Icon icon={Clock} size={14} /> {fmt(task.dueDate)}
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
                              variant={isOverdue ? "primary" : "soft"}
                              size="sm"
                              icon={<Icon icon={CheckCircle2} size={16} />}
                              onClick={() => done.mutate(task.id)}
                              disabled={done.isPending && done.variables === task.id}
                              className={isOverdue ? "bg-rose hover:bg-rose/90 text-white" : ""}
                            >
                              {t("markDone")}
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </div>
              </motion.section>
            )}

            {/* O'quv vazifalari — konkret mavzular */}
            {showStudy && auto.length > 0 && (
              <motion.section variants={itemVariants}>
                <h2 className="mb-4 text-section font-bold tracking-tight text-ink">{t("studySection")}</h2>
                <div className="space-y-6">
                  {auto.map((task) => (
                    <AutoTaskGroup key={task.type} task={task} />
                  ))}
                </div>
              </motion.section>
            )}

            {nothing && (
              <motion.div variants={itemVariants}>
                <Card className="flex items-center gap-3 border-emerald/30 bg-emerald-soft shadow-sm p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-soft text-emerald shadow-sm">
                    <Icon icon={Sparkles} size={24} />
                  </div>
                  <p className="text-[16px] font-bold text-emerald">{t("studentAllDone")}</p>
                </Card>
              </motion.div>
            )}

            {!nothing && ((showTeacher && assigned.length === 0 && filter !== "all") || (showStudy && auto.length === 0 && filter === "study")) && (
              <motion.div variants={itemVariants}>
                <Card className="bg-surface border-dashed p-8 text-center">
                  <p className="text-[15px] text-ink-faint">{t("noMatchFilter")}</p>
                </Card>
              </motion.div>
            )}
          </div>

          {/* O'ng ustun — kontekst */}
          <aside className="min-w-0 space-y-6">
            <motion.div variants={itemVariants}>
              <RailCard
                title={t("upcomingLessons")}
                icon={CalendarDays}
                action={{ label: t("open"), onClick: () => navigate("/app/schedule") }}
              >
                {schedule.length === 0 ? (
                  <p className="px-5 py-5 text-[14px] text-ink-faint">{t("noLessonsShort")}</p>
                ) : (
                  <div className="divide-y divide-line">
                    {schedule.slice(0, 3).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => navigate("/app/schedule")}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-bg"
                      >
                        <div className="w-10 shrink-0 text-center">
                          <p className="text-[17px] font-bold leading-none tabular-nums text-brand-deep">
                            {new Date(s.date).getDate()}
                          </p>
                          <p className="mt-0.5 text-[12px] tabular-nums text-ink-soft">
                            {`${String(new Date(s.date).getHours()).padStart(2, "0")}:${String(new Date(s.date).getMinutes()).padStart(2, "0")}`}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1 border-l border-line pl-4">
                          <p className="truncate text-[15px] font-semibold text-ink">{s.title ?? s.courseName}</p>
                          <p className="truncate text-[13.5px] text-ink-soft mt-0.5">{s.courseName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </RailCard>
            </motion.div>

            <motion.div variants={itemVariants}>
              <RailCard title={t("doneSection")} icon={ClipboardCheck}>
                {history.length === 0 ? (
                  <p className="px-5 py-5 text-[14px] text-ink-faint">{t("noDoneYet")}</p>
                ) : (
                  <>
                    <button
                      onClick={() => setHistoryOpen((o) => !o)}
                      className="flex w-full items-center gap-2 px-5 py-3 text-left text-[14px] font-semibold uppercase tracking-wide text-ink-soft transition-colors hover:bg-bg"
                    >
                      <Icon
                        icon={ChevronDown}
                        size={15}
                        className={cls("transition-transform", !historyOpen && "-rotate-90")}
                      />
                      {t("doneCountN", { n: history.length })}
                    </button>
                    <AnimatePresence>
                    {historyOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-line"
                      >
                        <div className="divide-y divide-line">
                          {history.slice(0, 8).map((h) => (
                            <div key={h.id} className="flex items-center gap-3 px-5 py-3 bg-bg">
                              <Icon icon={CheckCircle2} size={16} className="shrink-0 text-emerald/60" />
                              <p className="min-w-0 flex-1 truncate text-[14px] text-ink-soft line-through">{h.title}</p>
                              {h.doneAt && <span className="shrink-0 text-[12.5px] font-medium text-ink-faint tabular-nums">{fmt(h.doneAt)}</span>}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    </AnimatePresence>
                  </>
                )}
              </RailCard>
            </motion.div>
          </aside>
        </div>
      )}
    </motion.div>
  );
}
