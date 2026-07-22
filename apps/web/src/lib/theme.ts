export type Theme = "light" | "dark";

const KEY = "meduni-theme";

/** Saved preference, or the OS preference if none was saved yet. */
export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Stamp the theme onto <html> so the CSS variables switch. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Persist + apply. */
export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

/** Vaqtincha majburlash (saqlamasdan) — talaba tomoni faqat qorong'i ishlaydi.
 *  Foydalanuvchi tanlovi localStorage'da tegilmay qoladi. */
export function forceTheme(theme: Theme) {
  applyTheme(theme);
}

/** Majburlashdan keyin foydalanuvchi tanloviga qaytish. */
export function restoreTheme() {
  applyTheme(getTheme());
}
