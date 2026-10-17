import { useTranslation } from "react-i18next";
import { cls } from "@meduni/ui";
import type { AttendanceLimit } from "../api";

/** Zona → ohang. Ogohlantiruvchi rang RAQAMDA emas, IZOHDA (dizayn qoidasi):
 *  "6 soat" — o'z-o'zidan yomon xabar emas, yomoni — "limitgacha 1 dars qoldi". */
const ZONE_TONE: Record<AttendanceLimit["zone"], { bar: string; cap: string; pill: string }> = {
  OK: { bar: "bg-emerald", cap: "text-ink-soft", pill: "" },
  WARN: { bar: "bg-amber", cap: "text-amber", pill: "bg-amber-soft text-amber" },
  DANGER: { bar: "bg-rose", cap: "text-rose", pill: "bg-rose-soft text-rose" },
  BLOCKED: { bar: "bg-rose", cap: "text-rose", pill: "bg-rose text-surface" },
};

/** Fan bo'yicha SOATLI holat: sababsiz soat / limit + qolgan soat.
 *  ⚠️ Har chiziq tagida u NIMANING ulushi ekani yozilgan (dizayn qoidasi):
 *  yolg'iz "13 %" hech narsa anglatmaydi, "sababsiz 6 / 12 soat" — anglatadi. */
export function CorridorRow({ name, limit, first }: { name: string; limit: AttendanceLimit; first: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendanceMe" });
  const tone = ZONE_TONE[limit.zone];
  const known = limit.limitHours > 0;
  const fill = known ? Math.min(100, Math.round((limit.unexcusedHours / limit.limitHours) * 100)) : 0;
  return (
    <div className={cls("flex items-start gap-3 px-2 py-2.5", !first && "border-t border-line-soft")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-note font-semibold text-ink">{name}</p>
        {/* 0 % da chiziq CHIZILMAYDI — ingichka qoldiq "biroz bor" deb o'qiladi. */}
        {known && fill > 0 && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-line">
            <div className={cls("h-full rounded-pill", tone.bar)} style={{ width: `${fill}%` }} />
          </div>
        )}
        <p className={cls("mt-1 text-micro tabular-nums", tone.cap)}>
          {known ? t("unexcusedOf", { h: limit.unexcusedHours, limit: limit.limitHours }) : t("noPlannedHours")}
        </p>
      </div>
      {known && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {limit.zone !== "OK" && (
            <span className={cls("rounded-pill px-2 py-0.5 text-micro font-semibold", tone.pill)}>{t(`zone${limit.zone}`)}</span>
          )}
          <span className="text-micro tabular-nums text-ink-soft">{t("remainingHours", { n: limit.remainingHours })}</span>
        </div>
      )}
    </div>
  );
}

const MONTHS_UZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const MONTHS_RU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

/** Dars vaqti "HH:MM" — sessiya/dars sanasidan (bir kunda bir necha dars bo'lishi mumkin). */
export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "2026-07" → "Iyul 2026" (uz ICU oy nomlari buzuq — qo'lda). */
export function monthLabel(key: string, locale: string) {
  const [y, m] = key.split("-");
  const names = locale === "ru" ? MONTHS_RU : MONTHS_UZ;
  const name = names[Number(m) - 1] ?? key;
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}
