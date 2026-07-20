import { useTranslation } from "react-i18next";
import { AttendanceSection } from "./AttendanceSection";

/** Davomat alohida sahifada (profil ichida ham xuddi shu bo'lim ko'rsatiladi). */
export function AttendancePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  return (
    <div>
      <h1 className="mb-4 text-h1 font-bold text-ink">{t("title")}</h1>
      <AttendanceSection />
    </div>
  );
}
