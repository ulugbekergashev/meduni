import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BookMarked,
  Building2,
  ChevronDown,
  ChevronRight,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, EmptyState, Icon, Input, Modal, Select, Spinner, cls, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { api, apiErrorMessage } from "../../../lib/api";
import { useMe } from "../../../lib/auth";
import { useLocale } from "../../../lib/useLocale";

// ---- Tree payload ----

interface TreeSubject { id: number; name: string; description: string | null; courseCount: number }
interface TreeDept { id: number; name: string; teacherCount: number; subjects: TreeSubject[] }
interface TreeGroup { id: number; name: string; yearOfStudy: number; studentCount: number }
interface TreeFaculty { id: number; name: string; departments: TreeDept[]; groups: TreeGroup[] }

type EntityKind = "faculty" | "department" | "subject" | "group";

const RESOURCE: Record<EntityKind, string> = {
  faculty: "faculties",
  department: "departments",
  subject: "subjects",
  group: "groups",
};

interface ModalState {
  kind: EntityKind;
  /** Parent id for creates: faculty for dept/group, department for subject. */
  parentId?: number;
  /** Present when editing. */
  editing?: { id: number; name: string; description?: string | null; yearOfStudy?: number; parentId: number };
}

interface DeleteState { kind: EntityKind; id: number; name: string }

// ---- Small building blocks ----

function CountChip({ children }: { children: ReactNode }) {
  return <span className="rounded-pill bg-bg px-2 py-0.5 text-[11.5px] font-medium text-ink-soft">{children}</span>;
}

function RowAction({ icon, label, danger, onClick }: { icon: LucideIcon; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={label}
      aria-label={label}
      className={cls(
        "rounded-control p-1.5 text-ink-faint transition-colors",
        danger ? "hover:bg-rose-soft hover:text-rose" : "hover:bg-brand-soft hover:text-brand-deep"
      )}
    >
      <Icon icon={icon} size={15} />
    </button>
  );
}

function AddAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-1 rounded-pill border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-deep"
    >
      <Icon icon={Plus} size={13} /> {label}
    </button>
  );
}

// ---- Page ----

export function StructurePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const { data: me } = useMe();
  const qc = useQueryClient();

  const tree = useQuery({
    queryKey: ["structure-tree"],
    queryFn: () => api<TreeFaculty[]>("/api/v1/structure/tree"),
  });

  // Role gates (the tree itself is already scope-filtered server-side).
  const role = me?.role;
  const canFaculty = role === "superadmin";
  const canDeptGroup = role === "superadmin" || role === "faculty_admin";
  const canSubject = role === "superadmin" || role === "faculty_admin" || role === "dept_admin";

  // Expand state — faculties + single-faculty departments open by default.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized || !tree.data) return;
    const init = new Set<string>();
    for (const f of tree.data) {
      init.add(`f${f.id}`);
      if (tree.data.length === 1) for (const d of f.departments) init.add(`d${d.id}`);
    }
    setExpanded(init);
    setInitialized(true);
  }, [tree.data, initialized]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // One generic mutation for all CRUD — every write refreshes the tree and the
  // legacy list queries other pages (users/courses forms) still rely on.
  const mutate = useMutation({
    mutationFn: ({ method, path, body }: { method: string; path: string; body?: unknown }) =>
      api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["structure-tree"] });
      for (const k of Object.values(RESOURCE)) qc.invalidateQueries({ queryKey: [k] });
    },
  });

  // Modal form state
  const [modal, setModal] = useState<ModalState | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DeleteState | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openAdd = (kind: EntityKind, parentId?: number) => {
    setName("");
    setDescription("");
    setYearOfStudy("1");
    setFormError(null);
    setModal({ kind, parentId });
  };
  const openEdit = (kind: EntityKind, editing: NonNullable<ModalState["editing"]>) => {
    setName(editing.name);
    setDescription(editing.description ?? "");
    setYearOfStudy(String(editing.yearOfStudy ?? 1));
    setFormError(null);
    setModal({ kind, editing });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    setFormError(null);
    const { kind, editing, parentId } = modal;
    const base = RESOURCE[kind];
    const body: Record<string, unknown> = { name: name.trim() };
    if (kind === "subject") body.description = description.trim() || null;
    if (kind === "group") body.yearOfStudy = Number(yearOfStudy);
    if (!editing) {
      if (kind === "department" || kind === "group") body.facultyId = parentId;
      if (kind === "subject") body.departmentId = parentId;
    } else {
      // PATCH keeps the current parent; only the editable fields go up.
      if (kind === "department" || kind === "group") body.facultyId = editing.parentId;
      if (kind === "subject") body.departmentId = editing.parentId;
    }
    mutate.mutate(
      editing
        ? { method: "PATCH", path: `/api/v1/${base}/${editing.id}`, body }
        : { method: "POST", path: `/api/v1/${base}`, body },
      {
        onSuccess: () => {
          setModal(null);
          show(editing ? tc("updated") : tc("added"));
        },
        onError: (err) => setFormError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  const onConfirmDelete = () => {
    if (!deleting) return;
    setDeleteError(null);
    mutate.mutate(
      { method: "DELETE", path: `/api/v1/${RESOURCE[deleting.kind]}/${deleting.id}` },
      {
        onSuccess: () => {
          setDeleting(null);
          show(tc("deleted"));
        },
        onError: (err) => setDeleteError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  const modalTitle = modal
    ? modal.editing
      ? t(`edit.${modal.kind}`)
      : t(`add.${modal.kind}`)
    : "";

  const faculties = tree.data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">{t("subtitle")}</p>
        </div>
        {canFaculty && (
          <Button icon={<Icon icon={Plus} size={16} />} onClick={() => openAdd("faculty")}>
            {t("add.faculty")}
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {tree.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={26} /></div>
        ) : tree.isError ? (
          <Card><p className="py-6 text-center text-[13.5px] text-rose">{tc("genericError")}</p></Card>
        ) : faculties.length === 0 ? (
          <EmptyState
            icon={<Icon icon={Building2} size={24} />}
            text={t("emptyFaculties")}
            hint={t("emptyFacultiesHint")}
            action={canFaculty ? <Button size="sm" onClick={() => openAdd("faculty")}>{t("add.faculty")}</Button> : undefined}
          />
        ) : (
          faculties.map((f) => {
            const fOpen = expanded.has(`f${f.id}`);
            const gOpen = expanded.has(`g${f.id}`);
            return (
              <Card key={f.id} className="!p-0">
                {/* Faculty row */}
                <div
                  className="group flex cursor-pointer items-center gap-3 px-4 py-3.5 sm:px-5"
                  onClick={() => toggle(`f${f.id}`)}
                >
                  <Icon icon={fOpen ? ChevronDown : ChevronRight} size={17} className="shrink-0 text-ink-faint" />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-deep">
                    <Icon icon={Building2} size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-ink">{f.name}</p>
                  </div>
                  <div className="hidden gap-1.5 sm:flex">
                    <CountChip>{t("nDepts", { n: f.departments.length })}</CountChip>
                    <CountChip>{t("nGroups", { n: f.groups.length })}</CountChip>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {canFaculty && (
                      <>
                        <RowAction icon={Pencil} label={tc("edit")} onClick={() => openEdit("faculty", { id: f.id, name: f.name, parentId: 0 })} />
                        <RowAction icon={Trash2} label={tc("delete")} danger onClick={() => { setDeleteError(null); setDeleting({ kind: "faculty", id: f.id, name: f.name }); }} />
                      </>
                    )}
                  </div>
                </div>

                {fOpen && (
                  <div className="border-t border-line px-4 pb-4 sm:px-5">
                    {/* Departments */}
                    <div className="ml-[26px] border-l-2 border-line pl-4 pt-1 sm:ml-[30px]">
                      {f.departments.map((d) => {
                        const dOpen = expanded.has(`d${d.id}`);
                        return (
                          <div key={d.id} className="mt-2">
                            <div
                              className="group flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-2 transition-colors hover:bg-bg"
                              onClick={() => toggle(`d${d.id}`)}
                            >
                              <Icon icon={dOpen ? ChevronDown : ChevronRight} size={15} className="shrink-0 text-ink-faint" />
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-amber-soft text-amber">
                                <Icon icon={Landmark} size={14} />
                              </div>
                              <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{d.name}</p>
                              <div className="hidden gap-1.5 sm:flex">
                                <CountChip>{t("nSubjects", { n: d.subjects.length })}</CountChip>
                                <CountChip>{t("nTeachers", { n: d.teacherCount })}</CountChip>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5">
                                {canSubject && <AddAction label={t("add.subject")} onClick={() => openAdd("subject", d.id)} />}
                                {canDeptGroup && (
                                  <>
                                    <RowAction icon={Pencil} label={tc("edit")} onClick={() => openEdit("department", { id: d.id, name: d.name, parentId: f.id })} />
                                    <RowAction icon={Trash2} label={tc("delete")} danger onClick={() => { setDeleteError(null); setDeleting({ kind: "department", id: d.id, name: d.name }); }} />
                                  </>
                                )}
                              </div>
                            </div>

                            {dOpen && (
                              <div className="ml-[30px] border-l-2 border-line pl-4">
                                {d.subjects.map((s) => (
                                  <div key={s.id} className="group flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-bg">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-blue-soft text-blue">
                                      <Icon icon={BookMarked} size={12.5} />
                                    </div>
                                    <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{s.name}</p>
                                    {s.courseCount > 0 && <CountChip>{t("nCourses", { n: s.courseCount })}</CountChip>}
                                    <div className="flex shrink-0 items-center gap-0.5">
                                      {canSubject && (
                                        <>
                                          <RowAction icon={Pencil} label={tc("edit")} onClick={() => openEdit("subject", { id: s.id, name: s.name, description: s.description, parentId: d.id })} />
                                          <RowAction icon={Trash2} label={tc("delete")} danger onClick={() => { setDeleteError(null); setDeleting({ kind: "subject", id: s.id, name: s.name }); }} />
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {d.subjects.length === 0 && (
                                  <p className="px-2 py-1.5 text-[12.5px] text-ink-faint">{t("noSubjectsInDept")}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {f.departments.length === 0 && (
                        <p className="px-2 pt-2 text-[12.5px] text-ink-faint">{t("noDeptsInFaculty")}</p>
                      )}
                      {canDeptGroup && (
                        <div className="mt-2 px-2">
                          <AddAction label={t("add.department")} onClick={() => openAdd("department", f.id)} />
                        </div>
                      )}

                      {/* Groups node */}
                      <div className="mt-3">
                        <div
                          className="group flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-2 transition-colors hover:bg-bg"
                          onClick={() => toggle(`g${f.id}`)}
                        >
                          <Icon icon={gOpen ? ChevronDown : ChevronRight} size={15} className="shrink-0 text-ink-faint" />
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-violet-soft text-violet">
                            <Icon icon={Users} size={14} />
                          </div>
                          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                            {t("groupsNode")} <span className="font-normal text-ink-faint">({f.groups.length})</span>
                          </p>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {canDeptGroup && <AddAction label={t("add.group")} onClick={() => openAdd("group", f.id)} />}
                          </div>
                        </div>
                        {gOpen && (
                          <div className="ml-[30px] border-l-2 border-line pl-4">
                            {f.groups.map((g) => (
                              <div key={g.id} className="group flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-bg">
                                <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{g.name}</p>
                                <CountChip>{t("nthYear", { n: g.yearOfStudy })}</CountChip>
                                <CountChip>{t("nStudents", { n: g.studentCount })}</CountChip>
                                <div className="flex shrink-0 items-center gap-0.5">
                                  {canDeptGroup && (
                                    <>
                                      <RowAction icon={Pencil} label={tc("edit")} onClick={() => openEdit("group", { id: g.id, name: g.name, yearOfStudy: g.yearOfStudy, parentId: f.id })} />
                                      <RowAction icon={Trash2} label={tc("delete")} danger onClick={() => { setDeleteError(null); setDeleting({ kind: "group", id: g.id, name: g.name }); }} />
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                            {f.groups.length === 0 && (
                              <p className="px-2 py-1.5 text-[12.5px] text-ink-faint">{t("noGroupsInFaculty")}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modalTitle}>
        {modal && (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={modal.kind === "group" ? t("groupName") : tc("name")}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={modal.kind === "group" ? t("groupNamePlaceholder") : undefined}
                autoFocus
                required
              />
            </Field>
            {modal.kind === "subject" && (
              <Field label={t("descriptionOptional")}>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            )}
            {modal.kind === "group" && (
              <Field label={t("yearOfStudy")}>
                <Select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}>
                  {[1, 2, 3, 4, 5, 6].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              </Field>
            )}
            {formError && <p className="text-[13px] text-rose">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>{tc("cancel")}</Button>
              <Button type="submit" disabled={mutate.isPending}>{modal.editing ? tc("save") : tc("add")}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title={t("confirmDeleteTitle")}
        message={deleting ? t(`confirmDelete.${deleting.kind}`, { name: deleting.name }) : ""}
        errorMessage={deleteError}
        loading={mutate.isPending}
        onConfirm={onConfirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
