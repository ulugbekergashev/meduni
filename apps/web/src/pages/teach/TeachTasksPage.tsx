import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, ListTodo, Plus, Send, type LucideIcon } from "lucide-react";
import { Button, Card, EmptyState, Icon, MiniBars, Spinner, StatCard, cls, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { QuickTaskModal } from "../../components/QuickTaskModal";
import { monthShortLabel } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { RollCallModal } from "./course/attendance/RollCallModal";
import { TaskItemRow, type RollCallTarget } from "./tasks/TaskItemRow";
import { useDeleteMyTask, useTaskBoard, type TeacherTaskItem } from "./api";

/**
 * Ikki MUSTAQIL o'lcham (2026-08-02) — ilgari ikkalasi bitta `filter`
 * o'zgaruvchisiga yozardi va "Bajarilgan" boshqaruvi ikki joyda takrorlanardi.
 *   holat  — stat kartalari (bajarilishi kerak / muddati o'tgan / kutmoqda / bajarilgan)
 *   manba  — chiplar (hammasi / kafedradan / talabalarga)
 */
type Status = "todo" | "overdue" | "waiting" | "done";
type Source = "all" | "kafedra" | "students";

function matchesStatus(item: TeacherTaskItem, s: Status): boolean {
  switch (s) {
    case "todo":
      return item.status !== "done" && (item.source === "auto" || item.source === "kafedra");
    case "overdue":
      return item.status === "overdue";
    case "waiting":
      return item.source === "students" && item.status !== "done";
    case "done":
      return item.status === "done";
  }
}

function matchesSource(item: TeacherTaskItem, s: Source): boolean {
  return s === "all" || item.source === s;
}

export function TeachTasksPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const { t: ta } = useTranslation(undefined, { keyPrefix: "teachAssign" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const q = useTaskBoard();
  const del = useDeleteMyTask();
  const board = q.data;

  const [status, setStatus] = useState<Status>("todo");
  const [source, setSource] = useState<Source>("all");
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleting, setDeleting] = useState<TeacherTaskItem | null>(null);
  const [rollCall, setRollCall] = useState<RollCallTarget | null>(null);

  const visible = useMemo(
    () => (board?.items ?? []).filter((i) => matchesStatus(i, status) && matchesSource(i, source)),
    [board, status, source]
  );

  const st = board?.stats;
  const cnt = board?.counts;

  // Manba chiplari — holat kartalaridan MUSTAQIL kesim.
  const chips: { key: Source; label: string; count?: number }[] = [
    { key: "all", label: t("filterAll"), count: cnt?.all },
    { key: "kafedra", label: t("filterKafedra"), count: cnt?.kafedra },
    { key: "students", label: t("filterStudents"), count: cnt?.students },
  ];

  const cards: { key: Status; icon: LucideIcon; tone: string; value?: number; label: string }[] = [
    { key: "todo", icon: ListTodo, tone: "bg-brand-soft text-brand-deep", value: st?.toDo, label: t("statToDo") },
    { key: "overdue", icon: Clock, tone: "bg-rose-soft text-rose", value: st?.overdue, label: t("statOverdue") },
    { key: "waiting", icon: Send, tone: "bg-blue-soft text-blue", value: st?.waiting, label: t("statWaiting") },
    { key: "done", icon: CheckCircle2, tone: "bg-emerald-soft text-emerald", value: st?.done, label: t("statDoneMonths", { n: 6 }) },
  ];

  const monthTone = status === "done" ? "emerald" : "brand";

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

      {/* HOLAT — bosiladigan stat kartalar (filtr vazifasini bajaradi, shu sababli
          STAT DIETASI qoidasiga mos va qoladi). */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.key}
            icon={c.icon}
            tone={c.tone}
            value={q.isLoading ? "—" : c.value ?? 0}
            label={c.label}
            compact
            selected={status === c.key}
            onClick={() => setStatus(c.key)}
          />
        ))}
      </div>

      {/* MANBA — holatdan mustaqil kesim (yorliq bilan, aks holda ikki qator
          boshqaruv bir xil ko'rinib chalkashtiradi). */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-micro font-semibold uppercase tracking-wider text-ink-faint">{t("sourceLabel")}:</span>
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setSource(c.key)}
            className={cls(
              "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-note font-semibold transition-all",
              source === c.key
                ? "border-brand bg-brand-soft text-brand-deep"
                : "border-line bg-surface text-ink-soft hover:bg-bg hover:text-ink"
            )}
          >
            {c.label}
            {c.count !== undefined && (
              <span
                className={cls(
                  "rounded-pill px-1.5 text-micro tabular-nums",
                  source === c.key ? "bg-brand/15" : "text-ink-faint"
                )}
              >
                {c.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Vazifalar ro'yxati (holat × manba) */}
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
            icon={<Icon icon={status === "done" ? ListTodo : CheckCircle2} size={26} />}
            text={
              status === "done"
                ? t("noDoneYet")
                : source !== "all"
                  ? t("noMatchFilter")
                  : status === "todo"
                    ? t("allDone")
                    : t("noMatchFilter")
            }
          />
        ) : (
          <Card className="divide-y divide-line overflow-hidden p-0">
            {visible.map((item) => (
              <TaskItemRow key={item.id} item={item} onRollCall={setRollCall} onDelete={setDeleting} />
            ))}
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
