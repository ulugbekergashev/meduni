import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button, Icon, Input, Modal, Select, Textarea, useToast } from "@meduni/ui";
import { Field } from "./Field";
import { apiErrorMessage } from "../lib/api";
import { useLocale } from "../lib/useLocale";
import { useAssignTask, useTeachGroups, type AssignTaskBody } from "../pages/teach/api";

export interface QuickTaskPrefill {
  /** Bitta talabaga — reyting/baholash oqimidan ochilganda. */
  studentId?: number;
  studentName?: string;
  groupId?: number;
  title?: string;
}

/** Vazifa tayinlash modali. Vazifalar sahifasida ham, baholash/talaba/guruh
 *  ekranlarida ham ishlatiladi — `prefill` bilan ochilganda maqsad tayyor turadi. */
export function QuickTaskModal({
  open,
  onClose,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: QuickTaskPrefill;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "teachAssign" });
  const locale = useLocale();
  const { show } = useToast();
  const groups = useTeachGroups();
  const assign = useAssignTask();

  const pinnedStudent = prefill?.studentId !== undefined;
  const [target, setTarget] = useState<"group" | "student">(pinnedStudent ? "student" : "group");
  const [groupId, setGroupId] = useState(prefill?.groupId ? String(prefill.groupId) : "");
  const [studentId, setStudentId] = useState(prefill?.studentId ? String(prefill.studentId) : "");
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Har ochilishda prefill'ni qayta qo'llaymiz (modal DOM'da qolib ketadi).
  useEffect(() => {
    if (!open) return;
    setTarget(prefill?.studentId !== undefined ? "student" : "group");
    setStudentId(prefill?.studentId ? String(prefill.studentId) : "");
    setTitle(prefill?.title ?? "");
    setDescription("");
    setDueDate("");
    if (prefill?.groupId) setGroupId(String(prefill.groupId));
  }, [open, prefill?.studentId, prefill?.groupId, prefill?.title]);

  // Talaba oldindan berilgan bo'lsa, guruhini o'zimiz topamiz (tanlash shart emas).
  const resolvedGroupId = useMemo(() => {
    if (groupId) return groupId;
    if (!pinnedStudent) return "";
    const g = (groups.data ?? []).find((x) => x.students.some((s) => s.id === prefill!.studentId));
    return g ? String(g.id) : "";
  }, [groupId, groups.data, pinnedStudent, prefill]);

  const students = useMemo(() => {
    const g = (groups.data ?? []).find((x) => String(x.id) === resolvedGroupId);
    return g?.students ?? [];
  }, [groups.data, resolvedGroupId]);

  const canSubmit =
    !!title.trim() && (target === "student" ? !!studentId : !!resolvedGroupId);

  const submit = () => {
    const body: AssignTaskBody = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate || null,
    };
    if (target === "group") body.groupId = Number(resolvedGroupId);
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
      {pinnedStudent && prefill?.studentName ? (
        <p className="mb-3 rounded-control bg-brand-soft px-3 py-2 text-body text-brand-deep">
          {t("forStudent")}: <span className="font-bold">{prefill.studentName}</span>
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {!pinnedStudent && (
          <>
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
          </>
        )}

        <div className="sm:col-span-2">
          <Field label={t("taskTitle")}>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("taskTitlePh")} />
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
