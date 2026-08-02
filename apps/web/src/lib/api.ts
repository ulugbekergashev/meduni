const CONFIGURED_API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Vercel'da chiqarilgan saytda so'rovlar O'Z domeniga (nisbiy yo'l bilan)
 * yuboriladi — `vercel.json` dagi rewrite ularni API'ga uzatadi.
 *
 * ⚠️ NEGA: ba'zi provayderlar (jumladan buyurtmachining tarmog'i) Render
 * domeniga HTTPS ulanishini to'sadi — TCP ochiladi, TLS esa uziladi. Natijada
 * sayt ochiladi, lekin login/ma'lumot so'rovlari "osilib" qoladi. Brauzer
 * faqat Vercel bilan gaplashsa, bu to'siq umuman ta'sir qilmaydi. Qo'shimcha
 * foyda: cookie'lar cross-site bo'lmaydi (bir xil origin).
 *
 * Mahalliy dev va boshqa muhitlarda odatdagi VITE_API_URL ishlatiladi.
 */
function resolveApiUrl(): string {
  if (typeof window !== "undefined" && /(^|\.)vercel\.app$/i.test(window.location.hostname)) return "";
  return CONFIGURED_API_URL;
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  status: number;
  code: string;
  messageUz: string;
  messageRu: string;

  constructor(status: number, code: string, messageUz: string, messageRu: string) {
    super(messageUz);
    this.status = status;
    this.code = code;
    this.messageUz = messageUz;
    this.messageRu = messageRu;
  }
}

/** Bir vaqtda kelgan bir necha 401 uchun /auth/refresh BIR marta chaqiriladi. */
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        // Keyingi 401 yangi refreshni boshlashi uchun bo'shatamiz.
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

/**
 * Cookie bilan so'rov + 401 bo'lsa sessiyani yangilab BIR marta qayta urinish.
 *
 * ⚠️ NEGA KERAK: access token atigi **15 daqiqa** yashaydi (`ACCESS_TTL`),
 * refresh token esa 30 kun. Ilgari frontend `/auth/refresh` ni HECH QACHON
 * chaqirmasdi — ya'ni 15 daqiqadan keyin ilova ochiq turgani bilan HAR QANDAY
 * so'rov 401 qaytarardi, foydalanuvchi esa buni "tugma ishlamayapti" deb
 * ko'rardi (fayl yuklash, saqlash — hammasi jimgina yiqilardi).
 */
export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const send = () => fetch(url, { ...init, credentials: "include" });
  const res = await send();
  if (res.status !== 401 || url.includes("/auth/")) return res;
  const ok = await refreshSession();
  return ok ? send() : res;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await authedFetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    // ⚠️ Tarmoq/serverga umuman yetib bormadi (uxlab qolgan server, deploy,
    // uzilgan internet). Buni ANIQ xato sifatida qaytaramiz — aks holda
    // chaqiruvchi uni "parol noto'g'ri" kabi noto'g'ri talqin qiladi.
    throw new ApiError(
      0,
      "network_error",
      "Server javob bermayapti. Bir necha soniyadan keyin qayta urining.",
      "Сервер не отвечает. Повторите через несколько секунд."
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.error;
    // ⚠️ 502/503/504 — bu ILOVA xatosi EMAS, server ko'tarilmagan/uyquda
    // (Render Free 15 daqiqadan keyin uxlaydi va sovuq start 30-60s oladi).
    // Bunday javobda JSON ham bo'lmaydi (proxy HTML qaytaradi), shuning uchun
    // ilgari ekranda mavhum "Xatolik yuz berdi" chiqardi va foydalanuvchi
    // parolini qidirib ovora bo'lardi (2026-08-02 da aynan shunday bo'ldi).
    if (!detail && (res.status === 502 || res.status === 503 || res.status === 504)) {
      throw new ApiError(
        res.status,
        "server_unavailable",
        "Server hozir javob bermayapti (uyquda yoki yangilanmoqda). 1-2 daqiqadan keyin qayta urining.",
        "Сервер сейчас не отвечает (спит или обновляется). Повторите через 1–2 минуты."
      );
    }
    throw new ApiError(
      res.status,
      detail?.code ?? "unknown_error",
      detail?.messageUz ?? "Xatolik yuz berdi",
      detail?.messageRu ?? "Произошла ошибка"
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Fayl yuklash (multipart). `api()` bilan bir xil: refresh-retry + tushunarli
 *  xato. Content-Type QO'YILMAYDI — brauzer boundary bilan o'zi qo'yadi. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await authedFetch(`${API_URL}${path}`, { method: "POST", body: form });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Server javob bermayapti. Bir necha soniyadan keyin qayta urining.",
      "Сервер не отвечает. Повторите через несколько секунд."
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.error;
    throw new ApiError(
      res.status,
      detail?.code ?? (res.status === 401 ? "unauthorized" : "upload_failed"),
      detail?.messageUz ?? (res.status === 401 ? "Sessiya tugagan — qayta kiring" : "Faylni yuklab boʻlmadi"),
      detail?.messageRu ?? (res.status === 401 ? "Сессия истекла — войдите снова" : "Не удалось загрузить файл")
    );
  }
  return res.json();
}

export function apiErrorMessage(err: unknown, locale: "uz" | "ru"): string | null {
  if (err instanceof ApiError) return locale === "ru" ? err.messageRu : err.messageUz;
  return null;
}
