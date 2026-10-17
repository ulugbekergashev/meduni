import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Plus, Search, UserX, Users2 } from "lucide-react";
import { Button, Icon, Input, Modal, Select, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { PageHeader } from "../../components/bento";
import { Field } from "../../components/Field";
import { apiErrorMessage } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { isLowAttendance } from "../../lib/attendance";
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

/** Guruh kartasi (Dizayn v3) — katta o'rtacha progress, davomat, talabalar, kurslar. */
function GroupCard({ g, onClick }: { g: TeachGroup; onClick: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groups" });
  const att = g.avgAttendance ?? null;
  const progress = g.avgProgress ?? 0;
  const behind = g.behindCount ?? 0;
  const lowAtt = isLowAttendance(att);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full w-full min-w-0 flex-col rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
          <Icon icon={Users2} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-section font-semibold text-ink">{g.name}</span>
          <span className="block truncate text-micro text-ink-soft">{t("yearN", { n: g.yearOfStudy })} · {g.facultyName}</span>
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface">
          <Icon icon={ArrowUpRight} size={13} />
        </span>
      </span>

      <span className="mt-4 flex items-end gap-4">
        <span className="min-w-0">
          <span className="block text-stat font-semibold tabular-nums text-ink">{progress}%</span>
          <span className="block text-micro text-ink-soft">{t("mProgress")}</span>
        </span>
        <span className="min-w-0">
          <span className={cls("block font-data text-body font-semibold tabular-nums", lowAtt ? "text-rose" : "text-ink")}>{att === null ? "—" : `${att}%`}</span>
          <span className="block text-micro text-ink-soft">{t("mAttendance")}</span>
        </span>
        <span className="min-w-0">
          <span className="block font-data text-body font-semibold tabular-nums text-ink">{g.studentCount}</span>
          <span className="block text-micro text-ink-soft">{t("mStudents")}</span>
        </span>
      </span>
      <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-pill bg-line">
        {progress > 0 && <span className="block h-full rounded-pill bg-brand" style={{ width: `${progress}%` }} />}
      </span>

      {(g.courses.length > 0 || behind > 0) && (
        <span className="mt-3 flex flex-wrap gap-1.5">
          {behind > 0 && (
            <span className="rounded-pill bg-rose-soft px-2 py-0.5 text-micro font-semibold text-rose">{t("behindN", { n: behind })}</span>
          )}
          {g.courses.slice(0, 3).map((c) => (
            <span key={c.id} className="rounded-pill bg-surface-raised px-2 py-0.5 text-micro font-semibold text-ink-2">{c.name}</span>
          ))}
          {g.courses.length > 3 && <span className="rounded-pill bg-surface-raised px-2 py-0.5 text-micro text-ink-soft">+{g.courses.length - 3}</span>}
        </span>
      )}
    </button>
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
    const students = groups.reduce((a, g) => a + (g.studentCount ?? 0), 0);
    const behind = groups.reduce((a, g) => a + (g.behindCount ?? 0), 0);
    const avgProgress = groups.length ? Math.round(groups.reduce((a, g) => a + (g.avgProgress ?? 0), 0) / groups.length) : 0;
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
    else if (sort === "progress") sorted.sort((a, b) => (b.avgProgress ?? 0) - (a.avgProgress ?? 0));
    else if (sort === "attendance") sorted.sort((a, b) => (a.avgAttendance ?? 999) - (b.avgAttendance ?? 999));
    else sorted.sort((a, b) => (b.behindCount ?? 0) - (a.behindCount ?? 0));
    return sorted;
  }, [groups, search, sort, onlyBehind]);

  return (
    <div className="space-y-3">
      <PageHeader
        className="mb-0"
        title={t("title")}
        subtitle={
          groups.length > 0
            ? t("summaryLine", { groups: summary.count, students: summary.students, pct: summary.avgProgress })
            : t("subtitle")
        }
        right={<Button icon={<Icon icon={Plus} size={16} />} onClick={() => setAddOpen(true)}>{tc("createGroupBtn")}</Button>}
      />

      {addOpen && <NewGroupModal onClose={() => setAddOpen(false)} />}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-10 w-full rounded-pill border border-line bg-surface pl-10 pr-4 text-note text-ink outline-none transition-colors focus:border-brand"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label={t("sortName")}
          className="h-10 rounded-pill border border-line bg-surface px-3 text-note text-ink outline-none focus:border-brand"
        >
          <option value="name">{t("sortName")}</option>
          <option value="progress">{t("sortProgress")}</option>
          <option value="attendance">{t("sortAttendance")}</option>
          <option value="behind">{t("sortBehind")}</option>
        </select>
        {summary.behind > 0 && (
          <button
            type="button"
            aria-pressed={onlyBehind}
            onClick={() => setOnlyBehind((v) => !v)}
            className={cls(
              "inline-flex h-10 items-center gap-1.5 rounded-pill px-4 text-note font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              onlyBehind ? "bg-ink text-surface" : "bg-rose-soft text-rose hover:brightness-95"
            )}
          >
            <Icon icon={UserX} size={14} />
            {t("sBehind")}
            <span className="font-data text-micro tabular-nums">{summary.behind}</span>
          </button>
        )}
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
