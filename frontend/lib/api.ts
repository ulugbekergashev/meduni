"use client";

const BASE = "/api/v1";

export function getAccessToken() {
  return typeof window === "undefined" ? null : localStorage.getItem("access_token");
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

async function tryRefresh(): Promise<boolean> {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; formData?: FormData } = {},
): Promise<T> {
  const doFetch = () => {
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!options.formData) headers["Content-Type"] = "application/json";
    return fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  };

  let res = await doFetch();
  if (res.status === 401 && !path.startsWith("/auth/") && (await tryRefresh())) {
    res = await doFetch();
  }
  if (res.status === 401 && !path.startsWith("/auth/")) {
    clearTokens();
    window.location.href = "/login";
  }
  if (!res.ok) {
    let code = "unknown";
    let message = `HTTP ${res.status}`;
    try {
      const detail = (await res.json()).detail;
      if (detail?.code) {
        code = detail.code;
        const locale = document.cookie.includes("locale=ru") ? "ru" : "uz";
        message = detail[`message_${locale}`] ?? detail.message_ru;
      }
    } catch {
      /* тело не JSON — оставляем HTTP-код */
    }
    throw new ApiError(code, message);
  }
  return res.json();
}
