import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Eye,
  FilterX,
  GraduationCap,
  KeyRound,
  Pencil,
  Search,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { Button, Card, Donut, Icon, Input, LegendRow, ProgressBar, Select, StatCard, Toggle, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { Avatar } from "../../../components/Avatar";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { DataTable } from "../../../components/DataTable";
import { useDebounced } from "../../../lib/useDebounced";
import { useList } from "../../../lib/crud";
import type { Faculty, Group } from "../structure/types";
import { PasswordModal } from "../users/PasswordModal";
import { StudentFormModal } from "./StudentFormModal";
import {
  useResetStudentPassword,
  useStudents,
  useStudentStats,
  useToggleStudent,
  type StudentRow,
} from "./api";

const DONUT_TONES = ["brand", "emerald", "amber", "blue", "rose"] as const;

export function StudentsPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "students" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const { show } = useToast();
  const navigate = useNavigate();

  const [facultyId, setFacultyId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);

  const stats = useStudentStats();
  const faculties = useList<Faculty>("faculties");
  const groups = useList<Group>("groups");
  const list = useStudents({
    facultyId,
    groupId,
    active: inactiveOnly ? "false" : "",
    search,
    page,
  });

  const toggle = useToggleStudent();
  const resetPw = useResetStudentPassword();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<StudentRow | null>(null);

  const facultyOptions = faculties.data ?? [];
  const groupOptions = (groups.data ?? []).filter((g) => !facultyId || g.facultyId === Number(facultyId));

  const s = stats.data;
  const data = list.data;
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilters = facultyId !== "" || groupId !== "" || inactiveOnly || searchInput !== "";
  const showDonut = (s?.byFaculty.filter((f) => f.count > 0).length ?? 0) > 1;

  const clearFilters = () => {
    setFacultyId("");
    setGroupId("");
    setInactiveOnly(false);
    setSearchInput("");
    setPage(1);
  };

  const attClass = (pct: number | null) =>
    pct === null ? "text-ink-faint" : pct < 75 ? "font-bold text-rose" : "font-semibold text-ink";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
          <p className="mt-1 text-[14.5px] text-ink-soft">{t("subtitle")}</p>
        </div>
        <Button icon={<Icon icon={UserPlus} size={16} />} onClick={() => { setEditing(null); setFormOpen(true); }}>
          {t("add")}
        </Button>
      </div>

      {/* Stats */}
      <div className={cls("mt-3 grid grid-cols-2 gap-3", showDonut ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        <StatCard icon={GraduationCap} value={s?.total} label={t("stats.total")} hint={t("stats.totalHint")} tone="bg-blue-soft text-blue" />
        <StatCard icon={UserCheck} value={s?.active} label={t("stats.active")} hint={t("stats.activeHint")} tone="bg-emerald-soft text-emerald" />
        <StatCard
          icon={UserX}
          value={s?.inactive}
          label={t("stats.inactive")}
          hint={t("stats.inactiveHint")}
          tone="bg-rose-soft text-rose"
          selected={inactiveOnly}
          onClick={() => { setInactiveOnly((v) => !v); setPage(1); }}
        />
        {!showDonut && <StatCard icon={Users} value={s?.groupsCount} label={t("stats.groups")} hint={t("stats.groupsHint")} tone="bg-violet-soft text-violet" />}
      </div>

      {/* Faculty composition (only when there is something to compare) */}
      {showDonut && s && (
        <Card className="mt-3 flex flex-wrap items-center gap-3 !p-5">
          <Donut
            size={120}
            stroke={14}
            centerValue={s.total}
            centerLabel={t("stats.total")}
            segments={s.byFaculty.slice(0, 5).map((f, i) => ({ value: f.count, tone: DONUT_TONES[i % DONUT_TONES.length] }))}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {s.byFaculty.slice(0, 5).map((f, i) => (
              <LegendRow key={f.name} tone={DONUT_TONES[i % DONUT_TONES.length]} label={f.name} value={f.count} />
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {facultyOptions.length > 1 && (
          <div className="w-[190px] flex-none">
            <Select value={facultyId} onChange={(e) => { setFacultyId(e.target.value); setGroupId(""); setPage(1); }}>
              <option value="">{t("filter.allFaculties")}</option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="w-[160px] flex-none">
          <Select value={groupId} onChange={(e) => { setGroupId(e.target.value); setPage(1); }}>
            <option value="">{t("filter.allGroups")}</option>
            {groupOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </div>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            <Icon icon={Search} size={16} />
          </span>
          <Input
            className="pl-9"
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" icon={<Icon icon={FilterX} size={15} />} onClick={clearFilters}>
            {t("filter.clear")}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="mt-5">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={items.length === 0}
          emptyIcon={<Icon icon={GraduationCap} size={22} />}
          emptyText={hasFilters ? t("emptyFiltered") : t("empty")}
          onRetry={() => list.refetch()}
        >
          <DataTable headers={[t("table.name"), t("table.group"), t("table.progress"), t("table.attendance"), t("table.active"), t("table.actions")]}>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-line transition-colors last:border-0 hover:bg-bg/60">
                <td className="px-4 py-3">
                  <Link to={`/admin/users/${u.id}`} className="group flex items-center gap-3">
                    <Avatar name={u.fullName} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink group-hover:underline">{u.fullName}</span>
                      <span className="block truncate text-[13px] text-ink-faint">{u.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="block font-medium text-ink">{u.groupName ?? "—"}</span>
                  {u.facultyName && <span className="block text-[12.5px] text-ink-faint">{u.facultyName}</span>}
                </td>
                <td className="px-4 py-3">
                  {u.progressPct === null ? (
                    <span className="text-[14px] text-ink-faint">—</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-24"><ProgressBar value={u.progressPct} /></div>
                      <span className="w-9 text-[13.5px] font-semibold tabular-nums text-ink">{u.progressPct}%</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={cls("text-[14px] tabular-nums", attClass(u.attendancePct))}>
                    {u.attendancePct === null ? "—" : `${u.attendancePct}%`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={u.isActive}
                    disabled={toggle.isPending}
                    aria-label="active"
                    onChange={() => toggle.mutate(u.id, { onSuccess: () => show(tc("updated")) })}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => navigate(`/admin/users/${u.id}`)} className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-blue-soft hover:text-blue" aria-label="profile">
                      <Icon icon={Eye} size={16} />
                    </button>
                    <button onClick={() => { setEditing(u); setFormOpen(true); }} className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep" aria-label="edit">
                      <Icon icon={Pencil} size={16} />
                    </button>
                    <button onClick={() => setResetTarget(u)} className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-amber-soft hover:text-amber" aria-label="reset-password">
                      <Icon icon={KeyRound} size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </AsyncSection>

        {data && items.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[14px] text-ink-faint">{t("totalCount", { count: data.total })}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</Button>
                <span className="text-[14px] text-ink-soft tabular-nums">{page} / {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {formOpen && (
        <StudentFormModal
          editing={editing}
          onClose={(pw) => {
            setFormOpen(false);
            if (pw !== undefined) show(editing ? tc("updated") : tc("added"));
            if (pw) setRevealPassword(pw);
          }}
        />
      )}
      <PasswordModal password={revealPassword} onClose={() => setRevealPassword(null)} />
      <ConfirmDialog
        open={!!resetTarget}
        title={t("reset.title")}
        message={t("reset.confirm")}
        confirmLabel={t("reset.confirmBtn")}
        confirmVariant="primary"
        loading={resetPw.isPending}
        onConfirm={() => {
          if (!resetTarget) return;
          resetPw.mutate(resetTarget.id, {
            onSuccess: (r) => {
              setResetTarget(null);
              setRevealPassword(r.password);
            },
          });
        }}
        onClose={() => setResetTarget(null)}
      />
    </div>
  );
}
