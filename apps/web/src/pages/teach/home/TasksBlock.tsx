import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button, Card, Icon, MiniBars, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
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
 * ⚠️ TAKROR BO'LMASLIGI (buyurtmachi: "prosta qoyib qoymasdan, vazifalar bor
 * ham shekilli uje?"): bosh sahifada allaqachon "bugun bajarish kerak" ro'yxati
 * bor edi. Shuning uchun to'liq bort uni PASTGA QO'SHMAYDI — o'sha ro'yxatning
 * O'ZINI almashtiradi. Yig'ilgan holatda 5 ta eng shoshilinch qator, ochilganda
 * — filtrlar + hammasi + oylik grafik. Bitta fakt bitta joyda (§4).
 *
 * Holat kartalari (4 ta StatCard) ham OLIB TASHLANDI: bosh sahifada ular
 * beshinchi raqamlar to'plami bo'lib qolardi. O'rniga — chiplar, ular ham
 * filtr, ham hisob.
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

export function TasksBlock({ expanded, onExpand }: { expanded: boolean; onExpand: (v: boolean) => void }) {
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

  /** Yig'ilgan holat — eng shoshilinch 5 ta (muddati o'tganlar birinchi). */
  const urgent = useMemo(() => {
    const open = (board?.items ?? []).filter((i) => i.status !== "done");
    return [...open]
      .sort((a, b) => {
        if ((a.status === "overdue") !== (b.status === "overdue")) return a.status === "overdue" ? -1 : 1;
        return (a.sinceIso ?? "").localeCompare(b.sinceIso ?? "");
      })
      .slice(0, MAX_COLLAPSED);
  }, [board]);

  /** Ochilgan holat — holat × manba kesimi. */
  const visible = useMemo(
    () => (board?.items ?? []).filter((i) => matchesStatus(i, status) && (source === "all" || i.source === source)),
    [board, status, source]
  );

  const rows = expanded ? visible : urgent;
  const st = board?.stats;
  const cnt = board?.counts;
  const openCount = st?.toDo ?? 0;

  const statusChips: { key: Status; label: string; value?: number; tone: string }[] = [
    { key: "todo", label: t("statToDo"), value: st?.toDo, tone: "border-brand bg-brand-soft text-brand-deep" },
    { key: "overdue", label: t("statOverdue"), value: st?.overdue, tone: "border-rose bg-rose-soft text-rose" },
    { key: "waiting", label: t("statWaiting"), value: st?.waiting, tone: "border-blue bg-blue-soft text-blue" },
    { key: "done", label: t("statDoneMonths", { n: 6 }), value: st?.done, tone: "border-emerald bg-emerald-soft text-emerald" },
  ];

  const sourceChips: { key: Source; label: string; count?: number }[] = [
    { key: "all", label: t("filterAll"), count: cnt?.all },
    { key: "kafedra", label: t("filterKafedra"), count: cnt?.kafedra },
    { key: "students", label: t("filterStudents"), count: cnt?.students },
  ];

  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-section font-bold text-ink">
          {tt("todoTitle")}
          {openCount > 0 && <span className="ml-2 text-note font-semibold text-ink-faint">{openCount}</span>}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={<Icon icon={Plus} size={15} />} onClick={() => setAssignOpen(true)}>
            {ta("newBtn")}
          </Button>
          <button
            onClick={() => onExpand(!expanded)}
            className="inline-flex items-center gap-1 rounded-control border border-line px-2.5 py-1.5 text-note font-semibold text-ink-soft transition-colors hover:bg-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={expanded ? ChevronDown : ChevronRight} size={14} />
            {expanded ? tc("collapse") : t("showAll")}
          </button>
        </div>
      </div>

      {/* Filtrlar — FAQAT ochilganda (yig'ilganda ular ortiqcha boshqaruv) */}
      {expanded && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {statusChips.map((c) => (
              <button
                key={c.key}
                onClick={() => setStatus(c.key)}
                className={cls(
                  "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-note font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  status === c.key ? c.tone : "border-line bg-surface text-ink-soft hover:bg-bg hover:text-ink"
                )}
              >
                {c.label}
                <span className="tabular-nums text-micro opacity-70">{q.isLoading ? "—" : c.value ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-micro font-semibold uppercase tracking-wider text-ink-faint">{t("sourceLabel")}:</span>
            {sourceChips.map((c) => (
              <button
                key={c.key}
                onClick={() => setSource(c.key)}
                className={cls(
                  "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-micro font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  source === c.key ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-surface text-ink-soft hover:bg-bg hover:text-ink"
                )}
              >
                {c.label}
                {c.count !== undefined && <span className="tabular-nums opacity-70">{c.count}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <AsyncSection
        isLoading={q.isLoading}
        isError={q.isError}
        isEmpty={rows.length === 0}
        emptyIcon={<Icon icon={CheckCircle2} size={24} />}
        emptyText={expanded && status === "done" ? t("noDoneYet") : expanded && source !== "all" ? t("noMatchFilter") : tt("allDone")}
        onRetry={() => q.refetch()}
      >
        <Card className="divide-y divide-line overflow-hidden p-0">
          {rows.map((item) => (
            <TaskItemRow key={item.id} item={item} onRollCall={setRollCall} onDelete={expanded ? setDeleting : undefined} />
          ))}
          {/* Yig'ilgan holatda: qolganini ochish + keys navbatiga o'tish */}
          {!expanded && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <button onClick={() => onExpand(true)} className="inline-flex items-center gap-0.5 text-note font-semibold text-brand-deep hover:text-brand">
                {tt("todoAll", { n: openCount })} <Icon icon={ChevronRight} size={14} />
              </button>
            </div>
          )}
        </Card>
      </AsyncSection>

      {/* Oylik bajarilgan vazifalar — faqat ochilganda (statistika, kundalik ish emas) */}
      {expanded && board && board.months.some((m) => m.count > 0) && (
        <Card>
          <p className="mb-3 text-note text-ink-faint">{t("historyDoneLastMonths", { n: 6 })}</p>
          <MiniBars
            tone={status === "done" ? "emerald" : "brand"}
            height={80}
            data={board.months.map((m) => ({ label: monthShortLabel(locale, m.key), value: m.count }))}
          />
        </Card>
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
    </section>
  );
}
