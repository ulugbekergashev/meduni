import { useCallback } from "react";
import { Outlet } from "react-router-dom";
import { BookMarked, BookOpen, GraduationCap, Home, ListChecks, Settings, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";
import { GlobalSearch, type SearchSection } from "../../components/GlobalSearch";
import { api } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { useTeachTasks } from "./api";

interface TeachSearchResp {
  students: { id: number; fullName: string; groupName: string | null }[];
  groups: { id: number; name: string; studentCount: number }[];
  courses: { id: number; name: string; semester: number }[];
}

export function TeachShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  const locale = useLocale();
  const tasks = useTeachTasks();
  const openTasks = tasks.data?.auto.length ?? 0;

  const search = useCallback(
    async (q: string): Promise<SearchSection[]> => {
      const r = await api<TeachSearchResp>(`/api/v1/teach/search?q=${encodeURIComponent(q)}`);
      return [
        {
          key: "students",
          icon: GraduationCap,
          items: r.students.map((s) => ({ key: `s${s.id}`, label: s.fullName, sub: s.groupName, link: `/teach/students/${s.id}` })),
        },
        {
          key: "groups",
          icon: Users2,
          items: r.groups.map((g) => ({ key: `g${g.id}`, label: g.name, sub: `${g.studentCount}`, link: `/teach/groups/${g.id}` })),
        },
        {
          key: "courses",
          icon: BookOpen,
          items: r.courses.map((c) => ({
            key: `c${c.id}`,
            label: c.name,
            sub: `${c.semester}-semestr`,
            link: `/teach/courses/${c.id}`,
          })),
        },
      ];
    },
    [locale]
  );

  return (
    <RoleShell
      brand="MedUni AI · Oʻqituvchi"
      headerSlot={<GlobalSearch fetch={search} />}
      profileHref="/teach/settings"
      items={[
        { href: "/teach", label: t("dashboard"), icon: <Icon icon={Home} />, end: true },
        { href: "/teach/tasks", label: t("myTasks"), icon: <Icon icon={ListChecks} />, badge: openTasks },
        { href: "/teach/subjects", label: t("subjects"), icon: <Icon icon={BookMarked} /> },
        { href: "/teach/courses", label: t("courses"), icon: <Icon icon={BookOpen} /> },
        { href: "/teach/groups", label: t("groups"), icon: <Icon icon={Users2} /> },
        { href: "/teach/settings", label: t("settings"), icon: <Icon icon={Settings} /> },
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
