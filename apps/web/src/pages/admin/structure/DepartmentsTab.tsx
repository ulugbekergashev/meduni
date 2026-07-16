import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Landmark, Plus } from "lucide-react";
import { Button, Icon, Input, Modal, Select, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { DataTable, RowActions } from "../../../components/DataTable";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useCreate, useList, useRemove, useUpdate } from "../../../lib/crud";
import { useLocale } from "../../../lib/useLocale";
import type { Department, Faculty } from "./types";

type DeptInput = { facultyId: number; name: string };

export function DepartmentsTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();

  const faculties = useList<Faculty>("faculties");
  const facultyOptions = faculties.data ?? [];

  const [filterFaculty, setFilterFaculty] = useState<string>("");
  const list = useList<Department>("departments", { facultyId: filterFaculty || undefined });

  const create = useCreate<DeptInput, Department>("departments");
  const update = useUpdate<DeptInput, Department>("departments");
  const remove = useRemove("departments");

  const [addOpen, setAddOpen] = useState(false);
  const [facultyId, setFacultyId] = useState<string>("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Department | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Department | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasFaculties = facultyOptions.length > 0;

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError(tc("nameRequired"));
      return;
    }
    create.mutate(
      { facultyId: Number(facultyId), name: name.trim() },
      {
        onSuccess: () => {
          setName("");
          setAddOpen(false);
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
        body: { facultyId: editing.facultyId, name: editing.name.trim() },
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
    <div className="space-y-4">
      {/* Toolbar: filter + add */}
      <div className="flex flex-wrap items-center gap-3">
        {hasFaculties && (
          <div className="w-56">
            <Select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}>
              <option value="">{t("allFaculties")}</option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <p className="text-[13px] text-ink-faint">{t("countLabel", { count: rows.length })}</p>
        <div className="ml-auto">
          {hasFaculties ? (
            <Button
              icon={<Icon icon={Plus} size={16} />}
              onClick={() => {
                setFormError(null);
                setName("");
                setAddOpen(true);
              }}
            >
              {t("addDepartmentForm")}
            </Button>
          ) : (
            <p className="text-[13px] text-ink-soft">{t("noFacultyFirst")}</p>
          )}
        </div>
      </div>

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t("addDepartmentForm")}>
        <form onSubmit={onAdd} className="space-y-4">
          <Field label={t("faculty")}>
            <Select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} required>
              <option value="" disabled>
                {t("selectFaculty")}
              </option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tc("name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          {formError && <p className="text-[13px] text-rose">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {tc("add")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Table */}
      <AsyncSection
        isLoading={list.isLoading}
        isError={list.isError}
        isEmpty={rows.length === 0}
        emptyIcon={<Icon icon={Landmark} size={22} />}
        emptyText={t("emptyDepartments")}
        onRetry={() => list.refetch()}
      >
        <DataTable headers={[t("faculty"), tc("name"), tc("actions")]}>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 text-ink-soft">{d.facultyName}</td>
              <td className="px-4 py-3 font-medium text-ink">{d.name}</td>
              <td className="px-4 py-3">
                <RowActions
                  onEdit={() => {
                    setEditError(null);
                    setEditing({ ...d });
                  }}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleting(d);
                  }}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      </AsyncSection>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("editDepartment")}>
        {editing && (
          <form onSubmit={onSaveEdit} className="space-y-4">
            <Field label={t("faculty")}>
              <Select
                value={editing.facultyId}
                onChange={(e) => setEditing({ ...editing, facultyId: Number(e.target.value) })}
              >
                {facultyOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tc("name")}>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                required
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
        message={t("confirmDeleteDepartment")}
        errorMessage={deleteError}
        loading={remove.isPending}
        onConfirm={onConfirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
