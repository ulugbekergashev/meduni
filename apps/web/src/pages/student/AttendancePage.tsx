import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarCheck, CalendarDays } from "lucide-react";
import { Icon } from "@meduni/ui";
import { SubNav } from "../../components/SubNav";
import { AttendanceSection } from "./AttendanceSection";
import { SchedulePage } from "./SchedulePage";

/** Davomat + Dars jadvali bitta modulda (buyurtmachi qarori: "jadval o'rniga
 *  davomat bor, davomatda jadval qo'ysa bo'ladi").
 *  Bo'limlar yon paneldagi ikkinchi darajada (mobilda — segmented tasma). */
export function AttendancePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const [params] = useSearchParams();
  const sub = params.get("sub") === "jadval" ? "jadval" : "davomat";

  return (
    <div>
      <h1 className="mb-3 text-h1 font-bold text-ink">{t("title")}</h1>

      <SubNav
        title={t("title")}
        activeKey={sub}
        items={[
          { key: "davomat", label: t("tabAttendance"), to: "/app/attendance", icon: <Icon icon={CalendarCheck} size={16} /> },
          { key: "jadval", label: t("tabSchedule"), to: "/app/attendance?sub=jadval", icon: <Icon icon={CalendarDays} size={16} /> },
        ]}
      />

      {sub === "jadval" ? <SchedulePage /> : <AttendanceSection />}
    </div>
  );
}
