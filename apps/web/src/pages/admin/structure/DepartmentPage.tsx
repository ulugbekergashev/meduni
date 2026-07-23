import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookMarked, Eye, GraduationCap, KeyRound, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Icon, Spinner, Toggle, useToast } from "@meduni/ui";
import { Avatar } from "../../../components/Avatar";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { api } from "../../../lib/api";
import { useMe } from "../../../lib/auth";
import { PasswordModal } from "../users/PasswordModal";
import {
  AdminCard,
  AppointModal,
  CountChip,
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

/** Department detail: head (mudir), teachers and subjects — the kafedra's whole staff. */
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
      <div>
        <button onClick={() => navigate("/admin/staff")} className="flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline">
          <Icon icon={ArrowLeft} size={15} /> {t("title")}
        </button>
        <Card className="mt-4"><p className="py-6 text-center text-[14.5px] text-rose">{t("notFound")}</p></Card>
      </div>
    );
  }

  const teacherRows = teachers.data?.items ?? [];

  return (
    <div>
      {/* Up to the faculty — hidden for the dept admin (this page IS their home) */}
      {canDept && (
        <button onClick={() => navigate(`/admin/staff/f/${f.id}`)} className="flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline">
          <Icon icon={ArrowLeft} size={15} /> {f.name}
        </button>
      )}

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-amber">
            <Icon icon={Landmark} size={13} /> {t("department")}
          </p>
          <h1 className="mt-0.5 text-h1 font-bold text-ink">{d.name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <CountChip>{t("nCourses", { n: d.courses.length })}</CountChip>
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

      {/* Head (mudir) card */}
      <div className="mt-5">
        <AdminCard
          admin={d.admins[0] ?? null}
          roleLabel={t("headLabel")}
          canManage={canDept}
          onAppoint={() => setAppointing("DEPT_ADMIN")}
          onReveal={setRevealPassword}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Teachers */}
        <Card className="!p-0">
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <h2 className="inline-flex items-center gap-2 text-section font-bold text-ink">
              <Icon icon={GraduationCap} size={17} className="text-violet" /> {ts("teachersSection")}
            </h2>
            {canStaff && (
              <Button size="sm" variant="soft" icon={<Icon icon={Plus} size={14} />} onClick={() => setAppointing("TEACHER")}>
                {tc("add")}
              </Button>
            )}
          </div>
          <div>
            {teachers.isLoading ? (
              <div className="flex h-24 items-center justify-center"><Spinner size={20} /></div>
            ) : teacherRows.length === 0 ? (
              <p className="px-5 py-6 text-center text-[14px] text-ink-faint">{ts("noTeachers")}</p>
            ) : (
              teacherRows.map((u) => (
                <div key={u.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                  <Avatar name={u.fullName} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/users/${u.id}`} className="block truncate text-[15px] font-semibold text-ink hover:underline">
                      {u.fullName}
                    </Link>
                    <p className="truncate text-[13px] text-ink-faint">
                      {u.position ? `${u.position} · ` : ""}{u.email}
                    </p>
                  </div>
                  {canStaff && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Toggle
                        checked={u.isActive}
                        disabled={toggleTeacher.isPending}
                        aria-label="active"
                        onChange={() => toggleTeacher.mutate(u.id)}
                      />
                      <button onClick={() => setResetTarget(u)} className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-amber-soft hover:text-amber" aria-label={ts("resetPw")}>
                        <Icon icon={KeyRound} size={15} />
                      </button>
                      <button onClick={() => navigate(`/admin/users/${u.id}`)} className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-blue-soft hover:text-blue" aria-label={ts("profile")}>
                        <Icon icon={Eye} size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Kurslar — fan/kurs birlashdi. To'liq boshqaruv (o'qituvchi/guruh/semestr)
            "Kurslar" modulida; bu yerda ro'yxat + o'sha modulga o'tish. */}
        <Card className="!p-0">
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <h2 className="inline-flex items-center gap-2 text-section font-bold text-ink">
              <Icon icon={GraduationCap} size={17} className="text-blue" /> {t("coursesSection")}
            </h2>
            {canStaff && (
              <Button size="sm" variant="soft" icon={<Icon icon={Plus} size={14} />} onClick={() => navigate("/admin/courses")}>
                {tc("add")}
              </Button>
            )}
          </div>
          <div>
            {d.courses.map((c) => (
              <Link
                key={c.id}
                to={`/admin/courses/${c.id}`}
                className="group flex items-center gap-3 border-b border-line px-5 py-3.5 transition-colors last:border-0 hover:bg-bg"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-blue-soft text-blue">
                  <Icon icon={BookMarked} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink group-hover:text-brand-deep">{c.name}</p>
                  {c.description && <p className="truncate text-[13px] text-ink-faint">{c.description}</p>}
                </div>
              </Link>
            ))}
            {d.courses.length === 0 && (
              <p className="px-5 py-6 text-center text-[14px] text-ink-faint">{t("noCoursesInDept")}</p>
            )}
          </div>
        </Card>
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
