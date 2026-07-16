import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { Button, Card, Icon, Input, Modal, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { DataTable, RowActions } from "../../../components/DataTable";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useCreate, useList, useRemove, useUpdate } from "../../../lib/crud";
import { useLocale } from "../../../lib/useLocale";
import type { Faculty } from "./types";

type NameInput = { name: string };

export function FacultiesTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();

  const list = useList<Faculty>("faculties");
  const create = useCreate<NameInput, Faculty>("faculties");
  const update = useUpdate<NameInput, Faculty>("faculties");
  const remove = useRemove("faculties");

  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Faculty | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Faculty | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError(tc("nameRequired"));
      return;
    }
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName("");
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
      { id: editing.id, body: { name: editing.name.trim() } },
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
        <h2 className="mb-4 text-section font-bold text-ink">{t("addFacultyForm")}</h2>
        <form onSubmit={onAdd} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[260px] flex-1">
            <Field label={tc("name")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" icon={<span className="text-lg leading-none">+</span>} disabled={create.isPending}>
            {tc("add")}
          </Button>
          {formError && <p className="w-full text-[13px] text-rose">{formError}</p>}
        </form>
      </Card>

      {/* Table */}
      <AsyncSection
        isLoading={list.isLoading}
        isError={list.isError}
        isEmpty={rows.length === 0}
        emptyIcon={<Icon icon={Building2} size={22} />}
        emptyText={t("emptyFaculties")}
        onRetry={() => list.refetch()}
      >
        <DataTable headers={[tc("name"), tc("actions")]}>
          {rows.map((f) => (
            <tr key={f.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-medium text-ink">{f.name}</td>
              <td className="px-4 py-3">
                <RowActions
                  onEdit={() => {
                    setEditError(null);
                    setEditing({ ...f });
                  }}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleting(f);
                  }}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      </AsyncSection>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("editFaculty")}>
        {editing && (
          <form onSubmit={onSaveEdit} className="space-y-4">
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
        message={t("confirmDeleteFaculty")}
        errorMessage={deleteError}
        loading={remove.isPending}
        onConfirm={onConfirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
