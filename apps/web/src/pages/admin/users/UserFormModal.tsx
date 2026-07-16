import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Input, Modal, Select } from "@meduni/ui";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useList } from "../../../lib/crud";
import { useMe } from "../../../lib/auth";
import { useLocale } from "../../../lib/useLocale";
import type { Department } from "../structure/types";
import { useCreateUser, useUpdateUser, type CreateUserBody, type UserRow } from "./api";

interface Group {
  id: number;
  name: string;
  facultyId: number;
}

interface FacultyOpt {
  id: number;
  name: string;
}

/** SUPER covers superadmin + legacy admin rows — affiliation fields are hidden for them. */
type FormRole = "STUDENT" | "TEACHER" | "DEPT_ADMIN" | "FACULTY_ADMIN" | "SUPER";

function roleFromRow(row: UserRow): FormRole {
  switch (row.role) {
    case "student":
      return "STUDENT";
    case "teacher":
      return "TEACHER";
    case "dept_admin":
      return "DEPT_ADMIN";
    case "faculty_admin":
      return "FACULTY_ADMIN";
    default:
      return "SUPER";
  }
}

/** Which roles the current admin tier may create (mirrors the backend rule). */
function creatableRoles(myRole?: string): Exclude<FormRole, "SUPER">[] {
  if (myRole === "dept_admin") return ["TEACHER"];
  if (myRole === "faculty_admin") return ["STUDENT", "TEACHER", "DEPT_ADMIN"];
  return ["STUDENT", "TEACHER", "DEPT_ADMIN", "FACULTY_ADMIN"];
}

function UserForm({
  editing,
  onClose,
  onCreated,
  onUpdated,
}: {
  editing: UserRow | null;
  onClose: () => void;
  onCreated: (password: string | null) => void;
  onUpdated: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "users.form" });
  const { t: tr } = useTranslation(undefined, { keyPrefix: "users.role" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();

  const { data: me } = useMe();
  const roleOptions = creatableRoles(me?.role);

  const groups = useList<Group>("groups");
  const departments = useList<Department>("departments");
  const faculties = useList<FacultyOpt>("faculties");
  const facultyOptions = faculties.data ?? [];

  const isEdit = !!editing;
  const create = useCreateUser();
  const update = useUpdateUser();

  const [role, setRole] = useState<FormRole>(editing ? roleFromRow(editing) : roleOptions[0]);
  // Faculty picker: FACULTY_ADMIN scope for that role; otherwise a cascade filter for group/department lists.
  const [facultyId, setFacultyId] = useState<string>(editing?.facultyId ? String(editing.facultyId) : "");
  const [cascadeFacultyId, setCascadeFacultyId] = useState<string>("");
  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [langValue, setLangValue] = useState<"uz" | "ru">(editing?.locale ?? "uz");
  const [groupId, setGroupId] = useState<string>(editing?.groupId ? String(editing.groupId) : "");
  const [departmentId, setDepartmentId] = useState<string>(
    editing?.departmentId ? String(editing.departmentId) : ""
  );
  const [position, setPosition] = useState(editing?.position ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const groupOptions = (groups.data ?? []).filter(
    (g) => !cascadeFacultyId || g.facultyId === Number(cascadeFacultyId)
  );
  const deptOptions = (departments.data ?? []).filter(
    (d) => !cascadeFacultyId || d.facultyId === Number(cascadeFacultyId)
  );

  const needsDept = role === "TEACHER" || role === "DEPT_ADMIN";
  const needsGroup = role === "STUDENT";
  const needsFaculty = role === "FACULTY_ADMIN";
  const showCascade = !isEdit && (needsGroup || needsDept) && facultyOptions.length > 1;
  const noGroups = needsGroup && (groups.data ?? []).length === 0;
  const noDepts = needsDept && (departments.data ?? []).length === 0;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isEdit && editing) {
      const body: Partial<CreateUserBody> = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        locale: langValue,
      };
      if (role === "STUDENT" && groupId) body.groupId = Number(groupId);
      if (role === "TEACHER") {
        if (departmentId) body.departmentId = Number(departmentId);
        body.position = position.trim() || null;
      }
      if (role === "DEPT_ADMIN" && departmentId) body.departmentId = Number(departmentId);
      if (role === "FACULTY_ADMIN" && facultyId) body.facultyId = Number(facultyId);
      update.mutate(
        { id: editing.id, body },
        {
          onSuccess: onUpdated,
          onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
        }
      );
      return;
    }

    const body: CreateUserBody = {
      fullName: fullName.trim(),
      email: email.trim(),
      role: role as Exclude<FormRole, "SUPER">,
      phone: phone.trim() || null,
      locale: langValue,
      password: password.trim() || null,
      groupId: needsGroup ? Number(groupId) : null,
      departmentId: needsDept ? Number(departmentId) : null,
      facultyId: needsFaculty ? Number(facultyId) : null,
      position: role === "TEACHER" ? position.trim() || null : null,
    };
    create.mutate(body, {
      onSuccess: (u) => onCreated(u.generatedPassword),
      onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
    });
  };

  const pending = create.isPending || update.isPending;

  const roleLabel = (r: Exclude<FormRole, "SUPER">) =>
    r === "STUDENT" ? t("student") : r === "TEACHER" ? t("teacher") : r === "DEPT_ADMIN" ? t("deptAdmin") : t("facultyAdmin");

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Role: selector on create, read-only badge on edit */}
      {!isEdit ? (
        <Field label={t("selectRole")}>
          <div className="flex flex-wrap gap-2">
            {roleOptions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={
                  "flex-1 whitespace-nowrap rounded-control border px-3 py-2 text-[13.5px] font-semibold transition-colors " +
                  (role === r
                    ? "border-brand bg-brand-soft text-brand-deep"
                    : "border-line text-ink-soft hover:bg-bg")
                }
              >
                {roleLabel(r)}
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <Field label={t("selectRole")}>
          <div className="flex items-center gap-2">
            <Badge tone="slate">{tr(editing!.role)}</Badge>
            <span className="text-[12px] text-ink-faint">{t("roleLocked")}</span>
          </div>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fullName")}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label={t("email")}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={t("phone")}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t("language")}>
          <Select value={langValue} onChange={(e) => setLangValue(e.target.value as "uz" | "ru")}>
            <option value="uz">O‘zbek</option>
            <option value="ru">Русский</option>
          </Select>
        </Field>

        {showCascade && (
          <Field label={t("facultyFilter")}>
            <Select
              value={cascadeFacultyId}
              onChange={(e) => {
                setCascadeFacultyId(e.target.value);
                setGroupId("");
                setDepartmentId("");
              }}
            >
              <option value="">{t("allFaculties")}</option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {needsGroup && (
          <Field label={t("group")}>
            {noGroups ? (
              <p className="text-[13px] text-amber">{t("noGroupsHint")}</p>
            ) : groupOptions.length === 0 ? (
              <p className="text-[13px] text-amber">{t("noInFacultyHint")}</p>
            ) : (
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
                <option value="" disabled>
                  {t("selectGroup")}
                </option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {needsDept && (
          <>
            <Field label={t("department")}>
              {noDepts ? (
                <p className="text-[13px] text-amber">{t("noDepartmentsHint")}</p>
              ) : deptOptions.length === 0 ? (
                <p className="text-[13px] text-amber">{t("noInFacultyHint")}</p>
              ) : (
                <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
                  <option value="" disabled>
                    {t("selectDepartment")}
                  </option>
                  {deptOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {role === "TEACHER" && (
              <Field label={t("position")}>
                <Input value={position} onChange={(e) => setPosition(e.target.value)} />
              </Field>
            )}
          </>
        )}

        {needsFaculty && (
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
        )}

        {!isEdit && (
          <Field label={t("password")}>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            <p className="mt-1 text-[12px] text-ink-faint">{t("passwordHint")}</p>
          </Field>
        )}
      </div>

      {error && <p className="text-[13px] text-rose">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={pending || (!isEdit && (noGroups || noDepts))}>
          {isEdit ? tc("save") : tc("add")}
        </Button>
      </div>
    </form>
  );
}

export function UserFormModal({
  open,
  editing,
  onClose,
  onCreated,
  onUpdated,
}: {
  open: boolean;
  editing: UserRow | null;
  onClose: () => void;
  onCreated: (password: string | null) => void;
  onUpdated: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "users" });

  return (
    <Modal open={open} onClose={onClose} title={editing ? t("editUser") : t("addUser")} className="max-w-2xl">
      {open && (
        <UserForm
          key={editing?.id ?? "new"}
          editing={editing}
          onClose={onClose}
          onCreated={onCreated}
          onUpdated={onUpdated}
        />
      )}
    </Modal>
  );
}
