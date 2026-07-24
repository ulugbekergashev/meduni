import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FileStack,
  Plus,
  ShieldAlert,
  Sparkles,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, EmptyState, Icon, MiniBars, Spinner, cls, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TaskFeedRow } from "../../components/TaskFeedRow";
import { QuickTaskModal } from "../../components/QuickTaskModal";
import { CreatedTaskList, type CreatedTaskGroupItem } from "../../components/CreatedTaskList";
import { formatDate, monthShortLabel } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { RollCallModal } from "./course/attendance/RollCallModal";
import {
  useDeleteMyTask,
  useMyCreatedTasks,
  useSetTaskDone,
  useTaskHistory,
  useTeachTasks,
  type TeacherTaskItem,
} from "./api";

const KIND_META: Record<string, { icon: LucideIcon; labelKey: string }> = {
  cases_review: { icon: ClipboardCheck, labelKey: "casesReview" },
  material_missing: { icon: FileStack, labelKey: "materialMissing" },
  digest_approve: { icon: BookOpen, labelKey: "digestApprove" },
  content_create: { icon: Sparkles, labelKey: "contentCreate" },
  content_publish: { icon: FileClock, labelKey: "contentPublish" },
  factcheck: { icon: ShieldAlert, labelKey: "factcheck" },
  attendance_unmarked: { icon: CalendarCheck, labelKey: "attendanceUnmarked" },
  students_behind: { icon: UserX, labelKey: "studentsBehind" },
  assigned: { icon: ClipboardList, labelKey: "assignedKind" },
};

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
  const q = useTeachTasks();
  const done = useSetTaskDone();
  const created = useMyCreatedTasks();
  const del = useDeleteMyTask();
  const history = useTaskHistory();
  const feed = q.data?.feed ?? [];

  const [assignOpen, setAssignOpen] = useState(false);
  const [deleting, setDeleting] = useState<CreatedTaskGroupItem | null>(null);
  const [rollCall, setRollCall] = useState<RollCallTarget | null>(null);
  const [historySource, setHistorySource] = useState<"kafedra" | "toStudents">("kafedra");
  const historySeries = history.data?.[historySource];

  const ageText = (item: TeacherTaskItem): { text: string | null; overdue: boolean } => {
    if (item.kind === "assigned" && item.dueIso) {
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

      {/* Bitta ustuvorlik-navbat: avto-hisoblangan + kafedra tayinlagan ishlar
          muhimlik (rang) va eskilik bo'yicha saralangan bitta ro'yxatda. */}
      <section className="mt-3">
        {q.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner size={22} />
          </div>
        ) : q.isError ? (
          <Card>
            <p className="py-4 text-center text-body text-rose">{t("error")}</p>
          </Card>
        ) : feed.length === 0 ? (
          <EmptyState icon={<Icon icon={CheckCircle2} size={26} />} text={t("allDone")} />
        ) : (
          <Card className="divide-y divide-line overflow-hidden p-0">
            {feed.map((item) => {
              const meta = KIND_META[item.kind] ?? KIND_META.assigned;
              const age = ageText(item);
              const qa = item.quickAction;
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
                  onClick={() => handleRowClick(item)}
                  trailing={
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
                    ) : (
                      <Icon icon={ChevronRight} size={16} className="text-ink-faint" />
                    )
                  }
                />
              );
            })}
          </Card>
        )}
      </section>

      {/* Assignments I gave to students */}
      {(created.data ?? []).length > 0 && (
        <section className="mt-4">
          <h2 className="mb-3 text-section font-bold text-ink">{ta("mySection")}</h2>
          <CreatedTaskList items={created.data ?? []} onDelete={setDeleting} locale={locale} />
        </section>
      )}

      {/* Natijalar: oxirgi oylarda bajarilgan — kafedradan kelgan / talabalarga
          bergan filtri (bitta vaqtda bittasi ko'rinadi, ZICHLIK QOIDASI). */}
      <section className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-section font-bold text-ink">{t("historyTitle")}</h2>
          <div className="inline-flex gap-1 rounded-control border border-line bg-surface p-1">
            {(["kafedra", "toStudents"] as const).map((src) => (
              <button
                key={src}
                onClick={() => setHistorySource(src)}
                className={cls(
                  "whitespace-nowrap rounded-[8px] px-3 py-1.5 text-note font-semibold transition-all",
                  historySource === src ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink"
                )}
              >
                {t(src === "kafedra" ? "historyKafedra" : "historyToStudents")}
              </button>
            ))}
          </div>
        </div>

        <Card className="mt-3">
          {history.isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner size={20} />
            </div>
          ) : history.isError || !historySeries ? (
            <p className="py-4 text-center text-body text-rose">{t("error")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-stat font-bold leading-none text-ink">{historySeries.total}</p>
                  <p className="mt-1 text-note text-ink-faint">{t("historyDoneLastMonths", { n: 6 })}</p>
                </div>
              </div>
              <div className="mt-4">
                <MiniBars
                  tone={historySource === "kafedra" ? "blue" : "emerald"}
                  height={80}
                  data={historySeries.months.map((m) => ({ label: monthShortLabel(locale, m.key), value: m.count }))}
                />
              </div>
              {historySeries.recent.length > 0 ? (
                <div className="mt-4 divide-y divide-line border-t border-line">
                  {historySeries.recent.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-note font-semibold text-ink">{r.title}</p>
                        <p className="truncate text-micro text-ink-faint">{r.counterpart}</p>
                      </div>
                      <span className="shrink-0 text-micro text-ink-faint">{formatDate(locale === "ru" ? "ru" : "uz", r.completedAt, "short")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-note text-ink-faint">{t("historyEmpty")}</p>
              )}
            </>
          )}
        </Card>
      </section>

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
          deleting &&
          del.mutate(deleting.taskIds[0], {
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
