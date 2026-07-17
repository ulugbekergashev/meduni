import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight, Landmark, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button, Card, Icon, Spinner } from "@meduni/ui";
import { useMe } from "../../../lib/auth";
import {
  CountChip,
  EntityDeleteDialog,
  EntityFormModal,
  useStructureTree,
  type EntityEditing,
  type EntityKind,
} from "./shared";

type ModalReq = { kind: EntityKind; parentId?: number; editing?: EntityEditing };
type DeleteReq = { kind: EntityKind; id: number; name: string; goUp?: boolean };

/** Faculty detail: its departments and groups, each with in-place CRUD. */
export function FacultyPage() {
  const { id } = useParams();
  const facultyId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const navigate = useNavigate();
  const { data: me } = useMe();
  const tree = useStructureTree();

  const [modal, setModal] = useState<ModalReq | null>(null);
  const [del, setDel] = useState<DeleteReq | null>(null);

  const role = me?.role;
  const canFaculty = role === "superadmin";
  const canDeptGroup = role === "superadmin" || role === "faculty_admin";

  if (tree.isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;
  }
  const f = tree.data?.find((x) => x.id === facultyId);
  if (!f) {
    return (
      <div>
        <button onClick={() => navigate("/admin/structure")} className="flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline">
          <Icon icon={ArrowLeft} size={15} /> {t("title")}
        </button>
        <Card className="mt-4"><p className="py-6 text-center text-[13.5px] text-rose">{t("notFound")}</p></Card>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => navigate("/admin/structure")} className="flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("title")}
      </button>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{f.name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <CountChip>{t("nDepts", { n: f.departments.length })}</CountChip>
            <CountChip>{t("nGroups", { n: f.groups.length })}</CountChip>
            <CountChip>{t("nTeachers", { n: f.departments.reduce((s, d) => s + d.teacherCount, 0) })}</CountChip>
            <CountChip>{t("nStudents", { n: f.groups.reduce((s, g) => s + g.studentCount, 0) })}</CountChip>
          </div>
        </div>
        {canFaculty && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<Icon icon={Pencil} size={15} />} onClick={() => setModal({ kind: "faculty", editing: { id: f.id, name: f.name, parentId: 0 } })}>
              {tc("edit")}
            </Button>
            <Button variant="ghost" size="sm" icon={<Icon icon={Trash2} size={15} />} onClick={() => setDel({ kind: "faculty", id: f.id, name: f.name, goUp: true })}>
              {tc("delete")}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Departments */}
        <Card className="!p-0">
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <h2 className="inline-flex items-center gap-2 text-section font-bold text-ink">
              <Icon icon={Landmark} size={17} className="text-amber" /> {t("departmentsSection")}
            </h2>
            {canDeptGroup && (
              <Button size="sm" variant="soft" icon={<Icon icon={Plus} size={14} />} onClick={() => setModal({ kind: "department", parentId: f.id })}>
                {tc("add")}
              </Button>
            )}
          </div>
          <div>
            {f.departments.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate(`/admin/structure/d/${d.id}`)}
                className="flex w-full items-center gap-3 border-b border-line px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-bg"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-amber-soft text-amber">
                  <Icon icon={Landmark} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink">{d.name}</p>
                  <p className="text-[12px] text-ink-faint">
                    {t("nSubjects", { n: d.subjects.length })} · {t("nTeachers", { n: d.teacherCount })}
                  </p>
                </div>
                <Icon icon={ChevronRight} size={16} className="shrink-0 text-ink-faint" />
              </button>
            ))}
            {f.departments.length === 0 && (
              <p className="px-5 py-6 text-center text-[13px] text-ink-faint">{t("noDeptsInFaculty")}</p>
            )}
          </div>
        </Card>

        {/* Groups */}
        <Card className="!p-0">
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <h2 className="inline-flex items-center gap-2 text-section font-bold text-ink">
              <Icon icon={Users} size={17} className="text-violet" /> {t("groupsSection")}
            </h2>
            {canDeptGroup && (
              <Button size="sm" variant="soft" icon={<Icon icon={Plus} size={14} />} onClick={() => setModal({ kind: "group", parentId: f.id })}>
                {tc("add")}
              </Button>
            )}
          </div>
          <div>
            {f.groups.map((g) => (
              <div key={g.id} className="group flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink">{g.name}</p>
                  <p className="text-[12px] text-ink-faint">
                    {t("nthYear", { n: g.yearOfStudy })} · {t("nStudents", { n: g.studentCount })}
                  </p>
                </div>
                {canDeptGroup && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => setModal({ kind: "group", editing: { id: g.id, name: g.name, yearOfStudy: g.yearOfStudy, parentId: f.id } })}
                      className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-brand-soft hover:text-brand-deep"
                      aria-label={tc("edit")}
                    >
                      <Icon icon={Pencil} size={15} />
                    </button>
                    <button
                      onClick={() => setDel({ kind: "group", id: g.id, name: g.name })}
                      className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-rose-soft hover:text-rose"
                      aria-label={tc("delete")}
                    >
                      <Icon icon={Trash2} size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {f.groups.length === 0 && (
              <p className="px-5 py-6 text-center text-[13px] text-ink-faint">{t("noGroupsInFaculty")}</p>
            )}
          </div>
        </Card>
      </div>

      {modal && <EntityFormModal kind={modal.kind} parentId={modal.parentId} editing={modal.editing} onClose={() => setModal(null)} />}
      {del && (
        <EntityDeleteDialog
          kind={del.kind}
          id={del.id}
          name={del.name}
          onClose={() => setDel(null)}
          onDeleted={del.goUp ? () => navigate("/admin/structure") : undefined}
        />
      )}
    </div>
  );
}
