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

// Dev: tarjima JSON o'zgarganda i18next resurslarini yangilaydi. Busiz HMR
// modulni almashtiradi-yu, i18next init paytidagi eski nusxada qolib ketadi va
// ekranda xom kalitlar ("lesson.stage_quiz") chiqadi.
if (import.meta.hot) {
  import.meta.hot.accept(["../messages/uz.json", "../messages/ru.json"], ([nextUz, nextRu]) => {
    if (nextUz) i18n.addResourceBundle("uz", "translation", nextUz.default, true, true);
    if (nextRu) i18n.addResourceBundle("ru", "translation", nextRu.default, true, true);
    i18n.changeLanguage(i18n.language);
  });
}

export default i18n;
