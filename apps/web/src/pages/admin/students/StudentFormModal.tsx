import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal, Select } from "@meduni/ui";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useList } from "../../../lib/crud";
import { useLocale } from "../../../lib/useLocale";
import type { Faculty, Group } from "../structure/types";
import { useCreateStudent, useUpdateStudent, type StudentRow } from "./api";

/** Student-only form: identity + faculty→group cascade. */
export function StudentFormModal({
  editing,
  onClose,
}: {
  editing: StudentRow | null;
  /** `revealPassword` set when a new student got a generated password. */
  onClose: (revealPassword?: string | null) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "students.form" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();

  const faculties = useList<Faculty>("faculties");
  const groups = useList<Group>("groups");
  const facultyOptions = faculties.data ?? [];

  const create = useCreateStudent();
  const update = useUpdateStudent();
  const isEdit = !!editing;

  const [facultyId, setFacultyId] = useState<string>(editing?.facultyId ? String(editing.facultyId) : "");
  const [groupId, setGroupId] = useState<string>(editing?.groupId ? String(editing.groupId) : "");
  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [lang, setLang] = useState<"uz" | "ru">(editing?.locale ?? "uz");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const groupOptions = (groups.data ?? []).filter((g) => !facultyId || g.facultyId === Number(facultyId));
  const noGroups = (groups.data ?? []).length === 0;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const base = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      locale: lang,
      groupId: Number(groupId),
    };
    if (isEdit && editing) {
      update.mutate(
        { id: editing.id, body: base },
        {
          onSuccess: () => onClose(null),
          onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
        }
      );
      return;
    }
    create.mutate(
      { ...base, password: password.trim() || null },
      {
        onSuccess: (r) => onClose(r.generatedPassword),
        onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  return (
    <Modal open onClose={() => onClose()} title={isEdit ? t("editTitle") : t("addTitle")} className="max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fullName")}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus required />
          </Field>
          <Field label={t("email")}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label={t("phone")}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t("language")}>
            <Select value={lang} onChange={(e) => setLang(e.target.value as "uz" | "ru")}>
              <option value="uz">O‘zbek</option>
              <option value="ru">Русский</option>
            </Select>
          </Field>

          {facultyOptions.length > 1 && (
            <Field label={t("faculty")}>
              <Select
                value={facultyId}
                onChange={(e) => {
                  setFacultyId(e.target.value);
                  setGroupId("");
                }}
              >
                <option value="">{t("allFaculties")}</option>
                {facultyOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t("group")}>
            {noGroups ? (
              <p className="text-[13px] text-amber">{t("noGroupsHint")}</p>
            ) : (
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
                <option value="" disabled>{t("selectGroup")}</option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            )}
          </Field>

          {!isEdit && (
            <Field label={t("password")}>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
              <p className="mt-1 text-[12px] text-ink-faint">{t("passwordHint")}</p>
            </Field>
          )}
        </div>

        {error && <p className="text-[13px] text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onClose()}>{tc("cancel")}</Button>
          <Button type="submit" disabled={create.isPending || update.isPending || noGroups}>
            {isEdit ? tc("save") : tc("add")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
