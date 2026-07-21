import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  FileStack,
  Plus,
  ShieldAlert,
  Sparkles,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, Icon, Spinner, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TaskCard } from "../../components/TaskCard";
import { QuickTaskModal } from "../../components/QuickTaskModal";
import { AssignedTaskList } from "../../components/AssignedTaskList";
import { CreatedTaskList, type CreatedTaskGroupItem } from "../../components/CreatedTaskList";
import { useLocale } from "../../lib/useLocale";
import { useDeleteMyTask, useMyCreatedTasks, useSetTaskDone, useTeachTasks } from "./api";

const META: Record<string, { icon: LucideIcon; labelKey: string }> = {
  cases_review: { icon: ClipboardCheck, labelKey: "casesReview" },
  material_missing: { icon: FileStack, labelKey: "materialMissing" },
  digest_approve: { icon: BookOpen, labelKey: "digestApprove" },
  content_create: { icon: Sparkles, labelKey: "contentCreate" },
  content_publish: { icon: FileClock, labelKey: "contentPublish" },
  factcheck: { icon: ShieldAlert, labelKey: "factcheck" },
  attendance_unmarked: { icon: CalendarCheck, labelKey: "attendanceUnmarked" },
  students_behind: { icon: UserX, labelKey: "studentsBehind" },
};

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
  const auto = q.data?.auto ?? [];
  const assigned = q.data?.assigned ?? [];

  const [assignOpen, setAssignOpen] = useState(false);
  const [deleting, setDeleting] = useState<CreatedTaskGroupItem | null>(null);

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

      {/* Department assignments (from admin) */}
      {assigned.length > 0 && (
        <section className="mt-3">
          <h2 className="mb-3 text-section font-bold text-ink">{t("assignedSection")}</h2>
          <AssignedTaskList items={assigned} onDone={(id) => done.mutate(id)} pendingId={done.isPending ? (done.variables as number) : null} locale={locale} />
        </section>
      )}

      {/* Auto-derived tasks */}
      <section className="mt-3">
        <h2 className="mb-3 text-section font-bold text-ink">{t("autoSection")}</h2>
        {q.isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner size={22} />
          </div>
        ) : q.isError ? (
          <Card>
            <p className="py-4 text-center text-body text-rose">{t("error")}</p>
          </Card>
        ) : auto.length === 0 ? (
          <Card className="flex items-center gap-3 border-emerald/40 bg-emerald-soft">
            <Icon icon={CheckCircle2} size={22} className="text-emerald" />
            <p className="text-body font-semibold text-emerald">{t("allDone")}</p>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {auto.map((task) => {
              const meta = META[task.type];
              if (!meta) return null;
              return (
                <TaskCard
                  key={task.type}
                  icon={meta.icon}
                  tone={task.tone}
                  value={task.count}
                  label={t(meta.labelKey)}
                  onClick={() => navigate(task.link)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Assignments I gave to students */}
      {(created.data ?? []).length > 0 && (
        <section className="mt-4">
          <h2 className="mb-3 text-section font-bold text-ink">{ta("mySection")}</h2>
          <CreatedTaskList items={created.data ?? []} onDelete={setDeleting} locale={locale} />
        </section>
      )}

      <QuickTaskModal open={assignOpen} onClose={() => setAssignOpen(false)} />

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
