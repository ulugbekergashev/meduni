import { Fragment, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GraduationCap, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Button, ChipSelect, Icon, Input, Modal, Select, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { DataTable } from "../../../components/DataTable";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useList } from "../../../lib/crud";
import { useLocale } from "../../../lib/useLocale";
import type { Subject } from "../structure/types";
import { PeriodFilter } from "../../../components/PeriodGroups";
import { useDebounced } from "../../../lib/useDebounced";
import { useCoursePeriods, useCourses, useCreateCourse, useDeleteCourse, useTeachers, type CourseRow } from "./api";

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

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  const list = useCourses({ academicYear: year, semester: semesterFilter, subjectId: subjectFilter, search: debouncedSearch });
  const periods = useCoursePeriods();
  const subjects = useList<Subject>("subjects");
  const groups = useList<GroupLite>("groups");
  const teachers = useTeachers();
  const create = useCreateCourse();
  const remove = useDeleteCourse();

  const subjectOptions = subjects.data ?? [];
  const teacherOptions = teachers.data ?? [];
  const groupOptions = groups.data ?? [];

  const [addOpen, setAddOpen] = useState(false);
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
          setAddOpen(false);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
          <p className="mt-1 text-[14.5px] text-ink-soft">{t("subtitle")}</p>
        </div>
        {ready ? (
          <Button
            icon={<Icon icon={Plus} size={16} />}
            onClick={() => {
              setFormError(null);
              setAddOpen(true);
            }}
          >
            {t("create")}
          </Button>
        ) : (
          <div className="space-y-0.5 text-right text-[13.5px]">
            {subjectOptions.length === 0 && <p className="text-amber">{t("noSubjects")}</p>}
            {teacherOptions.length === 0 && <p className="text-amber">{t("noTeachers")}</p>}
            {groupOptions.length === 0 && <p className="text-amber">{t("noGroups")}</p>}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t("create")} className="max-w-2xl">
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
          {formError && <p className="text-[14px] text-rose">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending || groupIds.length === 0}>
              {tc("add")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Filtrlar — kurslar semestrlar bo'ylab ko'payadi, kerakligini tez topish uchun */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[14.5px] outline-none focus:border-brand"
          />
        </div>
        <PeriodFilter
          years={periods.data?.years ?? []}
          semesters={periods.data?.semesters ?? []}
          year={year}
          semester={semesterFilter}
          onYear={setYear}
          onSemester={setSemesterFilter}
        />
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-control border border-line bg-surface px-2.5 py-2 text-[14.5px] text-ink outline-none focus:border-brand"
        >
          <option value="">{t("allSubjects")}</option>
          {subjectOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="text-note font-semibold text-ink-soft">{t("totalN", { n: rows.length })}</span>
      </div>

      {/* Table */}
      <div className="mt-4">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={rows.length === 0}
          emptyIcon={<Icon icon={GraduationCap} size={22} />}
          emptyText={list.data && list.data.length === 0 && (debouncedSearch || year || semesterFilter || subjectFilter) ? t("noMatch") : t("empty")}
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
            {rows.map((c, i) => {
              const prev = rows[i - 1];
              const newPeriod = !prev || prev.academicYear !== c.academicYear || prev.semester !== c.semester;
              return (
              <Fragment key={c.id}>
              {newPeriod && (
                <tr className="bg-bg">
                  <td colSpan={7} className="px-4 py-1.5 text-note font-bold uppercase tracking-wide text-ink-soft">
                    {c.academicYear} · {t("semesterN", { n: c.semester })}
                  </td>
                </tr>
              )}
              <tr className="border-b border-line last:border-0">
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
              </Fragment>
              );
            })}
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
