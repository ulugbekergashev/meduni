import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Landmark } from "lucide-react";
import { Button, Card, Icon, Input, Modal, Select, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { DataTable, RowActions } from "../../../components/DataTable";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useCreate, useList, useRemove, useUpdate } from "../../../lib/crud";
import { pickName, useLocale } from "../../../lib/useLocale";
import type { Department, Faculty } from "./types";

type DeptInput = { facultyId: number; nameUz: string; nameRu: string };

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

  const [facultyId, setFacultyId] = useState<string>("");
  const [nameUz, setNameUz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Department | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Department | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasFaculties = facultyOptions.length > 0;

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!nameUz.trim() && !nameRu.trim()) {
      setFormError(tc("nameRequired"));
      return;
    }
    create.mutate(
      { facultyId: Number(facultyId), nameUz: nameUz.trim(), nameRu: nameRu.trim() },
      {
        onSuccess: () => {
          setNameUz("");
          setNameRu("");
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
        body: { facultyId: editing.facultyId, nameUz: editing.nameUz.trim(), nameRu: editing.nameRu.trim() },
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
        <h2 className="mb-4 text-section font-bold text-ink">{t("addDepartmentForm")}</h2>
        {!hasFaculties ? (
          <p className="text-[13.5px] text-ink-soft">{t("noFacultyFirst")}</p>
        ) : (
          <form onSubmit={onAdd} className="grid gap-4 sm:grid-cols-2">
            <Field label={t("faculty")}>
              <Select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} required>
                <option value="" disabled>
                  {t("selectFaculty")}
                </option>
                {facultyOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {pickName(locale, f.nameUz, f.nameRu)}
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
      {hasFaculties && (
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-ink-soft">{t("filterByFaculty")}:</span>
          <div className="w-56">
            <Select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}>
              <option value="">{t("allFaculties")}</option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {pickName(locale, f.nameUz, f.nameRu)}
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
        emptyIcon={<Icon icon={Landmark} size={22} />}
        emptyText={t("emptyDepartments")}
        onRetry={() => list.refetch()}
      >
        <DataTable headers={[t("faculty"), tc("nameUz"), tc("nameRu"), tc("actions")]}>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 text-ink-soft">{pickName(locale, d.facultyNameUz, d.facultyNameRu)}</td>
              <td className="px-4 py-3 font-medium text-ink">{d.nameUz}</td>
              <td className="px-4 py-3 text-ink-soft">{d.nameRu}</td>
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
                    {pickName(locale, f.nameUz, f.nameRu)}
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
