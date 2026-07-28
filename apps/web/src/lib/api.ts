export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
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

export function apiErrorMessage(err: unknown, locale: "uz" | "ru"): string | null {
  if (err instanceof ApiError) return locale === "ru" ? err.messageRu : err.messageUz;
  return null;
}
