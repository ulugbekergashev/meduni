import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, Landmark, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { Button, EmptyState, Icon, Spinner } from "@meduni/ui";
import { BentoCard, BentoRow, PageHeader, RetryLine } from "../../../components/bento";
import { api, apiErrorMessage } from "../../../lib/api";
import { useMe } from "../../../lib/auth";
import { useLocale } from "../../../lib/useLocale";
import { Avatar } from "../../../components/Avatar";
import { PasswordModal } from "../users/PasswordModal";
import { EntityFormModal, useStructureTree } from "./shared";

interface SuperRow { id: number; fullName: string; email: string }

/** Structure hub: one spacious card per faculty — click to drill in. */
export function StructurePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: ts } = useTranslation(undefined, { keyPrefix: "staff" });
  const navigate = useNavigate();
  const locale = useLocale();
  const { data: me } = useMe();
  const tree = useStructureTree();
  const [adding, setAdding] = useState(false);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);

  const canFaculty = me?.role === "superadmin";
  const faculties = tree.data ?? [];

  // The hub is the SUPERADMIN's university view. Lower tiers land straight on
  // their own unit — a faculty admin's world IS their faculty, a dept admin's
  // world IS their kafedra; showing them the hub was wrong.
  useEffect(() => {
    if (!me || !tree.data || me.role === "superadmin") return;
    if (me.role === "faculty_admin" && tree.data[0]) {
      navigate(`/admin/staff/f/${tree.data[0].id}`, { replace: true });
    }
    if (me.role === "dept_admin" && tree.data[0]?.departments[0]) {
      navigate(`/admin/staff/d/${tree.data[0].departments[0].id}`, { replace: true });
    }
  }, [me, tree.data, navigate]);

  const supers = useQuery({
    queryKey: ["staff-supers"],
    queryFn: () => api<{ items: SuperRow[] }>("/api/v1/users?role=SUPERADMIN&page=1"),
    enabled: canFaculty,
  });

  if (me && me.role !== "superadmin") {
    // Pastki daraja o'z birligiga yo'naltiriladi (yuqoridagi effekt). Lekin birlik
    // biriktirilmagan bo'lsa server 403 ("Kafedra biriktirilmagan") qaytaradi yoki
    // daraxt bo'sh keladi — ilgari bu holatda spinner ABADIY aylanardi.
    const noUnit =
      !!tree.data && (me.role === "faculty_admin" ? !tree.data[0] : !tree.data[0]?.departments[0]);
    if (tree.isError || noUnit) {
      return (
        <EmptyState
          icon={<Icon icon={Landmark} size={24} />}
          text={(tree.isError && apiErrorMessage(tree.error, locale)) || ts("noUnitAssigned")}
          hint={ts("noUnitAssignedHint")}
        />
      );
    }
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;
  }

  const totals = faculties.reduce(
    (acc, f) => ({
      depts: acc.depts + f.departments.length,
      groups: acc.groups + f.groups.length,
      students: acc.students + f.groups.reduce((s, g) => s + g.studentCount, 0),
    }),
    { depts: 0, groups: 0, students: 0 }
  );
  const leaders = supers.data?.items ?? [];

  return (
    <div className="space-y-3">
      <PageHeader
        className="mb-0"
        title={t("title")}
        subtitle={
          faculties.length > 0
            ? [t("nDepts", { n: totals.depts }), t("nGroups", { n: totals.groups }), t("nStudents", { n: totals.students })].join(" · ")
            : t("subtitle")
        }
        right={
          canFaculty && (
            <Button size="lg" icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding(true)}>
              {t("add.faculty")}
            </Button>
          )
        }
      />

      {/* Leadership (university-level admins) */}
      {canFaculty && leaders.length > 0 && (
        <BentoCard
          title={
            <span className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-tint">
                <Icon icon={ShieldCheck} size={15} />
              </span>
              {ts("leadership")}
            </span>
          }
          count={leaders.length}
          bodyClassName="px-2 pb-3"
        >
          <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
            {leaders.map((u) => (
              <li key={u.id}>
                <BentoRow
                  lead={<Avatar name={u.fullName} />}
                  title={u.fullName}
                  sub={u.email}
                  onClick={() => navigate(`/admin/users/${u.id}`)}
                />
              </li>
            ))}
          </ul>
        </BentoCard>
      )}

      {tree.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={26} /></div>
      ) : tree.isError ? (
        <BentoCard>
          <RetryLine onRetry={() => tree.refetch()} />
        </BentoCard>
      ) : faculties.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Building2} size={24} />}
          text={t("emptyFaculties")}
          hint={t("emptyFacultiesHint")}
          action={canFaculty ? <Button size="sm" onClick={() => setAdding(true)}>{t("add.faculty")}</Button> : undefined}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {faculties.map((f) => {
            const teacherCount = f.departments.reduce((s, d) => s + d.teacherCount, 0);
            const studentCount = f.groups.reduce((s, g) => s + g.studentCount, 0);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/staff/f/${f.id}`)}
                  className="group flex h-full w-full flex-col gap-4 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-line-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-tint">
                      <Icon icon={Building2} size={18} />
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface">
                      <Icon icon={ArrowRight} size={13} />
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 block text-section font-semibold leading-snug text-ink">{f.name}</span>
                    {f.admins[0] && (
                      <span className="mt-1 flex items-center gap-1.5 truncate text-note text-ink-soft">
                        <Icon icon={UserRound} size={13} className="shrink-0" />
                        {f.admins[0].fullName}
                      </span>
                    )}
                  </span>
                  <span className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line pt-3 text-note text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon icon={Landmark} size={14} className="text-amber" /> {t("nDepts", { n: f.departments.length })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon icon={Users} size={14} className="text-violet" /> {t("nGroups", { n: f.groups.length })}
                    </span>
                    <span>{t("nTeachers", { n: teacherCount })}</span>
                    <span>{t("nStudents", { n: studentCount })}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <EntityFormModal
          kind="faculty"
          onClose={(pw) => {
            setAdding(false);
            if (pw) setRevealPassword(pw);
          }}
        />
      )}
      <PasswordModal password={revealPassword} onClose={() => setRevealPassword(null)} />
    </div>
  );
}
