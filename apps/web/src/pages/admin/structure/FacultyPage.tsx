import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Landmark, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button, EmptyState, Icon, Spinner } from "@meduni/ui";
import { BentoCard, BentoRow, PageHeader } from "../../../components/bento";
import { useMe } from "../../../lib/auth";
import { PasswordModal } from "../users/PasswordModal";
import { BackLink, IconAction } from "../components";
import {
  AdminCard,
  AppointModal,
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
  const [appointing, setAppointing] = useState(false);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);

  const role = me?.role;
  const canFaculty = role === "superadmin";
  const canDeptGroup = role === "superadmin" || role === "faculty_admin";

  if (tree.isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;
  }
  const f = tree.data?.find((x) => x.id === facultyId);
  if (!f) {
    return (
      <div className="space-y-3">
        <BackLink label={t("title")} onClick={() => navigate("/admin/staff")} />
        <EmptyState icon={<Icon icon={Landmark} size={22} />} text={t("notFound")} />
      </div>
    );
  }

  const teacherCount = f.departments.reduce((s, d) => s + d.teacherCount, 0);
  const studentCount = f.groups.reduce((s, g) => s + g.studentCount, 0);

  return (
    <div className="space-y-3">
      <div>
        {/* Back to the university hub — only meaningful for the superadmin */}
        {canFaculty && <BackLink label={t("title")} onClick={() => navigate("/admin/staff")} />}
        <PageHeader
          className="mb-0"
          title={f.name}
          subtitle={[
            t("faculty"),
            t("nDepts", { n: f.departments.length }),
            t("nGroups", { n: f.groups.length }),
            t("nTeachers", { n: teacherCount }),
            t("nStudents", { n: studentCount }),
          ].join(" · ")}
          right={
            canFaculty && (
              <>
                <Button variant="ghost" size="sm" icon={<Icon icon={Pencil} size={15} />} onClick={() => setModal({ kind: "faculty", editing: { id: f.id, name: f.name, parentId: 0 } })}>
                  {tc("edit")}
                </Button>
                <Button variant="ghost" size="sm" icon={<Icon icon={Trash2} size={15} />} onClick={() => setDel({ kind: "faculty", id: f.id, name: f.name, goUp: true })}>
                  {tc("delete")}
                </Button>
              </>
            )
          }
        />
      </div>

      {/* Dean card */}
      <AdminCard
        admin={f.admins[0] ?? null}
        roleLabel={t("deanLabel")}
        canManage={canFaculty}
        onAppoint={() => setAppointing(true)}
        onReveal={setRevealPassword}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Departments */}
        <BentoCard
          title={t("departmentsSection")}
          count={f.departments.length}
          right={
            canDeptGroup && (
              <Button size="sm" variant="ghost" icon={<Icon icon={Plus} size={14} />} onClick={() => setModal({ kind: "department", parentId: f.id })}>
                {tc("add")}
              </Button>
            )
          }
          bodyClassName="px-2 pb-3"
        >
          {f.departments.length === 0 ? (
            <div className="px-2 py-2">
              <EmptyState icon={<Icon icon={Landmark} size={20} />} text={t("noDeptsInFaculty")} />
            </div>
          ) : (
            <ul className="space-y-1">
              {f.departments.map((d) => (
                <li key={d.id}>
                  <BentoRow
                    icon={Landmark}
                    iconTone="bg-amber-soft text-amber"
                    title={d.name}
                    sub={`${d.admins[0] ? `${d.admins[0].fullName} · ` : ""}${t("nCourses", { n: d.courses.length })} · ${t("nTeachers", { n: d.teacherCount })}`}
                    onClick={() => navigate(`/admin/staff/d/${d.id}`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </BentoCard>

        {/* Groups */}
        <BentoCard
          title={t("groupsSection")}
          count={f.groups.length}
          right={
            canDeptGroup && (
              <Button size="sm" variant="ghost" icon={<Icon icon={Plus} size={14} />} onClick={() => setModal({ kind: "group", parentId: f.id })}>
                {tc("add")}
              </Button>
            )
          }
          bodyClassName="px-2 pb-3"
        >
          {f.groups.length === 0 ? (
            <div className="px-2 py-2">
              <EmptyState icon={<Icon icon={Users} size={20} />} text={t("noGroupsInFaculty")} />
            </div>
          ) : (
            <ul className="space-y-1">
              {f.groups.map((g) => (
                <li key={g.id}>
                  <BentoRow
                    icon={Users}
                    iconTone="bg-violet-soft text-violet"
                    title={g.name}
                    sub={`${t("nthYear", { n: g.yearOfStudy })} · ${t("nStudents", { n: g.studentCount })}`}
                    onClick={() => navigate(`/admin/groups/${g.id}`)}
                    trailing={
                      canDeptGroup && (
                        <span className="flex shrink-0 items-center">
                          <IconAction
                            icon={Pencil}
                            label={tc("edit")}
                            onClick={() => setModal({ kind: "group", editing: { id: g.id, name: g.name, yearOfStudy: g.yearOfStudy, parentId: f.id } })}
                          />
                          <IconAction icon={Trash2} label={tc("delete")} tone="rose" onClick={() => setDel({ kind: "group", id: g.id, name: g.name })} />
                        </span>
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </BentoCard>
      </div>

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
      {appointing && (
        <AppointModal
          role="FACULTY_ADMIN"
          unitId={f.id}
          onClose={(pw) => {
            setAppointing(false);
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
          onDeleted={del.goUp ? () => navigate("/admin/staff") : undefined}
        />
      )}
    </div>
  );
}
