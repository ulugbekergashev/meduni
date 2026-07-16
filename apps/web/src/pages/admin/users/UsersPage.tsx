import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Building2,
  Eye,
  FilterX,
  GraduationCap,
  KeyRound,
  Landmark,
  Pencil,
  Search,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { Badge, Button, Icon, Input, Select, StatCard, Toggle, useToast, type BadgeTone } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { Avatar } from "../../../components/Avatar";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { DataTable } from "../../../components/DataTable";
import { useDebounced } from "../../../lib/useDebounced";
import { useList } from "../../../lib/crud";
import type { Department, Faculty, Group } from "../structure/types";
import {
  useResetPassword,
  useToggleActive,
  useUsers,
  useUserStats,
  type UserRole,
  type UserRow,
} from "./api";
import { UserFormModal } from "./UserFormModal";
import { PasswordModal } from "./PasswordModal";

type RoleFilter = "" | "STUDENT" | "TEACHER" | "DEPT_ADMIN" | "FACULTY_ADMIN";

/** Tier colors follow the architecture scheme: super=slate, faculty=teal, dept=amber, teacher=violet, student=blue. */
const roleTone: Record<UserRole, BadgeTone> = {
  superadmin: "slate",
  faculty_admin: "brand",
  dept_admin: "amber",
  teacher: "violet",
  student: "blue",
};

export function UsersPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "users" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const { show } = useToast();
  const navigate = useNavigate();

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);

  const stats = useUserStats();
  const faculties = useList<Faculty>("faculties");
  const departments = useList<Department>("departments");
  const groups = useList<Group>("groups");

  const facultyOptions = faculties.data ?? [];
  const deptOptions = (departments.data ?? []).filter((d) => !facultyId || d.facultyId === Number(facultyId));
  const groupOptions = (groups.data ?? []).filter((g) => !facultyId || g.facultyId === Number(facultyId));

  const showDeptFilter = roleFilter === "TEACHER" || roleFilter === "DEPT_ADMIN";
  const showGroupFilter = roleFilter === "STUDENT";

  const list = useUsers({
    role: roleFilter,
    search,
    page,
    facultyId,
    departmentId: showDeptFilter ? departmentId : "",
    groupId: showGroupFilter ? groupId : "",
    active: inactiveOnly ? "false" : "",
  });

  const toggleActive = useToggleActive();
  const resetPw = useResetPassword();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);

  const data = list.data;
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const selectRole = (role: RoleFilter) => {
    setRoleFilter((prev) => (prev === role && !inactiveOnly ? "" : role));
    setInactiveOnly(false);
    setDepartmentId("");
    setGroupId("");
    setPage(1);
  };
  const toggleInactive = () => {
    setInactiveOnly((v) => !v);
    setRoleFilter("");
    setDepartmentId("");
    setGroupId("");
    setPage(1);
  };
  const clearFilters = () => {
    setRoleFilter("");
    setInactiveOnly(false);
    setFacultyId("");
    setDepartmentId("");
    setGroupId("");
    setSearchInput("");
    setPage(1);
  };
  const hasFilters =
    roleFilter !== "" || inactiveOnly || facultyId !== "" || departmentId !== "" || groupId !== "" || searchInput !== "";

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (u: UserRow) => {
    setEditing(u);
    setFormOpen(true);
  };

  const doReset = () => {
    if (!resetTarget) return;
    resetPw.mutate(resetTarget.id, {
      onSuccess: (r) => {
        setResetTarget(null);
        setRevealPassword(r.password);
      },
    });
  };

  const deptName = (u: UserRow) => u.departmentName ?? "";
  const facName = (u: UserRow) => u.facultyName ?? "";

  /** Context ("Tegishlilik") for the mixed view — each role shows its own anchor. */
  const affiliation = (u: UserRow) => {
    if (u.role === "student") return u.groupName ?? "—";
    if (u.role === "teacher" || u.role === "dept_admin") return deptName(u) || "—";
    if (u.role === "faculty_admin") return facName(u) || "—";
    return t("wholeUniversity");
  };

  const headers: string[] =
    roleFilter === "STUDENT"
      ? [t("table.name"), t("table.group"), t("table.faculty"), t("table.phone"), t("table.active"), t("table.actions")]
      : roleFilter === "TEACHER"
        ? [t("table.name"), t("table.department"), t("table.position"), t("table.active"), t("table.actions")]
        : roleFilter === "DEPT_ADMIN"
          ? [t("table.name"), t("table.departmentScope"), t("table.active"), t("table.actions")]
          : roleFilter === "FACULTY_ADMIN"
            ? [t("table.name"), t("table.facultyScope"), t("table.active"), t("table.actions")]
            : [t("table.name"), t("table.role"), t("table.affiliation"), t("table.active"), t("table.actions")];

  const groupFaculty = (u: UserRow) => {
    const g = (groups.data ?? []).find((x) => x.id === u.groupId);
    if (!g) return "—";
    return g.facultyName || "—";
  };

  const midCells = (u: UserRow) => {
    if (roleFilter === "STUDENT")
      return (
        <>
          <td className="px-4 py-3">
            <span className="font-medium text-ink">{u.groupName ?? "—"}</span>
          </td>
          <td className="px-4 py-3 text-ink-soft">{groupFaculty(u)}</td>
          <td className="px-4 py-3 text-ink-soft tabular-nums">{u.phone ?? "—"}</td>
        </>
      );
    if (roleFilter === "TEACHER")
      return (
        <>
          <td className="px-4 py-3 text-ink">{deptName(u) || "—"}</td>
          <td className="px-4 py-3 text-ink-soft">{u.position ?? "—"}</td>
        </>
      );
    if (roleFilter === "DEPT_ADMIN")
      return <td className="px-4 py-3 text-ink">{deptName(u) || "—"}</td>;
    if (roleFilter === "FACULTY_ADMIN")
      return <td className="px-4 py-3 text-ink">{facName(u) || "—"}</td>;
    return (
      <>
        <td className="px-4 py-3">
          <Badge tone={roleTone[u.role]}>{t(`role.${u.role}`)}</Badge>
        </td>
        <td className="px-4 py-3 text-ink-soft">{affiliation(u)}</td>
      </>
    );
  };

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-[13.5px] text-ink-soft">{t("subtitle")}</p>

      {/* Stats — clickable, double as role filter */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={GraduationCap}
          value={stats.data?.students}
          label={t("stats.students")}
          hint={t("stats.studentsHint")}
          tone="bg-blue-soft text-blue"
          selected={roleFilter === "STUDENT" && !inactiveOnly}
          onClick={() => selectRole("STUDENT")}
        />
        <StatCard
          icon={BookOpen}
          value={stats.data?.teachers}
          label={t("stats.teachers")}
          hint={t("stats.teachersHint")}
          tone="bg-violet-soft text-violet"
          selected={roleFilter === "TEACHER" && !inactiveOnly}
          onClick={() => selectRole("TEACHER")}
        />
        <StatCard
          icon={Building2}
          value={stats.data?.deptAdmins}
          label={t("stats.deptAdmins")}
          hint={t("stats.deptAdminsHint")}
          tone="bg-amber-soft text-amber"
          selected={roleFilter === "DEPT_ADMIN" && !inactiveOnly}
          onClick={() => selectRole("DEPT_ADMIN")}
        />
        <StatCard
          icon={Landmark}
          value={stats.data?.facultyAdmins}
          label={t("stats.facultyAdmins")}
          hint={t("stats.facultyAdminsHint")}
          tone="bg-brand-soft text-brand-deep"
          selected={roleFilter === "FACULTY_ADMIN" && !inactiveOnly}
          onClick={() => selectRole("FACULTY_ADMIN")}
        />
        <StatCard
          icon={UserX}
          value={stats.data?.inactive}
          label={t("stats.inactive")}
          hint={t("stats.inactiveHint")}
          tone="bg-rose-soft text-rose"
          selected={inactiveOnly}
          onClick={toggleInactive}
        />
      </div>

      {/* Filter bar */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {facultyOptions.length > 1 && (
          <div className="w-[190px] flex-none">
            <Select
              value={facultyId}
              onChange={(e) => {
                setFacultyId(e.target.value);
                setDepartmentId("");
                setGroupId("");
                setPage(1);
              }}
            >
              <option value="">{t("filter.allFaculties")}</option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showDeptFilter && (
          <div className="w-[190px] flex-none">
            <Select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("filter.allDepartments")}</option>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showGroupFilter && (
          <div className="w-[150px] flex-none">
            <Select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("filter.allGroups")}</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            <Icon icon={Search} size={16} />
          </span>
          <Input
            className="pl-9"
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" icon={<Icon icon={FilterX} size={15} />} onClick={clearFilters}>
            {t("filter.clear")}
          </Button>
        )}

        <div className="ml-auto flex gap-2">
          <Button icon={<Icon icon={UserPlus} size={16} />} onClick={openAdd}>
            {t("addUser")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-5">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={items.length === 0}
          emptyIcon={<Icon icon={Users} size={22} />}
          emptyText={hasFilters ? t("emptyFiltered") : t("empty")}
          onRetry={() => list.refetch()}
        >
          <DataTable headers={headers}>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-line transition-colors last:border-0 hover:bg-bg/60">
                <td className="px-4 py-3">
                  <Link to={`/admin/users/${u.id}`} className="group flex items-center gap-3">
                    <Avatar name={u.fullName} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink group-hover:underline">{u.fullName}</span>
                      <span className="block truncate text-[12px] text-ink-faint">{u.email}</span>
                    </span>
                  </Link>
                </td>
                {midCells(u)}
                <td className="px-4 py-3">
                  <Toggle
                    checked={u.isActive}
                    disabled={toggleActive.isPending}
                    aria-label="active"
                    onChange={() => toggleActive.mutate(u.id, { onSuccess: () => show(tc("updated")) })}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-blue-soft hover:text-blue"
                      aria-label="profile"
                      title={t("table.profile")}
                    >
                      <Icon icon={Eye} size={16} />
                    </button>
                    <button
                      onClick={() => openEdit(u)}
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep"
                      aria-label="edit"
                      title={tc("edit")}
                    >
                      <Icon icon={Pencil} size={16} />
                    </button>
                    <button
                      onClick={() => setResetTarget(u)}
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-amber-soft hover:text-amber"
                      aria-label="reset-password"
                      title={t("reset.action")}
                    >
                      <Icon icon={KeyRound} size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </AsyncSection>

        {/* Total + pagination */}
        {data && items.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink-faint">{t("filter.totalCount", { count: data.total })}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("pagination.prev")}
                </Button>
                <span className="text-[13px] text-ink-soft tabular-nums">
                  {t("pagination.pageOf", { page, total: totalPages })}
                </span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  {t("pagination.next")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <UserFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onCreated={(pw) => {
          setFormOpen(false);
          show(tc("added"));
          if (pw) setRevealPassword(pw);
        }}
        onUpdated={() => {
          setFormOpen(false);
          show(tc("updated"));
        }}
      />

      <PasswordModal password={revealPassword} onClose={() => setRevealPassword(null)} />

      <ConfirmDialog
        open={!!resetTarget}
        title={t("reset.title")}
        message={t("reset.confirm")}
        confirmLabel={t("reset.confirmBtn")}
        confirmVariant="primary"
        loading={resetPw.isPending}
        onConfirm={doReset}
        onClose={() => setResetTarget(null)}
      />
    </div>
  );
}
