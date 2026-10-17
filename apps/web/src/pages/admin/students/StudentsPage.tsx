import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, FilterX, GraduationCap, KeyRound, Pencil, Search, UserPlus } from "lucide-react";
import { Button, Donut, Icon, Input, LegendRow, ProgressBar, Select, Toggle, cls, useToast } from "@meduni/ui";
import { BentoCard, PageHeader } from "../../../components/bento";
import { IconAction, PillTabs, TableCard } from "../components";
import { AsyncSection } from "../../../components/AsyncSection";
import { Avatar } from "../../../components/Avatar";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { DataTable } from "../../../components/DataTable";
import { useDebounced } from "../../../lib/useDebounced";
import { useList } from "../../../lib/crud";
import { isLowAttendance } from "../../../lib/attendance";
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
    pct === null ? "text-ink-faint" : isLowAttendance(pct) ? "font-bold text-rose" : "font-semibold text-ink";

  return (
    <div className="space-y-3">
      <PageHeader
        className="mb-0"
        title={t("title")}
        subtitle={s ? t("summary", { total: s.total, active: s.active, groups: s.groupsCount }) : t("subtitle")}
        right={
          <Button size="lg" icon={<Icon icon={UserPlus} size={16} />} onClick={() => { setEditing(null); setFormOpen(true); }}>
            {t("add")}
          </Button>
        }
      />

      <div className={cls("grid grid-cols-1 gap-3", showDonut && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
        <TableCard
          toolbar={
            <>
              {/* ⛔ STAT DIETASI: "jami/faol/guruhlar" — shapkadagi MATN; yagona
                  filtr bo'lgan "Nofaol" — shu segment (ilgari stat-karta edi). */}
              <PillTabs
                value={inactiveOnly ? "inactive" : "all"}
                onChange={(k) => { setInactiveOnly(k === "inactive"); setPage(1); }}
                options={[
                  { key: "all", label: tc("all"), count: s?.total },
                  { key: "inactive", label: t("stats.inactive"), count: s?.inactive },
                ]}
              />
              {facultyOptions.length > 1 && (
                <div className="w-full flex-none sm:w-48">
                  <Select value={facultyId} onChange={(e) => { setFacultyId(e.target.value); setGroupId(""); setPage(1); }}>
                    <option value="">{t("filter.allFaculties")}</option>
                    {facultyOptions.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="w-full flex-none sm:w-40">
                <Select value={groupId} onChange={(e) => { setGroupId(e.target.value); setPage(1); }}>
                  <option value="">{t("filter.allGroups")}</option>
                  {groupOptions.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </Select>
              </div>
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
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
            </>
          }
          footer={
            data && items.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-note text-ink-soft">{t("totalCount", { count: data.total })}</span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</Button>
                    <span className="font-data text-note tabular-nums text-ink-soft">{page} / {totalPages}</span>
                    <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</Button>
                  </div>
                )}
              </div>
            ) : undefined
          }
        >
          <div className={cls(items.length === 0 && "p-3")}>
            <AsyncSection
              isLoading={list.isLoading}
              isError={list.isError}
              isEmpty={items.length === 0}
              emptyIcon={<Icon icon={GraduationCap} size={22} />}
              emptyText={hasFilters ? t("emptyFiltered") : t("empty")}
              onRetry={() => list.refetch()}
            >
              <DataTable
                hideOnMobile={[2, 4, 5]}
                headers={[t("table.name"), t("table.group"), t("table.progress"), t("table.attendance"), t("table.active"), t("table.actions")]}
              >
                {items.map((u) => (
                  <tr key={u.id} className="border-b border-line transition-colors last:border-0 hover:bg-surface-raised">
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${u.id}`} className="group flex items-center gap-3 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                        <Avatar name={u.fullName} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink group-hover:underline">{u.fullName}</span>
                          <span className="block truncate text-micro text-ink-soft">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-ink">{u.groupName ?? "—"}</span>
                      {u.facultyName && <span className="block text-micro text-ink-soft">{u.facultyName}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {u.progressPct === null ? (
                        <span className="text-note text-ink-faint">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-24"><ProgressBar value={u.progressPct} /></div>
                          <span className="w-9 font-data text-note font-semibold tabular-nums text-ink">{u.progressPct}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cls("font-data text-note tabular-nums", attClass(u.attendancePct))}>
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
                        <IconAction icon={Eye} label="profile" tone="blue" onClick={() => navigate(`/admin/users/${u.id}`)} />
                        <IconAction icon={Pencil} label="edit" tone="brand" onClick={() => { setEditing(u); setFormOpen(true); }} />
                        <IconAction icon={KeyRound} label="reset-password" tone="amber" onClick={() => setResetTarget(u)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </AsyncSection>
          </div>
        </TableCard>

        {/* Fakultetlar tarkibi — faqat solishtiradigan narsa bo'lsa */}
        {showDonut && s && (
          <BentoCard title={t("byFaculty")} className="self-start">
            <div className="flex flex-col items-center gap-4">
              <Donut
                size={128}
                stroke={14}
                centerValue={s.total}
                centerLabel={t("stats.total")}
                segments={s.byFaculty.slice(0, 5).map((f, i) => ({ value: f.count, tone: DONUT_TONES[i % DONUT_TONES.length] }))}
              />
              <div className="flex w-full min-w-0 flex-col gap-2">
                {s.byFaculty.slice(0, 5).map((f, i) => (
                  <LegendRow key={f.name} tone={DONUT_TONES[i % DONUT_TONES.length]} label={f.name} value={f.count} />
                ))}
              </div>
            </div>
          </BentoCard>
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
