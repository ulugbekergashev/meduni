import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import uz from "../messages/uz.json";
import ru from "../messages/ru.json";

export type Locale = "uz" | "ru";

const stored = typeof window !== "undefined" ? window.localStorage.getItem("locale") : null;
const initialLng: Locale = stored === "ru" || stored === "uz" ? stored : "uz";

i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
  },
  lng: initialLng,
  fallbackLng: "uz",
  interpolation: { escapeValue: false },
});

export function setLocale(locale: Locale) {
  i18n.changeLanguage(locale);
  window.localStorage.setItem("locale", locale);
  document.documentElement.lang = locale;
}

export default i18n;
