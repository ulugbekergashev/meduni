import { useCallback } from "react";
import { Outlet } from "react-router-dom";
import { BookOpen, GraduationCap, Home, ListChecks, Network, Palette, ScrollText, Settings, Sparkles, UserRound, Users, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";
import { GlobalSearch, type SearchSection } from "../../components/GlobalSearch";
import { api } from "../../lib/api";
import { pickName, useLocale } from "../../lib/useLocale";

interface AdminSearchResp {
  students: { id: number; fullName: string; groupName: string | null }[];
  teachers: { id: number; fullName: string; departmentUz: string | null; departmentRu: string | null }[];
  groups: { id: number; name: string; studentCount: number }[];
  courses: { id: number; nameUz: string; nameRu: string; semester: number }[];
}

export function AdminShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  const locale = useLocale();

  const search = useCallback(
    async (q: string): Promise<SearchSection[]> => {
      const r = await api<AdminSearchResp>(`/api/v1/admin/search?q=${encodeURIComponent(q)}`);
      return [
        {
          key: "students",
          icon: GraduationCap,
          items: r.students.map((s) => ({ key: `s${s.id}`, label: s.fullName, sub: s.groupName, link: `/admin/users/${s.id}` })),
        },
        {
          key: "teachers",
          icon: UserRound,
          items: r.teachers.map((tt) => ({
            key: `t${tt.id}`,
            label: tt.fullName,
            sub: tt.departmentUz ? pickName(locale, tt.departmentUz, tt.departmentRu ?? tt.departmentUz) : null,
            link: `/admin/users/${tt.id}`,
          })),
        },
        {
          key: "groups",
          icon: Users2,
          items: r.groups.map((g) => ({ key: `g${g.id}`, label: g.name, sub: `${g.studentCount}`, link: `/admin/structure/groups` })),
        },
        {
          key: "courses",
          icon: BookOpen,
          items: r.courses.map((c) => ({
            key: `c${c.id}`,
            label: pickName(locale, c.nameUz, c.nameRu),
            sub: `${c.semester}-semestr`,
            link: `/admin/courses/${c.id}`,
          })),
        },
      ];
    },
    [locale]
  );

  return (
    <RoleShell
      brand="MedUni AI · Admin"
      headerSlot={<GlobalSearch fetch={search} />}
      items={[
        { href: "/admin", label: t("dashboard"), icon: <Icon icon={Home} />, end: true },
        { href: "/admin/structure", label: t("structure"), icon: <Icon icon={Network} /> },
        { href: "/admin/users", label: t("users"), icon: <Icon icon={Users} /> },
        { href: "/admin/courses", label: t("courses"), icon: <Icon icon={BookOpen} /> },
        { href: "/admin/tasks", label: t("tasks"), icon: <Icon icon={ListChecks} /> },
        { href: "/admin/templates", label: t("templates"), icon: <Icon icon={Palette} /> },
        { href: "/admin/ai", label: t("ai"), icon: <Icon icon={Sparkles} /> },
        { href: "/admin/audit", label: t("audit"), icon: <Icon icon={ScrollText} /> },
        { href: "/admin/settings", label: t("settings"), icon: <Icon icon={Settings} /> },
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
