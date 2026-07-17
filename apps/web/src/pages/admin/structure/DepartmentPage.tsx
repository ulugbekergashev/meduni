import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookMarked, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { Button, Card, Icon, Spinner } from "@meduni/ui";
import { useMe } from "../../../lib/auth";
import { PasswordModal } from "../users/PasswordModal";
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

/** Department detail: its subjects with in-place CRUD. */
export function DepartmentPage() {
  const { id } = useParams();
  const deptId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const navigate = useNavigate();
  const { data: me } = useMe();
  const tree = useStructureTree();

  const [modal, setModal] = useState<ModalReq | null>(null);
  const [del, setDel] = useState<DeleteReq | null>(null);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);

  const role = me?.role;
  const canDept = role === "superadmin" || role === "faculty_admin";
  const canSubject = role === "superadmin" || role === "faculty_admin" || role === "dept_admin";

  if (tree.isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;
  }
  const f = tree.data?.find((x) => x.departments.some((d) => d.id === deptId));
  const d = f?.departments.find((x) => x.id === deptId);
  if (!f || !d) {
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
      <button onClick={() => navigate(`/admin/structure/f/${f.id}`)} className="flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {f.name}
      </button>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{d.name}</h1>
          {d.admins.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <Icon icon={UserRound} size={14} className="text-brand" />
                <span className="font-semibold text-ink">{t("headLabel")}:</span> {d.admins[0].fullName}
              </span>
              {d.admins[0].phone && (
                <span className="inline-flex items-center gap-1 text-ink-faint">
                  <Icon icon={Phone} size={13} /> {d.admins[0].phone}
                </span>
              )}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <CountChip>{t("nSubjects", { n: d.subjects.length })}</CountChip>
            <CountChip>{t("nTeachers", { n: d.teacherCount })}</CountChip>
          </div>
        </div>
        {canDept && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<Icon icon={Pencil} size={15} />} onClick={() => setModal({ kind: "department", editing: { id: d.id, name: d.name, parentId: f.id } })}>
              {tc("edit")}
            </Button>
            <Button variant="ghost" size="sm" icon={<Icon icon={Trash2} size={15} />} onClick={() => setDel({ kind: "department", id: d.id, name: d.name, goUp: true })}>
              {tc("delete")}
            </Button>
          </div>
        )}
      </div>

      {/* Subjects */}
      <Card className="mt-6 !p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <h2 className="inline-flex items-center gap-2 text-section font-bold text-ink">
            <Icon icon={BookMarked} size={17} className="text-blue" /> {t("subjectsSection")}
          </h2>
          {canSubject && (
            <Button size="sm" variant="soft" icon={<Icon icon={Plus} size={14} />} onClick={() => setModal({ kind: "subject", parentId: d.id })}>
              {tc("add")}
            </Button>
          )}
        </div>
        <div>
          {d.subjects.map((s) => (
            <div key={s.id} className="group flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-blue-soft text-blue">
                <Icon icon={BookMarked} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{s.name}</p>
                <p className="truncate text-[12px] text-ink-faint">
                  {t("nCourses", { n: s.courseCount })}
                  {s.description ? ` · ${s.description}` : ""}
                </p>
              </div>
              {canSubject && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => setModal({ kind: "subject", editing: { id: s.id, name: s.name, description: s.description, parentId: d.id } })}
                    className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-brand-soft hover:text-brand-deep"
                    aria-label={tc("edit")}
                  >
                    <Icon icon={Pencil} size={15} />
                  </button>
                  <button
                    onClick={() => setDel({ kind: "subject", id: s.id, name: s.name })}
                    className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-rose-soft hover:text-rose"
                    aria-label={tc("delete")}
                  >
                    <Icon icon={Trash2} size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {d.subjects.length === 0 && (
            <p className="px-5 py-6 text-center text-[13px] text-ink-faint">{t("noSubjectsInDept")}</p>
          )}
        </div>
      </Card>

      {modal && (
        <EntityFormModal
          kind={modal.kind}
          parentId={modal.parentId}
          editing={modal.editing}
          onClose={(pw) => {
            setModal(null);
            if (pw) setRevealPassword(pw);
          }}
        />
      )}
      <PasswordModal password={revealPassword} onClose={() => setRevealPassword(null)} />
      {del && (
        <EntityDeleteDialog
          kind={del.kind}
          id={del.id}
          name={del.name}
          onClose={() => setDel(null)}
          onDeleted={del.goUp ? () => navigate(`/admin/structure/f/${f.id}`) : undefined}
        />
      )}
    </div>
  );
}
