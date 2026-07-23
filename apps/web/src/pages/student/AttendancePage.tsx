import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarCheck, CalendarDays } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { AttendanceSection } from "./AttendanceSection";
import { SchedulePage } from "./SchedulePage";

/** Davomat + Dars jadvali bitta modulda (buyurtmachi qarori: "jadval o'rniga
 *  davomat bor, davomatda jadval qo'ysa bo'ladi"). Ikki tab, ?sub= bilan. */
export function AttendancePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const [params, setParams] = useSearchParams();
  const sub = params.get("sub") === "jadval" ? "jadval" : "davomat";

  const tabs = [
    { key: "davomat", label: t("tabAttendance"), icon: CalendarCheck },
    { key: "jadval", label: t("tabSchedule"), icon: CalendarDays },
  ] as const;

  return (
    <div>
      <h1 className="mb-3 text-h1 font-bold text-ink">{t("title")}</h1>

      {/* Segmented tab — dizayn tizimi uslubi (bordered track, faol = brand chip) */}
      <div className="mb-4 inline-flex gap-1 rounded-control border border-line bg-surface p-1">
        {tabs.map((tab) => {
          const on = sub === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setParams(tab.key === "davomat" ? {} : { sub: tab.key }, { replace: true })}
              className={cls(
                "inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                on ? "bg-brand-soft text-brand-tint" : "text-ink-soft hover:bg-surface-raised hover:text-ink"
              )}
            >
              <Icon icon={tab.icon} size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {sub === "jadval" ? <SchedulePage /> : <AttendanceSection />}
    </div>
  );
}
