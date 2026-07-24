import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Info, Plus, Search, Users2 } from "lucide-react";
import { Button, ChipSelect, Icon, Input, Modal, Select, useToast } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { Field } from "../../components/Field";
import { apiErrorMessage } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { PeriodFilter, PeriodSection, groupByPeriod, usePeriodOptions } from "../../components/PeriodGroups";
import { useCourseFormOptions, useCreateTeacherCourse, useCreateTeacherGroup, useTeachCourses, useTeachDashboard, type TeachCourse } from "./api";
import { CourseCard } from "./CourseCard";

/** O'qituvchi o'z kafedrasida yangi kurs yaratadi. Semestr YO'Q — kurs o'z
 *  DASTURI (adabiyot, mavzular, soatlar) bilan belgilanadi, keyin to'ldiriladi. */
function NewCourseModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();
  const opts = useCourseFormOptions();
  const create = useCreateTeacherCourse();
  const createGroup = useCreateTeacherGroup();

  const [name, setName] = useState("");
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Inline yangi guruh
  const [ngOpen, setNgOpen] = useState(false);
  const [ngName, setNgName] = useState("");
  const [ngYear, setNgYear] = useState("3");

  const groups = opts.data?.groups ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (groupIds.length === 0) return;
    create.mutate(
      { name: name.trim(), groupIds },
      {
        onSuccess: (c) => {
          show(t("courseCreated", { n: c.enrolledCount }));
          onClose();
          navigate(`/teach/courses/${c.id}`);
        },
        onError: (e2) => setErr(apiErrorMessage(e2, locale) ?? tc("genericError")),
      }
    );
  };

  const addGroup = () => {
    if (!ngName.trim()) return;
    createGroup.mutate(
      { name: ngName.trim(), yearOfStudy: Number(ngYear) },
      {
        onSuccess: (g) => {
          setGroupIds((p) => [...p, g.id]); // yangi guruh avto tanlanadi
          setNgName("");
          setNgOpen(false);
          show(tc("added"));
        },
        onError: (e2) => setErr(apiErrorMessage(e2, locale) ?? tc("genericError")),
      }
    );
  };

  return (
    <Modal open onClose={onClose} title={t("newCourse")} className="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("courseNameLabel")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("courseNamePlaceholder")} autoFocus required />
        </Field>
        <p className="text-[13.5px] text-ink-soft">
          {t("courseDeptNote")}: <b className="text-ink">{opts.data?.departmentName ?? "…"}</b>
        </p>

        <Field label={t("groups")}>
          {groups.length === 0 && !ngOpen ? (
            <p className="mb-2 text-[13.5px] text-ink-soft">{t("noFacultyGroupsHint")}</p>
          ) : (
            <ChipSelect options={groups.map((g) => ({ id: g.id, label: g.name }))} selected={groupIds} onToggle={(id) => setGroupIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} />
          )}
          {/* Inline yangi guruh yaratish */}
          {ngOpen ? (
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-control border border-line bg-bg/40 p-2.5">
              <div className="min-w-[130px] flex-1">
                <Input value={ngName} onChange={(e) => setNgName(e.target.value)} placeholder={t("groupNamePlaceholder")} autoFocus />
              </div>
              <Select value={ngYear} onChange={(e) => setNgYear(e.target.value)} className="w-24">
                {[1, 2, 3, 4, 5, 6].map((y) => (<option key={y} value={y}>{t("yearN", { n: y })}</option>))}
              </Select>
              <Button type="button" size="sm" onClick={addGroup} disabled={createGroup.isPending || !ngName.trim()}>{tc("add")}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setNgOpen(false)}>{tc("cancel")}</Button>
            </div>
          ) : (
            <button type="button" onClick={() => setNgOpen(true)} className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-deep hover:underline">
              <Icon icon={Users2} size={14} /> {t("newGroup")}
            </button>
          )}
        </Field>

        <div className="flex items-start gap-2 rounded-control border border-line bg-brand-soft/40 px-3 py-2.5 text-[13px] text-ink-soft">
          <Icon icon={Info} size={15} className="mt-0.5 shrink-0 text-brand-deep" />
          <span>{t("programNote")}</span>
        </div>

        {err && <p className="text-[14px] text-rose">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" disabled={create.isPending || groupIds.length === 0}>{tc("add")}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function TeachCoursesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const list = useTeachCourses();
  const dash = useTeachDashboard();
  const courses = useMemo(() => list.data ?? [], [list.data]);
  const avg = (id: number) => dash.data?.courses.find((c) => c.id === id)?.avgProgress ?? 0;

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const options = usePeriodOptions(courses);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (year && c.academicYear !== year) return false;
      if (semester && String(c.semester) !== semester) return false;
      if (!q) return true;
      return (
        c.subjectName.toLowerCase().includes(q) ||
        c.groups.some((g) => g.name.toLowerCase().includes(q))
      );
    });
  }, [courses, search, year, semester]);

  const groups = useMemo(() => groupByPeriod<TeachCourse>(filtered), [filtered]);

  return (
    <div className="relative z-0 min-h-[80vh] space-y-6 pb-10">
      {/* Background blobs for premium feel */}
      <div className="pointer-events-none fixed left-0 top-0 -z-10 h-full w-full overflow-hidden bg-bg">
        <div className="absolute right-[5%] top-[10%] h-[500px] w-[500px] rounded-full bg-brand/5 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[-10%] h-[400px] w-[400px] rounded-full bg-violet-400/5 blur-[120px]" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] font-black tracking-tight text-ink drop-shadow-sm sm:text-[40px]">{t("myCourses")}</h1>
          <p className="text-[16px] font-medium text-ink-soft">{t("coursesSubtitle")}</p>
        </div>
        <Button icon={<Icon icon={Plus} size={16} />} onClick={() => setAddOpen(true)}>
          {t("newCourse")}
        </Button>
      </div>

      {addOpen && <NewCourseModal onClose={() => setAddOpen(false)} />}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-line bg-surface p-4 shadow-sm ring-1 ring-line">
        <div className="relative min-w-[240px] flex-1">
          <Icon icon={Search} size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchCourse")}
            className="w-full rounded-[16px] border-none bg-surface-raised py-3 pl-11 pr-4 text-[15px] font-semibold text-ink shadow-sm ring-1 ring-line transition-all focus:bg-surface-glass focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
        <div className="flex items-center gap-3">
          <PeriodFilter
            years={options.years}
            semesters={options.semesters}
            year={year}
            semester={semester}
            onYear={setYear}
            onSemester={setSemester}
          />
          <span className="hidden rounded-full bg-surface-raised px-4 py-2 text-[14px] font-bold text-brand-deep shadow-sm ring-1 ring-line sm:inline-block">
            {t("totalN", { n: filtered.length })}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={filtered.length === 0}
          emptyIcon={<Icon icon={BookOpen} size={28} className="text-brand-soft" />}
          emptyText={courses.length === 0 ? t("empty") : t("noMatch")}
          emptyHint={courses.length === 0 ? undefined : t("noMatchHint")}
          onRetry={() => list.refetch()}
        >
          {groups.map((g, i) => (
            <PeriodSection
              key={g.year}
              group={g}
              defaultOpen={i === 0 || !!year || !!semester || !!search.trim()}
              renderRows={(rows) => (
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((c) => (
                    <li key={c.id}>
                      <CourseCard course={c} avgProgress={avg(c.id)} />
                    </li>
                  ))}
                </ul>
              )}
            />
          ))}
        </AsyncSection>
      </div>
    </div>
  );
}
