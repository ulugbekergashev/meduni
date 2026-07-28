import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "@meduni/ui";
import i18n from "./i18n";
import { ApiError, apiErrorMessage } from "./api";

// ⚠️ NEGA BU FAYL BOR (2026-07-29).
//
// Ilovada ~90 ta `useMutation` bor, lekin global xato tutuvchi YO'Q edi: har bir
// chaqiruv joyi o'zi `onError` yozishi kerak edi. Kim unutgan bo'lsa — xato
// JIMGINA yo'qolardi. Buyurtmachi buni uch marta boshqacha nom bilan aytdi:
//   · "baholashni bossam qotib qoldi"        (virtual bemor — finish mutatsiyasi)
//   · "yuklanmasdan yo'q bo'lib qolayapdi"   (material yuklash — 401)
//   · "nimaga yaratilmayapdi?"               (slayd rasmlari — 401)
// Har birini alohida tuzatish o'rniga SINFNI yopamiz: mutatsiya yiqilsa —
// foydalanuvchi doim xabar ko'radi.
//
// Chaqiruv joyi o'z xatosini O'ZI chiroyliroq ko'rsatsa (masalan modal ichida),
// takroriy toast chiqmasligi uchun `meta: { silent: true }` beradi.

/** Mutatsiya `meta` sxemasi (TS uchun — TanStack `meta` ni `Record` deb biladi). */
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}

function messageFor(error: unknown): string {
  const lang = i18n.language === "ru" ? "ru" : "uz";

  // Sessiya tugagan (refresh ham ishlamadi) — sabab aniq aytiladi.
  if (error instanceof ApiError && error.status === 401) {
    return lang === "ru" ? "Сессия истекла — войдите снова" : "Sessiya tugadi — qayta kiring";
  }
  const msg = apiErrorMessage(error, lang);
  if (msg) return msg;
  return lang === "ru" ? "Действие не выполнено. Попробуйте ещё раз." : "Amal bajarilmadi. Qayta urinib koʻring.";
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return;
      toast(messageFor(error), "warn");
    },
  }),
});
