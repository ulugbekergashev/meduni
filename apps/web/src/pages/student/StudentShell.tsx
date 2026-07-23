import { useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Award, BookOpen, CalendarCheck, FileText, Home, ListChecks, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon } from "@meduni/ui";
import { RoleShell } from "../../components/RoleShell";
import { GlobalSearch, type SearchSection } from "../../components/GlobalSearch";
import { api } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { useMyTasks } from "./api";

interface StudentSearchResp {
  courses: { id: number; name: string; semester: number }[];
  topics: { id: number; title: string; courseName: string }[];
}

export function StudentShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  const locale = useLocale();
  const tasks = useMyTasks();
  const openTasks = tasks.data?.auto.length ?? 0;
  // Ishchi panel (to'liq ekran, panel ichida skroll): dars sahifasi.
  const { pathname } = useLocation();
  const isWorkspace = /^\/app\/topics\/\d+/.test(pathname);

  // 2026-07-23 (buyurtmachi): majburiy qora tema BEKOR — tibbiyot platformasiga
  // tinch yorug' palitra mos; Dark Mode talabnoma bo'yicha OPTSIYA sifatida
  // headerdagi tugma orqali qoladi.

  const search = useCallback(
    async (q: string): Promise<SearchSection[]> => {
      const r = await api<StudentSearchResp>(`/api/v1/me/search?q=${encodeURIComponent(q)}`);
      return [
        {
          key: "courses",
          icon: BookOpen,
          items: r.courses.map((c) => ({
            key: `c${c.id}`,
            label: c.name,
            sub: `${c.semester}-semestr`,
            link: `/app/courses/${c.id}`,
          })),
        },
        {
          key: "topics",
          icon: FileText,
          items: r.topics.map((tp) => ({
            key: `t${tp.id}`,
            label: tp.title,
            sub: tp.courseName,
            link: `/app/topics/${tp.id}`,
          })),
        },
      ];
    },
    [locale]
  );

  return (
    <RoleShell
      brand="MedUni AI"
      headerSlot={<GlobalSearch fetch={search} />}
      profileHref="/app/profile"
      fullBleed={isWorkspace}
      items={[
        { href: "/app", label: t("dashboard"), icon: <Icon icon={Home} />, end: true },
        { href: "/app/courses", label: t("myCourses"), icon: <Icon icon={BookOpen} />, end: true },
        { href: "/app/tasks", label: t("tasks"), icon: <Icon icon={ListChecks} />, badge: openTasks },
        { href: "/app/grades", label: t("grades"), icon: <Icon icon={Award} /> },
        { href: "/app/attendance", label: t("attendance"), icon: <Icon icon={CalendarCheck} /> },
        { href: "/app/profile", label: t("profile"), icon: <Icon icon={User} /> },
      ]}
    >
      <Outlet />
    </RoleShell>
  );
}
