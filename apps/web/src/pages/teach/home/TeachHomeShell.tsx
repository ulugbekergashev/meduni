import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, Home, LifeBuoy, ListChecks } from "lucide-react";
import { Icon } from "@meduni/ui";
import { SubNav } from "../../../components/SubNav";
import { useTaskBoard } from "../api";
import { resetStarter } from "./starterState";

/**
 * Bosh sahifa BO'LIMI — "Bugun" · "Vazifalar" · "Darslarim".
 *
 * Nega yo'lsiz (pathless) layout route, sahifa-bo'yicha `SubNav` emas:
 * `SubNav` mount'da `set(data)`, unmount'da `set(null)` qiladi — uchta aka-uka
 * sahifa bo'lganda 248px panel har almashishda qayta mount bo'lib sakraydi va
 * bir xil massiv uch joyda takrorlanardi. Qobiq esa uchalasida ham mount bo'lib
 * turadi.
 *
 * URL'lar O'ZGARMAYDI (`/teach/tasks`, `/teach/schedule`) — backend'dagi
 * deep-linklar (`tasks/service.ts` `attendance_unmarked` → `/teach/schedule`)
 * va eski xatcho'plar ishlayveradi.
 */
export function TeachHomeShell() {
  const { t } = useTranslation(undefined, { keyPrefix: "nav" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "teach" });
  const { pathname } = useLocation();
  const tasks = useTaskBoard();
  const openTasks = tasks.data?.stats.toDo ?? 0;

  const activeKey = pathname.startsWith("/teach/tasks")
    ? "tasks"
    : pathname.startsWith("/teach/schedule")
      ? "schedule"
      : "today";

  return (
    <>
      <SubNav
        // Bosh sahifada atigi 3 bo'lim — ular uchun 248px ustun ochish ortiqcha
        // edi (buyurtmachi). Kurs/guruh sahifalarida panel qoladi.
        variant="tabs"
        title={t("dashboard")}
        activeKey={activeKey}
        items={[
          { key: "today", label: tt("navToday"), to: "/teach", icon: <Icon icon={Home} size={16} /> },
          {
            key: "tasks",
            label: t("myTasks"),
            to: "/teach/tasks",
            icon: <Icon icon={ListChecks} size={16} />,
            badge: openTasks,
          },
          { key: "schedule", label: t("lessons"), to: "/teach/schedule", icon: <Icon icon={CalendarDays} size={16} /> },
        ]}
        footer={
          <button
            onClick={() => {
              resetStarter();
              // Bosh sahifa kartani qayta ko'rsatishi uchun to'liq qayta yuklash
              // (holat localStorage'da, React state'da emas).
              window.location.assign("/teach");
            }}
            className="mb-3 inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-note font-semibold text-ink-faint transition-colors hover:bg-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={LifeBuoy} size={15} />
            {tt("startGuide")}
          </button>
        }
      />
      <Outlet />
    </>
  );
}
