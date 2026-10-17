import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookMarked, Eye, GraduationCap, KeyRound, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, Icon, Spinner, Toggle, useToast } from "@meduni/ui";
import { BentoCard, BentoRow, PageHeader } from "../../../components/bento";
import { Avatar } from "../../../components/Avatar";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { api } from "../../../lib/api";
import { useMe } from "../../../lib/auth";
import { PasswordModal } from "../users/PasswordModal";
import { BackLink, IconAction } from "../components";
import { DeptAiKeyCard } from "./DeptAiKeyCard";
import {
  AdminCard,
  AppointModal,
  EntityDeleteDialog,
  EntityFormModal,
  useDeptTeachers,
  useStructureTree,
  type EntityEditing,
  type EntityKind,
  type StaffTeacher,
} from "./shared";

type ModalReq = { kind: EntityKind; parentId?: number; editing?: EntityEditing };
type DeleteReq = { kind: EntityKind; id: number; name: string; goUp?: boolean };

/** Department detail: head (mudir), AI key, teachers and courses — the kafedra's whole staff. */
export function DepartmentPage() {
  const { id } = useParams();
  const deptId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: ts } = useTranslation(undefined, { keyPrefix: "staff" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const navigate = useNavigate();
  const { show } = useToast();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tree = useStructureTree();
  const teachers = useDeptTeachers(deptId);

  const [modal, setModal] = useState<ModalReq | null>(null);
  const [del, setDel] = useState<DeleteReq | null>(null);
  const [appointing, setAppointing] = useState<"DEPT_ADMIN" | "TEACHER" | null>(null);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffTeacher | null>(null);

  const toggleTeacher = useMutation({
    mutationFn: (userId: number) => api(`/api/v1/users/${userId}/toggle-active`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-teachers", deptId] });
      show(tc("updated"));
    },
  });
  const resetPw = useMutation({
    mutationFn: (userId: number) => api<{ password: string }>(`/api/v1/users/${userId}/reset-password`, { method: "POST" }),
  });

  const role = me?.role;
  const canDept = role === "superadmin" || role === "faculty_admin";
  const canStaff = role === "superadmin" || role === "faculty_admin" || role === "dept_admin";

  if (tree.isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;
  }
  const f = tree.data?.find((x) => x.departments.some((d) => d.id === deptId));
  const d = f?.departments.find((x) => x.id === deptId);
  if (!f || !d) {
    return (
      <div className="space-y-3">
        <BackLink label={t("title")} onClick={() => navigate("/admin/staff")} />
        <EmptyState icon={<Icon icon={Landmark} size={22} />} text={t("notFound")} />
      </div>
    );
  }

  const teacherRows = teachers.data?.items ?? [];

  return (
    <div className="space-y-3">
      <div>
        {/* Up to the faculty — hidden for the dept admin (this page IS their home) */}
        {canDept && <BackLink label={f.name} onClick={() => navigate(`/admin/staff/f/${f.id}`)} />}
        <PageHeader
          className="mb-0"
          title={d.name}
          subtitle={[t("department"), t("nCourses", { n: d.courses.length }), t("nTeachers", { n: d.teacherCount })].join(" · ")}
          right={
            canDept && (
              <>
                <Button variant="ghost" size="sm" icon={<Icon icon={Pencil} size={15} />} onClick={() => setModal({ kind: "department", editing: { id: d.id, name: d.name, parentId: f.id } })}>
                  {tc("edit")}
                </Button>
                <Button variant="ghost" size="sm" icon={<Icon icon={Trash2} size={15} />} onClick={() => setDel({ kind: "department", id: d.id, name: d.name, goUp: true })}>
                  {tc("delete")}
                </Button>
              </>
            )
          }
        />
      </div>

      {/* Mudir + kafedraning O'Z Gemini kaliti (AI shu kalit bilan ishlaydi) */}
      <div className="grid gap-3 lg:grid-cols-2">
        <AdminCard
          admin={d.admins[0] ?? null}
          roleLabel={t("headLabel")}
          canManage={canDept}
          onAppoint={() => setAppointing("DEPT_ADMIN")}
          onReveal={setRevealPassword}
        />
        <DeptAiKeyCard deptId={d.id} canManage={canStaff} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Teachers */}
        <BentoCard
          title={ts("teachersSection")}
          count={teacherRows.length}
          right={
            canStaff && (
              <Button size="sm" variant="ghost" icon={<Icon icon={Plus} size={14} />} onClick={() => setAppointing("TEACHER")}>
                {tc("add")}
              </Button>
            )
          }
          isLoading={teachers.isLoading}
          isError={teachers.isError}
          onRetry={() => teachers.refetch()}
          bodyClassName="px-2 pb-3"
        >
          {teacherRows.length === 0 ? (
            <div className="px-2 py-2">
              <EmptyState icon={<Icon icon={GraduationCap} size={20} />} text={ts("noTeachers")} />
            </div>
          ) : (
            <ul className="space-y-1">
              {teacherRows.map((u) => (
                <li key={u.id}>
                  <BentoRow
                    lead={<Avatar name={u.fullName} />}
                    title={u.fullName}
                    sub={`${u.position ? `${u.position} · ` : ""}${u.email}`}
                    muted={!u.isActive}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    arrow={!canStaff}
                    trailing={
                      canStaff && (
                        <span className="flex shrink-0 items-center gap-0.5 pr-1">
                          <Toggle
                            checked={u.isActive}
                            disabled={toggleTeacher.isPending}
                            aria-label="active"
                            onChange={() => toggleTeacher.mutate(u.id)}
                          />
                          <IconAction icon={KeyRound} label={ts("resetPw")} tone="amber" onClick={() => setResetTarget(u)} />
                          <IconAction icon={Eye} label={ts("profile")} tone="blue" onClick={() => navigate(`/admin/users/${u.id}`)} />
                        </span>
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </BentoCard>

        {/* Kurslar — fan/kurs birlashdi. To'liq boshqaruv (o'qituvchi/guruh/semestr)
            "Kurslar" modulida; bu yerda ro'yxat + o'sha modulga o'tish. */}
        <BentoCard
          title={t("coursesSection")}
          count={d.courses.length}
          right={
            canStaff && (
              <Button size="sm" variant="ghost" icon={<Icon icon={Plus} size={14} />} onClick={() => navigate("/admin/courses")}>
                {tc("add")}
              </Button>
            )
          }
          bodyClassName="px-2 pb-3"
        >
          {d.courses.length === 0 ? (
            <div className="px-2 py-2">
              <EmptyState icon={<Icon icon={BookMarked} size={20} />} text={t("noCoursesInDept")} />
            </div>
          ) : (
            <ul className="space-y-1">
              {d.courses.map((c) => (
                <li key={c.id}>
                  <BentoRow
                    icon={BookMarked}
                    iconTone="bg-blue-soft text-blue"
                    title={c.name}
                    sub={c.description ?? undefined}
                    onClick={() => navigate(`/admin/courses/${c.id}`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </BentoCard>
      </div>

      {/* Modals */}
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
          role={appointing}
          unitId={d.id}
          onClose={(pw) => {
            setAppointing(null);
            if (pw) setRevealPassword(pw);
          }}
        />
      )}
      <PasswordModal password={revealPassword} onClose={() => setRevealPassword(null)} />
      <ConfirmDialog
        open={!!resetTarget}
        title={ts("resetPw")}
        message={resetTarget ? ts("resetPwConfirm", { name: resetTarget.fullName }) : ""}
        confirmLabel={ts("resetPw")}
        confirmVariant="primary"
        loading={resetPw.isPending}
        onConfirm={() => {
          if (!resetTarget) return;
          resetPw.mutate(resetTarget.id, {
            onSuccess: (r) => {
              setResetTarget(null);
              setRevealPassword(r.password);
            },
          });
        }}
        onClose={() => setResetTarget(null)}
      />
      {del && (
        <EntityDeleteDialog
          kind={del.kind}
          id={del.id}
          name={del.name}
          onClose={() => setDel(null)}
          onDeleted={del.goUp ? () => navigate(`/admin/staff/f/${f.id}`) : undefined}
        />
      )}
    </div>
  );
}
