import { useMemo, useState } from "react";
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
import { Button, Card, Icon, Input, Modal, Select, Spinner, Textarea, useToast } from "@meduni/ui";
import { Field } from "../../components/Field";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TaskCard } from "../../components/TaskCard";
import { AssignedTaskList } from "../../components/AssignedTaskList";
import { CreatedTaskList, type CreatedTaskGroupItem } from "../../components/CreatedTaskList";
import { apiErrorMessage } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import {
  useAssignTask,
  useDeleteMyTask,
  useMyCreatedTasks,
  useSetTaskDone,
  useTeachGroups,
  useTeachTasks,
  type AssignTaskBody,
} from "./api";

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

/** "New assignment" modal: teacher → whole group or a single student. */
function AssignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teachAssign" });
  const locale = useLocale();
  const { show } = useToast();
  const groups = useTeachGroups();
  const assign = useAssignTask();

  const [target, setTarget] = useState<"group" | "student">("group");
  const [groupId, setGroupId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Students of the selected group (for the single-student mode).
  const students = useMemo(() => {
    const g = (groups.data ?? []).find((x) => String(x.id) === groupId);
    return g?.students ?? [];
  }, [groups.data, groupId]);

  const canSubmit = !!title.trim() && !!groupId && (target === "group" || !!studentId);

  const submit = () => {
    const body: AssignTaskBody = { title: title.trim(), description: description.trim() || undefined, dueDate: dueDate || null };
    if (target === "group") body.groupId = Number(groupId);
    else body.studentId = Number(studentId);
    assign.mutate(body, {
      onSuccess: (r) => {
        show(t("assigned", { count: r.count }));
        setTitle("");
        setDescription("");
        setDueDate("");
        onClose();
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("target")}>
          <Select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value as "group" | "student");
              setStudentId("");
            }}
          >
            <option value="group">{t("targetGroup")}</option>
            <option value="student">{t("targetStudent")}</option>
          </Select>
        </Field>
        <Field label={t("group")}>
          <Select
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              setStudentId("");
            }}
          >
            <option value="">—</option>
            {(groups.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        {target === "student" && (
          <div className="sm:col-span-2">
            <Field label={t("student")}>
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">—</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label={t("taskTitle")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("taskTitlePh")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t("desc")}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
        </div>
        <Field label={t("due")}>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      {assign.isError && <p className="mt-3 text-body text-rose">{apiErrorMessage(assign.error, locale) ?? t("error")}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button icon={<Icon icon={Plus} size={16} />} onClick={submit} disabled={!canSubmit || assign.isPending}>
          {t("assign")}
        </Button>
      </div>
    </Modal>
  );
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
        <section className="mt-6">
          <h2 className="mb-3 text-section font-bold text-ink">{t("assignedSection")}</h2>
          <AssignedTaskList items={assigned} onDone={(id) => done.mutate(id)} pendingId={done.isPending ? (done.variables as number) : null} locale={locale} />
        </section>
      )}

      {/* Auto-derived tasks */}
      <section className="mt-6">
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
        <section className="mt-8">
          <h2 className="mb-3 text-section font-bold text-ink">{ta("mySection")}</h2>
          <CreatedTaskList items={created.data ?? []} onDelete={setDeleting} locale={locale} />
        </section>
      )}

      <AssignModal open={assignOpen} onClose={() => setAssignOpen(false)} />

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
