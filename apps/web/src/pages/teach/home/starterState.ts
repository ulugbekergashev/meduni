/**
 * "3 qadam" boshlash kartasining o'chirilgan holati.
 *
 * Kalit foydalanuvchi bo'yicha — umumiy demo brauzerda bir o'qituvchi kartani
 * yopsa, keyingisidan yashirilmasin (loyihadagi mavjud naqsh: `lib/theme.ts`).
 */
const KEY = (userId: number) => `meduni.teachStart.${userId}`;

/** Joriy foydalanuvchi ID'si — reset paytida ma'lum bo'lmasligi mumkin. */
let lastUserId: number | null = null;

export function isStarterDismissed(userId: number | undefined): boolean {
  if (userId === undefined) return false;
  lastUserId = userId;
  try {
    return localStorage.getItem(KEY(userId)) === "1";
  } catch {
    return false;
  }
}

export function dismissStarter(userId: number | undefined): void {
  if (userId === undefined) return;
  try {
    localStorage.setItem(KEY(userId), "1");
  } catch {
    /* private rejim — karta shu sessiyada yopiladi, keyin qaytadi */
  }
}

/** Yon paneldagi "Boshlash qo'llanmasi" — kartani qayta ko'rsatadi. */
export function resetStarter(): void {
  try {
    if (lastUserId !== null) localStorage.removeItem(KEY(lastUserId));
    // Foydalanuvchi ID'si hali o'qilmagan bo'lsa — barcha teachStart kalitlarini tozalaymiz.
    else {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith("meduni.teachStart.")) localStorage.removeItem(k);
      }
    }
  } catch {
    /* localStorage yo'q */
  }
}
