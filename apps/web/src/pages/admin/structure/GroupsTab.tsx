import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Users } from "lucide-react";
import { Button, Icon, Input, Modal, Select, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { DataTable, RowActions } from "../../../components/DataTable";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useCreate, useList, useRemove, useUpdate } from "../../../lib/crud";
import { useLocale } from "../../../lib/useLocale";
import type { Faculty, Group } from "./types";

type GroupInput = { facultyId: number; name: string; yearOfStudy: number };

const YEARS = [1, 2, 3, 4, 5, 6];

export function GroupsTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();

  const faculties = useList<Faculty>("faculties");
  const facultyOptions = faculties.data ?? [];

  const [filterFaculty, setFilterFaculty] = useState<string>("");
  const list = useList<Group>("groups", { facultyId: filterFaculty || undefined });

  const create = useCreate<GroupInput, Group>("groups");
  const update = useUpdate<GroupInput, Group>("groups");
  const remove = useRemove("groups");

  const [addOpen, setAddOpen] = useState(false);
  const [facultyId, setFacultyId] = useState<string>("");
  const [name, setName] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState<string>("1");
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Group | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Group | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasFaculties = facultyOptions.length > 0;

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    create.mutate(
      { facultyId: Number(facultyId), name: name.trim(), yearOfStudy: Number(yearOfStudy) },
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
        body: { facultyId: editing.facultyId, name: editing.name.trim(), yearOfStudy: editing.yearOfStudy },
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
              {t("addGroupForm")}
            </Button>
          ) : (
            <p className="text-[13px] text-ink-soft">{t("noFacultyFirst")}</p>
          )}
        </div>
      </div>

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t("addGroupForm")}>
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
          <Field label={t("groupName")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("groupNamePlaceholder")}
              autoFocus
              required
            />
          </Field>
          <Field label={t("yearOfStudy")}>
            <Select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
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
        emptyIcon={<Icon icon={Users} size={22} />}
        emptyText={t("emptyGroups")}
        onRetry={() => list.refetch()}
      >
        <DataTable headers={[t("faculty"), t("groupName"), t("year"), t("studentCount"), tc("actions")]}>
          {rows.map((g) => (
            <tr key={g.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 text-ink-soft">{g.facultyName}</td>
              <td className="px-4 py-3 font-medium text-ink">{g.name}</td>
              <td className="px-4 py-3 text-ink-soft">{g.yearOfStudy}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-pill bg-blue-soft px-2.5 py-0.5 text-[12px] font-semibold text-blue">
                  {g.studentCount}
                </span>
              </td>
              <td className="px-4 py-3">
                <RowActions
                  onEdit={() => {
                    setEditError(null);
                    setEditing({ ...g });
                  }}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleting(g);
                  }}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      </AsyncSection>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("editGroup")}>
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
            <Field label={t("groupName")}>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                required
              />
            </Field>
            <Field label={t("yearOfStudy")}>
              <Select
                value={editing.yearOfStudy}
                onChange={(e) => setEditing({ ...editing, yearOfStudy: Number(e.target.value) })}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
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
        message={t("confirmDeleteGroup")}
        errorMessage={deleteError}
        loading={remove.isPending}
        onConfirm={onConfirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
