import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Plus } from "lucide-react";
import { Button, Card, Icon, Input, Select, Textarea, useToast } from "@meduni/ui";
import { Field } from "../../../components/Field";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { AsyncSection } from "../../../components/AsyncSection";
import { CreatedTaskList } from "../../../components/CreatedTaskList";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import {
  useCreatedTasks,
  useCreateTask,
  useDeleteTask,
  useDepartments,
  useTeacherOptions,
  type CreatedTaskGroup,
  type CreateTaskBody,
} from "../api";

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
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-0.5 text-note text-ink-faint">{t("hint")}</p>

      {/* Assign form */}
      <Card className="mt-6 space-y-4">
        <h2 className="text-section font-bold text-ink">{t("newTask")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("target")}>
            <Select value={target} onChange={(e) => setTarget(e.target.value as "teacher" | "department")}>
              <option value="teacher">{t("targetTeacher")}</option>
              <option value="department">{t("targetDepartment")}</option>
            </Select>
          </Field>
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
        {create.isError && <p className="text-body text-rose">{apiErrorMessage(create.error, locale) ?? t("error")}</p>}
        <Button icon={<Icon icon={Plus} size={16} />} onClick={submit} disabled={!canSubmit || create.isPending}>
          {t("assign")}
        </Button>
      </Card>

      {/* Created tasks */}
      <section className="mt-8">
        <h2 className="mb-3 text-section font-bold text-ink">{t("created")}</h2>
        <AsyncSection
          isLoading={created.isLoading}
          isError={created.isError}
          isEmpty={(created.data ?? []).length === 0}
          emptyIcon={<Icon icon={ClipboardList} size={22} />}
          emptyText={t("emptyCreated")}
          onRetry={() => created.refetch()}
        >
          <CreatedTaskList items={created.data ?? []} onDelete={setDeleting} locale={locale} />
        </AsyncSection>
      </section>

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
