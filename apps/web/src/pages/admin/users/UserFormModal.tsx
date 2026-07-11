import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal, Select } from "@meduni/ui";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useList } from "../../../lib/crud";
import { pickName, useLocale } from "../../../lib/useLocale";
import type { Department } from "../structure/types";
import { useCreateUser, useUpdateUser, type CreateUserBody, type UserRow } from "./api";

interface Group {
  id: number;
  name: string;
}

type FormRole = "STUDENT" | "TEACHER";

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
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();

  const groups = useList<Group>("groups");
  const departments = useList<Department>("departments");
  const groupOptions = groups.data ?? [];
  const deptOptions = departments.data ?? [];

  const isEdit = !!editing;
  const create = useCreateUser();
  const update = useUpdateUser();

  const [role, setRole] = useState<FormRole>(
    editing ? (editing.role === "teacher" ? "TEACHER" : "STUDENT") : "STUDENT"
  );
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

  const noGroups = role === "STUDENT" && groupOptions.length === 0;
  const noDepts = role === "TEACHER" && deptOptions.length === 0;

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
      if (role === "STUDENT") body.groupId = Number(groupId);
      if (role === "TEACHER") {
        body.departmentId = Number(departmentId);
        body.position = position.trim() || null;
      }
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
      role,
      phone: phone.trim() || null,
      locale: langValue,
      password: password.trim() || null,
      groupId: role === "STUDENT" ? Number(groupId) : null,
      departmentId: role === "TEACHER" ? Number(departmentId) : null,
      position: role === "TEACHER" ? position.trim() || null : null,
    };
    create.mutate(body, {
      onSuccess: (u) => onCreated(u.generatedPassword),
      onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
    });
  };

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Role selector (create only) */}
      {!isEdit && (
        <Field label={t("selectRole")}>
          <div className="flex gap-2">
            {(["STUDENT", "TEACHER"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={
                  "flex-1 rounded-control border px-3 py-2 text-[13.5px] font-semibold transition-colors " +
                  (role === r
                    ? "border-brand bg-brand-soft text-brand-deep"
                    : "border-line text-ink-soft hover:bg-bg")
                }
              >
                {r === "STUDENT" ? t("student") : t("teacher")}
              </button>
            ))}
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

        {role === "STUDENT" && (
          <Field label={t("group")}>
            {noGroups ? (
              <p className="text-[13px] text-amber">{t("noGroupsHint")}</p>
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

        {role === "TEACHER" && (
          <>
            <Field label={t("department")}>
              {noDepts ? (
                <p className="text-[13px] text-amber">{t("noDepartmentsHint")}</p>
              ) : (
                <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
                  <option value="" disabled>
                    {t("selectDepartment")}
                  </option>
                  {deptOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {pickName(locale, d.nameUz, d.nameRu)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("position")}>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} />
            </Field>
          </>
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
        <Button type="submit" disabled={pending || noGroups || noDepts}>
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
