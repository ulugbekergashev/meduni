import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { BookMarked } from "lucide-react";
import { Button, Card, Icon, Input, Modal, Select, Textarea, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { DataTable, RowActions } from "../../../components/DataTable";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useCreate, useList, useRemove, useUpdate } from "../../../lib/crud";
import { pickName, useLocale } from "../../../lib/useLocale";
import type { Department, Subject } from "./types";

type SubjectInput = { departmentId: number; nameUz: string; nameRu: string; description?: string | null };

export function SubjectsTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();

  const departments = useList<Department>("departments");
  const deptOptions = departments.data ?? [];

  const [filterDept, setFilterDept] = useState<string>("");
  const list = useList<Subject>("subjects", { departmentId: filterDept || undefined });

  const create = useCreate<SubjectInput, Subject>("subjects");
  const update = useUpdate<SubjectInput, Subject>("subjects");
  const remove = useRemove("subjects");

  const [departmentId, setDepartmentId] = useState<string>("");
  const [nameUz, setNameUz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Subject | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasDepartments = deptOptions.length > 0;

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!nameUz.trim() && !nameRu.trim()) {
      setFormError(tc("nameRequired"));
      return;
    }
    create.mutate(
      {
        departmentId: Number(departmentId),
        nameUz: nameUz.trim(),
        nameRu: nameRu.trim(),
        description: description.trim() || null,
      },
      {
        onSuccess: () => {
          setNameUz("");
          setNameRu("");
          setDescription("");
          show(tc("added"));
        },
        onError: (err) => setFormError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  const onSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditError(null);
    update.mutate(
      {
        id: editing.id,
        body: {
          departmentId: editing.departmentId,
          nameUz: editing.nameUz.trim(),
          nameRu: editing.nameRu.trim(),
          description: editing.description?.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setEditing(null);
          show(tc("updated"));
        },
        onError: (err) => setEditError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  const onConfirmDelete = () => {
    if (!deleting) return;
    setDeleteError(null);
    remove.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        show(tc("deleted"));
      },
      onError: (err) => setDeleteError(apiErrorMessage(err, locale) ?? tc("genericError")),
    });
  };

  const rows = list.data ?? [];

  return (
    <div className="space-y-6">
      {/* Add form */}
      <Card>
        <h2 className="mb-4 text-section font-bold text-ink">{t("addSubjectForm")}</h2>
        {!hasDepartments ? (
          <p className="text-[13.5px] text-ink-soft">{t("noDepartmentFirst")}</p>
        ) : (
          <form onSubmit={onAdd} className="grid gap-4 sm:grid-cols-2">
            <Field label={t("department")}>
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
                <option value="" disabled>
                  {t("selectDepartment")}
                </option>
                {deptOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {pickName(locale, d.nameUz, d.nameRu)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="hidden sm:block" />
            <Field label={tc("nameUz")}>
              <Input value={nameUz} onChange={(e) => setNameUz(e.target.value)} />
            </Field>
            <Field label={tc("nameRu")}>
              <Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
            </Field>
            <p className="text-[12px] text-ink-faint sm:col-span-2">{tc("oneLangHint")}</p>
            <div className="sm:col-span-2">
              <Field label={t("descriptionOptional")}>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
            {formError && <p className="text-[13px] text-rose sm:col-span-2">{formError}</p>}
            <div className="sm:col-span-2">
              <Button type="submit" icon={<span className="text-lg leading-none">+</span>} disabled={create.isPending}>
                {tc("add")}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Filter */}
      {hasDepartments && (
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-ink-soft">{t("filterByDepartment")}:</span>
          <div className="w-56">
            <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">{t("allDepartments")}</option>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {pickName(locale, d.nameUz, d.nameRu)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {/* Table */}
      <AsyncSection
        isLoading={list.isLoading}
        isError={list.isError}
        isEmpty={rows.length === 0}
        emptyIcon={<Icon icon={BookMarked} size={22} />}
        emptyText={t("emptySubjects")}
        onRetry={() => list.refetch()}
      >
        <DataTable headers={[t("department"), tc("nameUz"), tc("nameRu"), tc("actions")]}>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 text-ink-soft">{pickName(locale, s.departmentNameUz, s.departmentNameRu)}</td>
              <td className="px-4 py-3 font-medium text-ink">{s.nameUz}</td>
              <td className="px-4 py-3 text-ink-soft">{s.nameRu}</td>
              <td className="px-4 py-3">
                <RowActions
                  onEdit={() => {
                    setEditError(null);
                    setEditing({ ...s });
                  }}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleting(s);
                  }}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      </AsyncSection>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("editSubject")}>
        {editing && (
          <form onSubmit={onSaveEdit} className="space-y-4">
            <Field label={t("department")}>
              <Select
                value={editing.departmentId}
                onChange={(e) => setEditing({ ...editing, departmentId: Number(e.target.value) })}
              >
                {deptOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {pickName(locale, d.nameUz, d.nameRu)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tc("nameUz")}>
              <Input
                value={editing.nameUz}
                onChange={(e) => setEditing({ ...editing, nameUz: e.target.value })}
                required
              />
            </Field>
            <Field label={tc("nameRu")}>
              <Input
                value={editing.nameRu}
                onChange={(e) => setEditing({ ...editing, nameRu: e.target.value })}
                required
              />
            </Field>
            <Field label={t("descriptionOptional")}>
              <Textarea
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </Field>
            {editError && <p className="text-[13px] text-rose">{editError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {tc("save")}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteSubject")}
        errorMessage={deleteError}
        loading={remove.isPending}
        onConfirm={onConfirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
