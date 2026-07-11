import { useTranslation } from "react-i18next";

export type Locale = "uz" | "ru";

export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return i18n.language === "ru" ? "ru" : "uz";
}

/** Pick the correct bilingual field from a record based on current locale. */
export function pickName(locale: Locale, nameUz: string, nameRu: string): string {
  return locale === "ru" ? nameRu : nameUz;
}
