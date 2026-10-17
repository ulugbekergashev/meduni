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
import { PeriodFilter } from "../../../components/PeriodGroups";
import { PageHeader } from "../../../components/bento";
import { IconAction, TableCard } from "../components";
import { useDebounced } from "../../../lib/useDebounced";
import { useCoursePeriods, useCourses, useCreateCourse, useDeleteCourse, useTeachers, type CourseRow } from "./api";

interface GroupLite {
  id: number;
  name: string;
}
interface DepartmentLite {
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
  const [departmentFilter, setDepartmentFilter] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  const list = useCourses({ academicYear: year, semester: semesterFilter, departmentId: departmentFilter, search: debouncedSearch });
  const periods = useCoursePeriods();
  const departments = useList<DepartmentLite>("departments");
  const groups = useList<GroupLite>("groups");
  const teachers = useTeachers();
  const create = useCreateCourse();
  const remove = useDeleteCourse();

  const departmentOptions = departments.data ?? [];
  const teacherOptions = teachers.data ?? [];
  const groupOptions = groups.data ?? [];

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [semester, setSemester] = useState("1");
  const [academicYear, setAcademicYear] = useState("");
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<CourseRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const ready = departmentOptions.length > 0 && teacherOptions.length > 0 && groupOptions.length > 0;

  const resetForm = () => {
    setName("");
    setDepartmentId("");
    setTeacherId("");
    setSemester("1");
    setAcademicYear("");
    setGroupIds([]);
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (groupIds.length === 0) return;
    create.mutate(
      {
        name: name.trim(),
        departmentId: Number(departmentId),
        teacherId: Number(teacherId),
        semester: Number(semester),
        academicYear: academicYear.trim(),
        groupIds,
      },
      {
        onSuccess: (c) => {
          resetForm();
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

  const filtered = !!(debouncedSearch || year || semesterFilter || departmentFilter);

  return (
    <div className="space-y-3">
      <PageHeader
        className="mb-0"
        title={t("title")}
        subtitle={t("subtitle")}
        right={
          ready ? (
            <Button
              size="lg"
              icon={<Icon icon={Plus} size={16} />}
              onClick={() => {
                setFormError(null);
                setAddOpen(true);
              }}
            >
              {t("create")}
            </Button>
          ) : (
            <div className="space-y-0.5 rounded-control bg-amber-soft px-3 py-2 text-note text-amber">
              {departmentOptions.length === 0 && <p>{t("noDepartments")}</p>}
              {teacherOptions.length === 0 && <p>{t("noTeachers")}</p>}
              {groupOptions.length === 0 && <p>{t("noGroups")}</p>}
            </div>
          )
        }
      />

      {/* Create modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t("create")} className="max-w-2xl">
        <form onSubmit={onCreate} className="space-y-4">
          <Field label={t("courseName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("courseNamePlaceholder")} autoFocus required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("department")}>
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
                <option value="" disabled>
                  {t("selectDepartment")}
                </option>
                {departmentOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
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
          {formError && <p className="text-note text-rose">{formError}</p>}
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
      <TableCard
        toolbar={
          <>
            <div className="relative min-w-0 flex-1 basis-56">
              <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
            <PeriodFilter
              years={periods.data?.years ?? []}
              semesters={periods.data?.semesters ?? []}
              year={year}
              semester={semesterFilter}
              onYear={setYear}
              onSemester={setSemesterFilter}
            />
            <div className="w-full sm:w-56">
              <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                <option value="">{t("allDepartments")}</option>
                {departmentOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </>
        }
        footer={rows.length > 0 ? <span className="text-note text-ink-soft">{t("totalN", { n: rows.length })}</span> : undefined}
      >
        <div className={rows.length === 0 ? "p-3" : undefined}>
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={rows.length === 0}
          emptyIcon={<Icon icon={GraduationCap} size={22} />}
          emptyText={list.data && list.data.length === 0 && filtered ? t("noMatch") : t("empty")}
          onRetry={() => list.refetch()}
        >
          <DataTable
            hideOnMobile={[3, 4, 5, 6]}
            headers={[
              t("courseName"),
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
                <tr className="bg-surface-raised">
                  <td colSpan={7} className="px-4 py-1.5 text-micro font-semibold uppercase tracking-wider text-ink-soft">
                    {c.academicYear} · {t("semesterN", { n: c.semester })}
                  </td>
                </tr>
              )}
              <tr className="border-b border-line transition-colors last:border-0 hover:bg-surface-raised">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/courses/${c.id}`)}
                    className="rounded-control text-left font-semibold text-ink hover:text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {c.name}
                  </button>
                  <p className="text-micro text-ink-soft">{c.departmentName}</p>
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
                    <IconAction
                      icon={Trash2}
                      label="delete"
                      tone="rose"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(c);
                      }}
                    />
                  </div>
                </td>
              </tr>
              </Fragment>
              );
            })}
          </DataTable>
        </AsyncSection>
        </div>
      </TableCard>

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
