import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound, Mail, Phone, Plus, UserRound } from "lucide-react";
import { Button, Card, Icon, Input, Modal, Select, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { api, apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";

// ---- Tree payload (one scoped query feeds all three structure pages) ----

export interface TreeAdmin { id: number; fullName: string; phone: string | null; email: string }
/** Fan/kurs birlashdi — kafedra ostidagi kurslar. */
export interface TreeCourse { id: number; name: string; description: string | null }
export interface TreeDept { id: number; name: string; teacherCount: number; admins: TreeAdmin[]; courses: TreeCourse[] }
export interface TreeGroup { id: number; name: string; yearOfStudy: number; studentCount: number }
export interface TreeFaculty { id: number; name: string; admins: TreeAdmin[]; departments: TreeDept[]; groups: TreeGroup[] }

export function useStructureTree() {
  return useQuery({
    queryKey: ["structure-tree"],
    queryFn: () => api<TreeFaculty[]>("/api/v1/structure/tree"),
  });
}

// Kurslar alohida "Kurslar" modulida (o'qituvchi+guruh+semestr bilan) boshqariladi —
// bu yerdagi generik modal faqat fakultet/kafedra/guruh uchun.
export type EntityKind = "faculty" | "department" | "group";

const RESOURCE: Record<EntityKind, string> = {
  faculty: "faculties",
  department: "departments",
  group: "groups",
};

/** One write mutation for the whole structure area — refreshes the tree and the
 *  legacy list queries other pages (users/courses forms) still rely on. */
export function useStructureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ method, path, body }: { method: string; path: string; body?: unknown }) =>
      api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["structure-tree"] });
      for (const k of Object.values(RESOURCE)) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export function CountChip({ children }: { children: ReactNode }) {
  return <span className="rounded-pill bg-bg px-2 py-0.5 text-[12.5px] font-medium text-ink-soft">{children}</span>;
}

// ---- Add/Edit modal (all four kinds) ----

export interface EntityEditing {
  id: number;
  name: string;
  description?: string | null;
  yearOfStudy?: number;
  /** Current parent id — PATCH keeps it. */
  parentId: number;
}

interface CreateUnitResp {
  admin?: { generatedPassword: string | null } | null;
}

export function EntityFormModal({
  kind,
  parentId,
  editing,
  onClose,
}: {
  kind: EntityKind;
  /** Parent for creates: faculty for dept/group, department for subject. */
  parentId?: number;
  editing?: EntityEditing;
  /** `revealPassword` is set when a unit admin was created with a generated password. */
  onClose: (revealPassword?: string | null) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const mutate = useStructureMutation();

  const [name, setName] = useState(editing?.name ?? "");
  const [yearOfStudy, setYearOfStudy] = useState(String(editing?.yearOfStudy ?? 1));
  // Optional unit admin (dekan/mudir) — create mode only.
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  // Optional AI quota — department create only. 0 = unlimited.
  const [quotaTokens, setQuotaTokens] = useState("0");
  const [quotaImages, setQuotaImages] = useState("0");
  const [quotaCost, setQuotaCost] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const withAdmin = !editing && (kind === "faculty" || kind === "department");
  const withQuota = !editing && kind === "department";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: Record<string, unknown> = { name: name.trim() };
    if (kind === "group") body.yearOfStudy = Number(yearOfStudy);
    const parent = editing ? editing.parentId : parentId;
    if (kind === "department" || kind === "group") body.facultyId = parent;

    if (withAdmin) {
      const anyAdmin = adminFullName.trim() || adminEmail.trim();
      if (anyAdmin) {
        if (!adminFullName.trim() || !adminEmail.trim()) {
          setError(t("adminNeedsBoth"));
          return;
        }
        body.admin = {
          fullName: adminFullName.trim(),
          email: adminEmail.trim(),
          phone: adminPhone.trim() || null,
          password: adminPassword.trim() || null,
        };
      }
    }
    if (withQuota) {
      const tok = Number(quotaTokens) || 0;
      const img = Number(quotaImages) || 0;
      const cost = Number(quotaCost) || 0;
      if (tok > 0 || img > 0 || cost > 0) {
        body.quota = { monthlyTokenLimit: tok, monthlyImageLimit: img, monthlyCostLimit: cost };
      }
    }

    mutate.mutate(
      editing
        ? { method: "PATCH", path: `/api/v1/${RESOURCE[kind]}/${editing.id}`, body }
        : { method: "POST", path: `/api/v1/${RESOURCE[kind]}`, body },
      {
        onSuccess: (resp) => {
          show(editing ? tc("updated") : tc("added"));
          onClose((resp as CreateUnitResp | undefined)?.admin?.generatedPassword ?? null);
        },
        onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  const adminSectionTitle = kind === "faculty" ? t("adminSection.faculty") : t("adminSection.department");

  return (
    <Modal open onClose={() => onClose()} title={editing ? t(`edit.${kind}`) : t(`add.${kind}`)} className={withAdmin ? "max-w-2xl" : undefined}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={kind === "group" ? t("groupName") : tc("name")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "group" ? t("groupNamePlaceholder") : undefined}
            autoFocus
            required
          />
        </Field>
        {kind === "group" && (
          <Field label={t("yearOfStudy")}>
            <Select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </Field>
        )}

        {withAdmin && (
          <div className="rounded-control border border-line bg-bg/50 p-4">
            <p className="text-[14px] font-bold text-ink">{adminSectionTitle}</p>
            <p className="mt-0.5 text-[13px] text-ink-faint">{t("adminSectionHint")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t("adminFullName")}>
                <Input value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} />
              </Field>
              <Field label={t("adminEmail")}>
                <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              </Field>
              <Field label={t("adminPhone")}>
                <Input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
              </Field>
              <Field label={t("adminPassword")}>
                <Input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="••••••" />
                <p className="mt-1 text-[12.5px] text-ink-faint">{t("adminPasswordHint")}</p>
              </Field>
            </div>
          </div>
        )}

        {withQuota && (
          <div className="rounded-control border border-line bg-bg/50 p-4">
            <p className="text-[14px] font-bold text-ink">{t("quotaSection")}</p>
            <p className="mt-0.5 text-[13px] text-ink-faint">{t("quotaSectionHint")}</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Field label={t("quotaTokens")}>
                <Input type="number" min={0} value={quotaTokens} onChange={(e) => setQuotaTokens(e.target.value)} />
              </Field>
              <Field label={t("quotaImages")}>
                <Input type="number" min={0} value={quotaImages} onChange={(e) => setQuotaImages(e.target.value)} />
              </Field>
              <Field label={t("quotaCost")}>
                <Input type="number" min={0} step="0.01" value={quotaCost} onChange={(e) => setQuotaCost(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {error && <p className="text-[14px] text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onClose()}>{tc("cancel")}</Button>
          <Button type="submit" disabled={mutate.isPending}>{editing ? tc("save") : tc("add")}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---- Unit staff (teachers of a department) ----

export interface StaffTeacher {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  position: string | null;
  isActive: boolean;
}

export function useDeptTeachers(departmentId: number) {
  return useQuery({
    queryKey: ["staff-teachers", departmentId],
    queryFn: () =>
      api<{ items: StaffTeacher[] }>(`/api/v1/users?role=TEACHER&departmentId=${departmentId}&page=1`),
  });
}

/** Appoint a role-fixed staff member (dekan / mudir / o'qituvchi) to a unit. */
export function AppointModal({
  role,
  unitId,
  onClose,
}: {
  role: "FACULTY_ADMIN" | "DEPT_ADMIN" | "TEACHER";
  /** facultyId for FACULTY_ADMIN, departmentId for the rest. */
  unitId: number;
  onClose: (revealPassword?: string | null) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "staff" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ generatedPassword: string | null }>("/api/v1/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["structure-tree"] });
      qc.invalidateQueries({ queryKey: ["staff-teachers"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(
      {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        locale: "uz",
        role,
        password: password.trim() || null,
        facultyId: role === "FACULTY_ADMIN" ? unitId : null,
        departmentId: role !== "FACULTY_ADMIN" ? unitId : null,
        position: role === "TEACHER" ? position.trim() || null : null,
      },
      {
        onSuccess: (r) => {
          show(tc("added"));
          onClose(r.generatedPassword);
        },
        onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  return (
    <Modal open onClose={() => onClose()} title={t(`appoint.${role}`)}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t("fields.fullName")}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus required />
        </Field>
        <Field label={t("fields.email")}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={t("fields.phone")}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {role === "TEACHER" && (
          <Field label={t("fields.position")}>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} />
          </Field>
        )}
        <Field label={t("fields.password")}>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          <p className="mt-1 text-[13px] text-ink-faint">{t("fields.passwordHint")}</p>
        </Field>
        {error && <p className="text-[14px] text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onClose()}>{tc("cancel")}</Button>
          <Button type="submit" disabled={create.isPending}>{tc("add")}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Dekan/mudir card at the top of a unit page: identity + reset password + profile. */
export function AdminCard({
  admin,
  roleLabel,
  canManage,
  onAppoint,
  onReveal,
}: {
  admin: TreeAdmin | null;
  roleLabel: string;
  canManage: boolean;
  onAppoint: () => void;
  onReveal: (password: string) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "staff" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const { show } = useToast();
  const reset = useMutation({
    mutationFn: (id: number) => api<{ password: string }>(`/api/v1/users/${id}/reset-password`, { method: "POST" }),
  });
  const [confirming, setConfirming] = useState(false);

  if (!admin) {
    return (
      <Card className="flex flex-wrap items-center gap-3 border-dashed !p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg text-ink-faint">
          <Icon icon={UserRound} size={18} />
        </div>
        <p className="min-w-0 flex-1 text-[14.5px] text-ink-soft">{t("noAdmin", { role: roleLabel })}</p>
        {canManage && (
          <Button size="sm" variant="soft" icon={<Icon icon={Plus} size={14} />} onClick={onAppoint}>
            {t("appointBtn")}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex flex-wrap items-center gap-4 !p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
        <Icon icon={UserRound} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold uppercase tracking-[0.07em] text-ink-faint">{roleLabel}</p>
        <p className="truncate text-[16px] font-bold text-ink">{admin.fullName}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13.5px] text-ink-soft">
          <span className="inline-flex items-center gap-1"><Icon icon={Mail} size={13} /> {admin.email}</span>
          {admin.phone && <span className="inline-flex items-center gap-1"><Icon icon={Phone} size={13} /> {admin.phone}</span>}
        </p>
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="ghost" icon={<Icon icon={KeyRound} size={14} />} onClick={() => setConfirming(true)}>
            {t("resetPw")}
          </Button>
          <Link to={`/admin/users/${admin.id}`} className="text-[14px] font-semibold text-brand-deep hover:underline">
            {t("profile")} →
          </Link>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title={t("resetPw")}
        message={t("resetPwConfirm", { name: admin.fullName })}
        confirmLabel={t("resetPw")}
        confirmVariant="primary"
        loading={reset.isPending}
        onConfirm={() =>
          reset.mutate(admin.id, {
            onSuccess: (r) => {
              setConfirming(false);
              show(tc("updated"));
              onReveal(r.password);
            },
          })
        }
        onClose={() => setConfirming(false)}
      />
    </Card>
  );
}

// ---- Delete dialog ----

export function EntityDeleteDialog({
  kind,
  id,
  name,
  onClose,
  onDeleted,
}: {
  kind: EntityKind;
  id: number;
  name: string;
  onClose: () => void;
  /** Optional navigation after a successful delete (detail pages go back up). */
  onDeleted?: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const mutate = useStructureMutation();
  const [error, setError] = useState<string | null>(null);

  return (
    <ConfirmDialog
      open
      title={t("confirmDeleteTitle")}
      message={t(`confirmDelete.${kind}`, { name })}
      errorMessage={error}
      loading={mutate.isPending}
      onConfirm={() => {
        setError(null);
        mutate.mutate(
          { method: "DELETE", path: `/api/v1/${RESOURCE[kind]}/${id}` },
          {
            onSuccess: () => {
              show(tc("deleted"));
              onClose();
              onDeleted?.();
            },
            onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
          }
        );
      }}
      onClose={onClose}
    />
  );
}
