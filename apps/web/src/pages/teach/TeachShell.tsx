import { useCallback } from "react";
import { Outlet } from "react-router-dom";
import { BookOpen, GraduationCap, Home, Settings, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";
import { GlobalSearch, type SearchSection } from "../../components/GlobalSearch";
import { api } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { useTaskBoard } from "./api";

interface TeachSearchResp {
  students: { id: number; fullName: string; groupName: string | null }[];
  groups: { id: number; name: string; studentCount: number }[];
  courses: { id: number; name: string; semester: number }[];
}

export function TeachShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  // Mobil tab-bar uchun qisqa yorliqlar (uzun nom 78px katakka sig'maydi).
  const { t: ts } = useTranslation(undefined, { keyPrefix: "navShort" });
  const locale = useLocale();
  const tasks = useTaskBoard();
  const openTasks = tasks.data?.stats.toDo ?? 0;

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
      // ⚠️ 4 element + BottomNav sukut `primaryCount=4` = "Yana" tugmasi
      // chizilmaydi va Chiqish mobilda yo'qoladi. 3 ta tab + Yana.
      primaryCount={3}
      items={[
        {
          href: "/teach",
          label: t("dashboard"),
          shortLabel: ts("dashboard"),
          icon: <Icon icon={Home} />,
          end: true,
          // Vazifalar va Darslarim endi bosh sahifaning BLOKLARI (tab yo'q);
          // eski manzillar shu sahifaga ?focus= bilan yo'naltiriladi.
          alsoActiveOn: ["/teach/tasks", "/teach/schedule"],
          badge: openTasks,
        },
        { href: "/teach/courses", label: t("courses"), shortLabel: ts("courses"), icon: <Icon icon={BookOpen} /> },
        { href: "/teach/groups", label: t("groups"), shortLabel: ts("groups"), icon: <Icon icon={Users2} /> },
        { href: "/teach/settings", label: t("settings"), shortLabel: ts("settings"), icon: <Icon icon={Settings} /> },
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
