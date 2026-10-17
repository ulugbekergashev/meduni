import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ClipboardList, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Icon, Input, ProgressBar, Select, Textarea, cls, useToast } from "@meduni/ui";
import { BentoCard, PageHeader } from "../../../components/bento";
import { Field } from "../../../components/Field";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { apiErrorMessage } from "../../../lib/api";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import { IconAction, PillTabs } from "../components";
import {
  useCreatedTasks,
  useCreateTask,
  useDeleteTask,
  useDepartments,
  useTeacherOptions,
  type CreatedTaskGroup,
  type CreateTaskBody,
} from "../api";

/** Tayinlangan topshiriq qatori — k/N bajarilish chizig'i bilan. */
function CreatedRow({ g, onDelete }: { g: CreatedTaskGroup; onDelete: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminTasks" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const allDone = g.done === g.total;
  const pct = g.total > 0 ? Math.round((g.done / g.total) * 100) : 0;
  return (
    <div className="flex items-start gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-raised">
      <span
        className={cls(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          allDone ? "bg-emerald-soft text-emerald" : "bg-violet-soft text-violet"
        )}
      >
        <Icon icon={allDone ? CheckCircle2 : ClipboardList} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold text-ink">{g.title}</p>
        {g.description && <p className="mt-0.5 line-clamp-2 text-note text-ink-2">{g.description}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-micro text-ink-soft">
          {g.dueDate && (
            <span>
              {t("dueLabel")}: {formatDate(locale === "ru" ? "ru" : "uz", g.dueDate, "shortYear")}
            </span>
          )}
          <span className="truncate">
            {g.assignees.slice(0, 3).join(", ")}
            {g.assignees.length > 3 ? " +" + (g.assignees.length - 3) : ""}
          </span>
        </p>
      </div>
      <div className="hidden w-32 shrink-0 pt-1 sm:block">
        <div className="flex items-center justify-between text-micro">
          <span className="text-ink-soft">{t("progressLabel")}</span>
          <span className={cls("font-data font-semibold tabular-nums", allDone ? "text-emerald" : "text-ink")}>
            {g.done}/{g.total}
          </span>
        </div>
        <ProgressBar value={pct} tone={allDone ? "emerald" : "brand"} className="mt-1" />
      </div>
      <span className={cls("pt-1 font-data text-note font-semibold tabular-nums sm:hidden", allDone ? "text-emerald" : "text-ink")}>
        {g.done}/{g.total}
      </span>
      <IconAction icon={Trash2} label={tc("delete")} tone="rose" onClick={onDelete} />
    </div>
  );
}

export function AdminTasksPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "adminTasks" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();

  const teachers = useTeacherOptions();
  const depts = useDepartments();
  const created = useCreatedTasks();
  const create = useCreateTask();
  const del = useDeleteTask();

  const [target, setTarget] = useState<"teacher" | "department">("teacher");
  const [teacherId, setTeacherId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [deleting, setDeleting] = useState<CreatedTaskGroup | null>(null);

  const canSubmit = !!title.trim() && (target === "teacher" ? !!teacherId : !!departmentId);
  const items = created.data ?? [];

  const submit = () => {
    const body: CreateTaskBody = { title: title.trim(), description: description.trim() || undefined, dueDate: dueDate || null };
    if (target === "teacher") body.teacherId = Number(teacherId);
    else body.departmentId = Number(departmentId);
    create.mutate(body, {
      onSuccess: (r) => {
        show(t("assigned", { count: r.count }));
        setTitle("");
        setDescription("");
        setDueDate("");
      },
    });
  };

  return (
    <div className="space-y-3">
      <PageHeader className="mb-0" title={t("title")} subtitle={t("hint")} />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Assign form */}
        <BentoCard title={t("newTask")} className="self-start">
          <div className="space-y-3">
            <div>
              <span className="mb-1 block text-micro font-semibold text-ink-soft">{t("target")}</span>
              <PillTabs
                value={target}
                onChange={setTarget}
                options={[
                  { key: "teacher", label: t("targetTeacher") },
                  { key: "department", label: t("targetDepartment") },
                ]}
              />
            </div>
            {target === "teacher" ? (
              <Field label={t("teacher")}>
                <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  <option value="">—</option>
                  {(teachers.data ?? []).map((tt) => (
                    <option key={tt.id} value={tt.id}>{tt.fullName}</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label={t("department")}>
                <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">—</option>
                  {(depts.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={t("taskTitle")}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("taskTitlePh")} />
            </Field>
            <Field label={t("desc")}>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </Field>
            <Field label={t("due")}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            {create.isError && <p className="text-note text-rose">{apiErrorMessage(create.error, locale) ?? t("error")}</p>}
            <Button size="lg" icon={<Icon icon={Plus} size={16} />} onClick={submit} disabled={!canSubmit || create.isPending}>
              {t("assign")}
            </Button>
          </div>
        </BentoCard>

        {/* Created tasks */}
        <BentoCard
          className="self-start"
          title={t("created")}
          count={items.length}
          isLoading={created.isLoading}
          isError={created.isError}
          onRetry={() => created.refetch()}
          bodyClassName="px-2 pb-3"
        >
          {items.length === 0 ? (
            <div className="px-2 py-2">
              <EmptyState icon={<Icon icon={ClipboardList} size={22} />} text={t("emptyCreated")} />
            </div>
          ) : (
            <ul className="space-y-0.5">
              {items.map((g) => (
                <li key={g.key}>
                  <CreatedRow g={g} onDelete={() => setDeleting(g)} />
                </li>
              ))}
            </ul>
          )}
        </BentoCard>
      </div>

      <ConfirmDialog
        open={!!deleting}
        title={t("deleteTitle")}
        message={t("deleteMsg")}
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
