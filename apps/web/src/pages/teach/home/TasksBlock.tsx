import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button, EmptyState, Icon, MiniBars, Segmented, useToast } from "@meduni/ui";
import { BentoCard } from "../../../components/bento";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { QuickTaskModal } from "../../../components/QuickTaskModal";
import { monthShortLabel } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import { RollCallModal } from "../course/attendance/RollCallModal";
import { TaskItemRow, type RollCallTarget } from "../tasks/TaskItemRow";
import { useDeleteMyTask, useTaskBoard, type TeacherTaskItem } from "../api";

/**
 * Vazifalar — ALOHIDA SAHIFA emas, bosh sahifadagi blok (2026-08-03).
 *
 * ⚠️ TAKROR BO'LMASLIGI: to'liq bort "bugun bajarish kerak" ro'yxatini
 * PASTGA QO'SHMAYDI — o'sha ro'yxatning O'ZINI almashtiradi. Yig'ilgan holatda
 * 5 ta eng shoshilinch qator, ochilganda — filtrlar + hammasi + oylik grafik.
 * Bitta fakt bitta joyda (§4). Dizayn v3: bitta `BentoCard`.
 */

type Status = "todo" | "overdue" | "waiting" | "done";
type Source = "all" | "kafedra" | "students";

const MAX_COLLAPSED = 5;

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

/** Eng shoshilinch ochiq vazifalar — muddati o'tganlar birinchi, keyin eng eskisi. */
export function urgentTasks(items: TeacherTaskItem[], limit = MAX_COLLAPSED): TeacherTaskItem[] {
  return items
    .filter((i) => i.status !== "done")
    .sort((a, b) => {
      if ((a.status === "overdue") !== (b.status === "overdue")) return a.status === "overdue" ? -1 : 1;
      return (a.sinceIso ?? "").localeCompare(b.sinceIso ?? "");
    })
    .slice(0, limit);
}

export function TasksBlock({
  expanded,
  onExpand,
  className,
}: {
  expanded: boolean;
  onExpand: (v: boolean) => void;
  className?: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const { t: ta } = useTranslation(undefined, { keyPrefix: "teachAssign" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "teach" });
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

  const urgent = useMemo(() => urgentTasks(board?.items ?? []), [board]);
  const visible = useMemo(
    () => (board?.items ?? []).filter((i) => matchesStatus(i, status) && (source === "all" || i.source === source)),
    [board, status, source]
  );

  const rows = expanded ? visible : urgent;
  const st = board?.stats;
  const cnt = board?.counts;
  const openCount = st?.toDo ?? 0;

  const emptyText =
    expanded && status === "done" ? t("noDoneYet") : expanded && source !== "all" ? t("noMatchFilter") : tt("allDone");

  return (
    <>
      <BentoCard
        className={className}
        title={tt("todoTitle")}
        count={openCount}
        isLoading={q.isLoading}
        isError={q.isError}
        onRetry={() => q.refetch()}
        bodyClassName="px-2 pb-3"
        right={
          <span className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Icon icon={Plus} size={14} />}
              onClick={() => setAssignOpen(true)}
              aria-label={ta("newBtn")}
            >
              <span className="hidden sm:inline">{ta("newBtn")}</span>
            </Button>
            <button
              type="button"
              onClick={() => onExpand(!expanded)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 text-note font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {expanded ? tc("collapse") : t("showAll")}
              <Icon icon={expanded ? ChevronDown : ChevronRight} size={14} />
            </button>
          </span>
        }
      >
        {/* Filtrlar — FAQAT ochilganda (yig'ilganda ular ortiqcha boshqaruv) */}
        {expanded && (
          <div className="mb-2 flex flex-wrap items-center gap-2 px-2">
            <div className="max-w-full overflow-x-auto">
              <Segmented
                size="sm"
                value={status}
                onChange={setStatus}
                aria-label={tt("todoTitle")}
                options={[
                  { key: "todo", label: t("statToDo"), count: st?.toDo ?? 0 },
                  { key: "overdue", label: t("statOverdue"), count: st?.overdue ?? 0 },
                  { key: "waiting", label: t("statWaiting"), count: st?.waiting ?? 0 },
                  { key: "done", label: t("statDoneMonths", { n: 6 }), count: st?.done ?? 0 },
                ]}
              />
            </div>
            <div className="flex max-w-full items-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-micro font-semibold text-ink-soft">{t("sourceLabel")}:</span>
              <Segmented
                size="sm"
                value={source}
                onChange={setSource}
                aria-label={t("sourceLabel")}
                options={[
                  { key: "all", label: t("filterAll"), count: cnt?.all },
                  { key: "kafedra", label: t("filterKafedra"), count: cnt?.kafedra },
                  { key: "students", label: t("filterStudents"), count: cnt?.students },
                ]}
              />
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-2 py-4">
            <EmptyState icon={<Icon icon={CheckCircle2} size={20} />} text={emptyText} />
          </div>
        ) : (
          <ul className="space-y-0.5">
            {rows.map((item) => (
              <li key={item.id}>
                <TaskItemRow item={item} onRollCall={setRollCall} onDelete={expanded ? setDeleting : undefined} />
              </li>
            ))}
          </ul>
        )}

        {!expanded && openCount > rows.length && (
          <button
            type="button"
            onClick={() => onExpand(true)}
            className="mx-2 mt-1 inline-flex items-center gap-0.5 self-start text-note font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {tt("todoAll", { n: openCount })} <Icon icon={ChevronRight} size={14} />
          </button>
        )}

        {/* Oylik bajarilgan vazifalar — faqat ochilganda (statistika, kundalik ish emas) */}
        {expanded && board && board.months.some((m) => m.count > 0) && (
          <div className="mx-2 mt-3 rounded-control bg-surface-raised p-3">
            <p className="mb-2 text-micro text-ink-soft">{t("historyDoneLastMonths", { n: 6 })}</p>
            <MiniBars
              tone={status === "done" ? "emerald" : "brand"}
              height={72}
              data={board.months.map((m) => ({ label: monthShortLabel(locale, m.key), value: m.count }))}
            />
          </div>
        )}
      </BentoCard>

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
    </>
  );
}
