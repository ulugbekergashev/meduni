import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, GraduationCap, Plus, Search, TrendingUp, UserX, Users2 } from "lucide-react";
import { Badge, Button, Card, Icon, Input, Modal, ProgressRing, Select, StatCard, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { Field } from "../../components/Field";
import { apiErrorMessage } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { useCreateTeacherGroup, useTeachGroups, type TeachGroup } from "./api";

/** O'qituvchi yangi guruh yaratadi (o'z fakultetida). */
function NewGroupModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const create = useCreateTeacherGroup();
  const [name, setName] = useState("");
  const [year, setYear] = useState("3");
  const [err, setErr] = useState<string | null>(null);

  return (
    <Modal open onClose={onClose} title={t("newGroupTitle")}>
      <div className="space-y-4">
        <Field label={t("groupNameLabel")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("groupNamePlaceholder")} autoFocus />
        </Field>
        <Field label={t("groupYear")}>
          <Select value={year} onChange={(e) => setYear(e.target.value)}>
            {[1, 2, 3, 4, 5, 6].map((y) => (<option key={y} value={y}>{t("yearN", { n: y })}</option>))}
          </Select>
        </Field>
        {err && <p className="text-note text-rose">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            disabled={create.isPending || !name.trim()}
            onClick={() =>
              create.mutate(
                { name: name.trim(), yearOfStudy: Number(year) },
                { onSuccess: () => { show(tc("added")); onClose(); }, onError: (e) => setErr(apiErrorMessage(e, locale) ?? tc("genericError")) }
              )
            }
          >
            {tc("add")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Boy guruh kartasi — progress halqasi + davomat + orqada qolganlar + kurslar. */
function GroupCard({ g, onClick }: { g: TeachGroup; onClick: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groups" });
  const lowAtt = g.avgAttendance !== null && g.avgAttendance < 75;
  return (
    <Card interactive onClick={onClick} className="flex flex-col gap-3 !p-0">
      <div className="flex items-center gap-3 border-b border-line px-4 pt-4 pb-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-deep">
          <Icon icon={Users2} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body font-bold text-ink">{g.name}</h3>
          <p className="truncate text-micro text-ink-faint">{t("yearN", { n: g.yearOfStudy })} · {g.facultyName}</p>
        </div>
        {g.behindCount > 0 && <Badge tone="rose">{t("behindN", { n: g.behindCount })}</Badge>}
      </div>

      <div className="grid grid-cols-3 items-center gap-2 px-4">
        <div className="flex flex-col items-center gap-1">
          <ProgressRing value={g.avgProgress} size={52} stroke={6} tone="brand" />
          <span className="text-micro font-medium text-ink-soft">{t("mProgress")}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className={cls("text-section font-bold tabular-nums", lowAtt ? "text-rose" : "text-blue")}>{g.avgAttendance === null ? "—" : `${g.avgAttendance}%`}</span>
          <span className="text-micro font-medium text-ink-soft">{t("mAttendance")}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-section font-bold tabular-nums text-ink">{g.studentCount}</span>
          <span className="text-micro font-medium text-ink-soft">{t("mStudents")}</span>
        </div>
      </div>

      {g.courses.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4">
          {g.courses.slice(0, 4).map((c) => (
            <span key={c.id} className="rounded-pill bg-bg px-2 py-0.5 text-micro text-ink-soft">{c.name}</span>
          ))}
          {g.courses.length > 4 && <span className="rounded-pill bg-bg px-2 py-0.5 text-micro text-ink-faint">+{g.courses.length - 4}</span>}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-line px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-micro font-medium text-ink-soft">
          <Icon icon={GraduationCap} size={14} /> {t("studentsN", { n: g.studentCount })}
        </span>
        <span className="inline-flex items-center gap-0.5 text-micro font-semibold text-brand-deep">{t("open")} <Icon icon={ChevronRight} size={13} /></span>
      </div>
    </Card>
  );
}

type SortKey = "name" | "progress" | "attendance" | "behind";

// Group cards with search — click opens the group profile (schedule/roll-call).
export function TeachGroupsPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "groups" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();
  const q = useTeachGroups();
  const groups = q.data ?? [];
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [onlyBehind, setOnlyBehind] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Xulosa (barcha guruhlar bo'yicha).
  const summary = useMemo(() => {
    const students = groups.reduce((a, g) => a + g.studentCount, 0);
    const behind = groups.reduce((a, g) => a + g.behindCount, 0);
    const avgProgress = groups.length ? Math.round(groups.reduce((a, g) => a + g.avgProgress, 0) / groups.length) : 0;
    return { count: groups.length, students, behind, avgProgress };
  }, [groups]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let list = groups.filter(
      (g) =>
        !needle ||
        g.name.toLowerCase().includes(needle) ||
        g.facultyName.toLowerCase().includes(needle) ||
        g.courses.some((c) => c.name.toLowerCase().includes(needle))
    );
    if (onlyBehind) list = list.filter((g) => g.behindCount > 0);
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "progress") sorted.sort((a, b) => b.avgProgress - a.avgProgress);
    else if (sort === "attendance") sorted.sort((a, b) => (a.avgAttendance ?? 999) - (b.avgAttendance ?? 999));
    else sorted.sort((a, b) => b.behindCount - a.behindCount);
    return sorted;
  }, [groups, search, sort, onlyBehind]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
          <p className="mt-1 text-note text-ink-soft">{t("subtitle")}</p>
        </div>
        <Button icon={<Icon icon={Plus} size={16} />} onClick={() => setAddOpen(true)}>{tc("createGroupBtn")}</Button>
      </div>

      {addOpen && <NewGroupModal onClose={() => setAddOpen(false)} />}

      {/* Xulosa */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <StatCard compact icon={Users2} tone="bg-brand-soft text-brand-deep" value={summary.count} label={t("sGroups")} />
          <StatCard compact icon={GraduationCap} tone="bg-blue-soft text-blue" value={summary.students} label={t("sStudents")} />
          <StatCard compact icon={TrendingUp} tone="bg-emerald-soft text-emerald" value={`${summary.avgProgress}%`} label={t("sAvgProgress")} />
          <StatCard compact icon={UserX} tone={summary.behind > 0 ? "bg-rose-soft text-rose" : "bg-bg text-ink-faint"} value={summary.behind} label={t("sBehind")} selected={onlyBehind} onClick={() => setOnlyBehind((v) => !v)} />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-note outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/10"
          />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto">
          <option value="name">{t("sortName")}</option>
          <option value="progress">{t("sortProgress")}</option>
          <option value="attendance">{t("sortAttendance")}</option>
          <option value="behind">{t("sortBehind")}</option>
        </Select>
        <span className="text-note font-semibold text-ink-soft">{tc("totalN", { n: filtered.length })}</span>
      </div>

      <AsyncSection
        isLoading={q.isLoading}
        isError={q.isError}
        isEmpty={filtered.length === 0}
        emptyIcon={<Icon icon={Users2} size={22} />}
        emptyText={groups.length === 0 ? t("empty") : t("noMatch")}
        onRetry={() => q.refetch()}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((g) => (
            <GroupCard key={g.id} g={g} onClick={() => navigate(`/teach/groups/${g.id}`)} />
          ))}
        </div>
      </AsyncSection>
    </div>
  );
}
