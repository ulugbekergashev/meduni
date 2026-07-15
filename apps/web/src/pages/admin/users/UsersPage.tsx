import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound, Pencil, Search, Upload, UserPlus, Users } from "lucide-react";
import { Badge, Button, Icon, Input, Toggle, cls, useToast, type BadgeTone } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { Avatar } from "../../../components/Avatar";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { DataTable } from "../../../components/DataTable";
import { useDebounced } from "../../../lib/useDebounced";
import {
  useResetPassword,
  useToggleActive,
  useUsers,
  type UserRole,
  type UserRow,
} from "./api";
import { UserFormModal } from "./UserFormModal";
import { PasswordModal } from "./PasswordModal";
import { ImportModal } from "./ImportModal";

const roleTone: Record<UserRole, BadgeTone> = {
  admin: "amber",
  superadmin: "amber",
  faculty_admin: "amber",
  dept_admin: "emerald",
  teacher: "violet",
  student: "blue",
};

export function UsersPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "users" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const { show } = useToast();

  const [roleFilter, setRoleFilter] = useState<"" | "STUDENT" | "TEACHER" | "DEPT_ADMIN" | "FACULTY_ADMIN">("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);

  const list = useUsers({ role: roleFilter, search, page });

  const toggleActive = useToggleActive();
  const resetPw = useResetPassword();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);

  const data = list.data;
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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

  const roleTabs: { value: "" | "STUDENT" | "TEACHER" | "DEPT_ADMIN" | "FACULTY_ADMIN"; label: string }[] = [
    { value: "", label: t("roleFilter.all") },
    { value: "STUDENT", label: t("roleFilter.student") },
    { value: "TEACHER", label: t("roleFilter.teacher") },
    { value: "DEPT_ADMIN", label: t("roleFilter.deptAdmin") },
    { value: "FACULTY_ADMIN", label: t("roleFilter.facultyAdmin") },
  ];

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-[13.5px] text-ink-soft">{t("subtitle")}</p>

      {/* Top panel */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-control border border-line bg-surface p-0.5">
          {roleTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setRoleFilter(tab.value);
                setPage(1);
              }}
              className={cls(
                "rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-colors",
                roleFilter === tab.value ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:text-ink"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

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

        <div className="ml-auto flex gap-2">
          <Button variant="ghost" icon={<Icon icon={Upload} size={16} />} onClick={() => setImportOpen(true)}>
            {t("excelImport")}
          </Button>
          <Button icon={<Icon icon={UserPlus} size={16} />} onClick={openAdd}>
            {t("addUser")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6">
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={items.length === 0}
          emptyIcon={<Icon icon={Users} size={22} />}
          emptyText={t("empty")}
          onRetry={() => list.refetch()}
        >
          <DataTable
            headers={[t("table.name"), t("table.email"), t("table.role"), t("table.active"), t("table.actions")]}
          >
            {items.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 hover:underline">
                    <Avatar name={u.fullName} />
                    <span className="font-medium text-ink">{u.fullName}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">{u.email}</td>
                <td className="px-4 py-3">
                  <Badge tone={roleTone[u.role]}>{t(`role.${u.role}`)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={u.isActive}
                    disabled={toggleActive.isPending}
                    aria-label="active"
                    onChange={() =>
                      toggleActive.mutate(u.id, { onSuccess: () => show(tc("updated")) })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(u)}
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep"
                      aria-label="edit"
                    >
                      <Icon icon={Pencil} size={16} />
                    </button>
                    <button
                      onClick={() => setResetTarget(u)}
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-amber-soft hover:text-amber"
                      aria-label="reset-password"
                    >
                      <Icon icon={KeyRound} size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </AsyncSection>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("pagination.prev")}
            </Button>
            <span className="text-[13px] text-ink-soft">
              {t("pagination.pageOf", { page, total: totalPages })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("pagination.next")}
            </Button>
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

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

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
