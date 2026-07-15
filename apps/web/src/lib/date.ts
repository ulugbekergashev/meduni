// Date formatting helper. Node/browser ICU renders uz-UZ month names as "M07",
// so Uzbek month names are spelled out manually; Russian uses the native locale.

const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

type Locale = "uz" | "ru";
type Style = "long" | "short" | "shortYear";

/**
 * formatDate("uz", d, "long")      → "15-iyul, 2026-yil"
 * formatDate("ru", d, "long")      → "15 июля 2026 г."
 * formatDate("uz", d, "short")     → "15-iyul"
 * formatDate("uz", d, "shortYear") → "15-iyul, 2026"
 */
export function formatDate(locale: Locale, date: Date | string | number, style: Style = "long"): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  if (locale === "ru") {
    const opts: Intl.DateTimeFormatOptions =
      style === "long"
        ? { day: "numeric", month: "long", year: "numeric" }
        : style === "shortYear"
          ? { day: "2-digit", month: "short", year: "numeric" }
          : { day: "2-digit", month: "short" };
    return d.toLocaleDateString("ru-RU", opts);
  }

  const day = d.getDate();
  const month = UZ_MONTHS[d.getMonth()];
  if (style === "short") return `${day}-${month}`;
  if (style === "shortYear") return `${day}-${month}, ${d.getFullYear()}`;
  return `${day}-${month}, ${d.getFullYear()}-yil`;
}
