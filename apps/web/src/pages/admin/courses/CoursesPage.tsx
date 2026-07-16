import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GraduationCap, Trash2 } from "lucide-react";
import { Badge, Button, Card, ChipSelect, Icon, Input, Select, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { DataTable } from "../../../components/DataTable";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useList } from "../../../lib/crud";
import { useLocale } from "../../../lib/useLocale";
import type { Subject } from "../structure/types";
import { useCourses, useCreateCourse, useDeleteCourse, useTeachers, type CourseRow } from "./api";

interface GroupLite {
  id: number;
  name: string;
}

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export function CoursesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "courses" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();

  const list = useCourses();
  const subjects = useList<Subject>("subjects");
  const groups = useList<GroupLite>("groups");
  const teachers = useTeachers();
  const create = useCreateCourse();
  const remove = useDeleteCourse();

  const subjectOptions = subjects.data ?? [];
  const teacherOptions = teachers.data ?? [];
  const groupOptions = groups.data ?? [];

  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [semester, setSemester] = useState("1");
  const [academicYear, setAcademicYear] = useState("");
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<CourseRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const ready = subjectOptions.length > 0 && teacherOptions.length > 0 && groupOptions.length > 0;

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (groupIds.length === 0) return;
    create.mutate(
      {
        subjectId: Number(subjectId),
        teacherId: Number(teacherId),
        semester: Number(semester),
        academicYear: academicYear.trim(),
        groupIds,
      },
      {
        onSuccess: (c) => {
          setSubjectId("");
          setTeacherId("");
          setSemester("1");
          setAcademicYear("");
          setGroupIds([]);
          show(t("created", { n: c.enrolledCount }));
        },
        onError: (err) => setFormError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  const onConfirmDelete = () => {
    if (!deleting) return;
    setDeleteError(null);
    remove.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        show(tc("deleted"));
      },
      onError: (err) => setDeleteError(apiErrorMessage(err, locale) ?? tc("genericError")),
    });
  };

  const toggleGroup = (id: number) =>
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const rows = list.data ?? [];

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-[13.5px] text-ink-soft">{t("subtitle")}</p>

      {/* Create form */}
      <Card className="mt-6">
        <h2 className="mb-4 text-section font-bold text-ink">{t("create")}</h2>
        {!ready ? (
          <div className="space-y-1 text-[13.5px] text-ink-soft">
            {subjectOptions.length === 0 && <p className="text-amber">{t("noSubjects")}</p>}
            {teacherOptions.length === 0 && <p className="text-amber">{t("noTeachers")}</p>}
            {groupOptions.length === 0 && <p className="text-amber">{t("noGroups")}</p>}
          </div>
        ) : (
          <form onSubmit={onCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("subject")}>
                <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
                  <option value="" disabled>
                    {t("selectSubject")}
                  </option>
                  {subjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.departmentName})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("teacher")}>
                <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
                  <option value="" disabled>
                    {t("selectTeacher")}
                  </option>
                  {teacherOptions.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("semester")}>
                <Select value={semester} onChange={(e) => setSemester(e.target.value)}>
                  {SEMESTERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("academicYear")}>
                <Input
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder={t("academicYearPlaceholder")}
                  required
                />
              </Field>
            </div>
            <Field label={t("groups")}>
              <ChipSelect
                options={groupOptions.map((g) => ({ id: g.id, label: g.name }))}
                selected={groupIds}
                onToggle={toggleGroup}
              />
            </Field>
            {formError && <p className="text-[13px] text-rose">{formError}</p>}
            <Button
              type="submit"
              icon={<span className="text-lg leading-none">+</span>}
              disabled={create.isPending || groupIds.length === 0}
            >
              {tc("add")}
            </Button>
          </form>
        )}
      </Card>

      {/* Table */}
      <div className="mt-6">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={rows.length === 0}
          emptyIcon={<Icon icon={GraduationCap} size={22} />}
          emptyText={t("empty")}
          onRetry={() => list.refetch()}
        >
          <DataTable
            headers={[
              t("subject"),
              t("teacher"),
              t("semester"),
              t("academicYear"),
              t("groups"),
              t("students"),
              t("actions"),
            ]}
          >
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/admin/courses/${c.id}`)}
                    className="font-medium text-brand-deep hover:underline"
                  >
                    {c.subjectName}
                  </button>
                </td>
                <td className="px-4 py-3 text-ink-soft">{c.teacherName}</td>
                <td className="px-4 py-3 text-ink-soft">{c.semester}</td>
                <td className="px-4 py-3 text-ink-soft">{c.academicYear}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.groups.map((g) => (
                      <Badge key={g.id} tone="slate">
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone="blue">{c.studentCount}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(c);
                      }}
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose"
                      aria-label="delete"
                    >
                      <Icon icon={Trash2} size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </AsyncSection>
      </div>

      <ConfirmDialog
        open={!!deleting}
        title={t("confirmDeleteTitle")}
        message={t("confirmDelete")}
        errorMessage={deleteError}
        loading={remove.isPending}
        onConfirm={onConfirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
