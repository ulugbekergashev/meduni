import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TabNav } from "../../../components/TabNav";

export function StructureLayout() {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-[13.5px] text-ink-soft">{t("subtitle")}</p>

      <div className="mt-6">
        <TabNav
          items={[
            { to: "/admin/structure/faculties", label: t("tabs.faculties") },
            { to: "/admin/structure/departments", label: t("tabs.departments") },
            { to: "/admin/structure/subjects", label: t("tabs.subjects") },
            { to: "/admin/structure/groups", label: t("tabs.groups") },
          ]}
        />
      </div>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
