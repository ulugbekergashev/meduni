import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { aadForDepartment, decryptKey } from "./keyVault";

/**
 * Gemini kalitini aniqlash.
 *
 *  1. Kafedraning O'Z kaliti — bor va o'qilsa, FAQAT shu ishlatiladi.
 *  2. Kafedra qatori YO'Q → (bor bo'lsa) serverning umumiy `GEMINI_API_KEY` i
 *     (ZAXIRA; uni qo'yish — universitetning ongli qarori).
 *  3. Hech biri yo'q → `null` (chaqiruvchi `AI_KEY_MISSING` tashlaydi).
 *
 * ⚠️ Kafedra kaliti BOR, lekin O'QILMASA (sir almashgan / yozuv buzilgan) —
 * umumiy kalitga JIMGINA o'tilmaydi: `ai_key_unreadable` tashlanadi. Aks holda
 * barcha kafedralar bildirmasdan universitet hisobidan ishlay boshlardi.
 */
export interface ResolvedKey {
  key: string;
  source: "department" | "platform";
}

type DeptKey = { state: "ok"; key: string } | { state: "none" } | { state: "unreadable" };

const TTL_MS = 60_000;
const cache = new Map<number, { v: DeptKey; exp: number }>();

/** Kalit o'zgargan/o'chirilganda keshni darrov tozalaydi (jarayon ichida). */
export function invalidateDepartmentKey(departmentId: number): void {
  cache.delete(departmentId);
}

async function departmentKey(departmentId: number): Promise<DeptKey> {
  const hit = cache.get(departmentId);
  if (hit && hit.exp > Date.now()) return hit.v;
  let v: DeptKey = { state: "none" };
  const row = await prisma.departmentAiKey.findUnique({ where: { departmentId }, select: { keyEnc: true } });
  if (row) {
    try {
      v = { state: "ok", key: decryptKey(row.keyEnc, aadForDepartment(departmentId)) };
    } catch (err) {
      console.warn(`[ai-key] kafedra ${departmentId} kaliti o'qilmadi:`, (err as Error).message);
      v = { state: "unreadable" };
    }
  }
  cache.set(departmentId, { v, exp: Date.now() + TTL_MS });
  return v;
}

export const AI_KEY_MISSING = () =>
  new ApiError(
    409,
    "ai_key_missing",
    "Bu kafedra uchun Gemini API kaliti kiritilmagan. Kafedra mudiri kalitni Kafedra sahifasida kiritishi kerak.",
    "Для этой кафедры не добавлен ключ Gemini API. Заведующий кафедрой должен добавить ключ на странице кафедры."
  );

export const AI_KEY_UNREADABLE = () =>
  new ApiError(
    409,
    "ai_key_unreadable",
    "Kafedraning saqlangan Gemini kaliti oʻqilmadi. Kafedra mudiri kalitni qayta kiritishi kerak.",
    "Сохранённый ключ Gemini кафедры не удалось прочитать. Заведующему кафедрой нужно ввести ключ заново."
  );

/** Provayder zanjirida davom ETILMAYDIGAN kalit xatolari: kafedra kaliti buzuq/o'qilmaydi.
 *  Zanjir keyingi provayderga (uchinchi tomon yoki platforma hisobi) o'tib ketmasin. */
export function isKeyFatal(err: unknown): boolean {
  return err instanceof ApiError && (err.code === "ai_key_error" || err.code === "ai_key_unreadable");
}

export async function resolveGeminiKey(departmentId?: number | null): Promise<ResolvedKey | null> {
  if (departmentId) {
    const own = await departmentKey(departmentId);
    if (own.state === "ok") return { key: own.key, source: "department" };
    if (own.state === "unreadable") throw AI_KEY_UNREADABLE();
  }
  const platform = process.env.GEMINI_API_KEY;
  return platform ? { key: platform, source: "platform" } : null;
}

// ---- Gemini mijoz keshi (kalit bo'yicha) -----------------------------------

const MAX_CLIENTS = 50;
const clients = new Map<string, GoogleGenAI>();

export function clientFor(key: string): GoogleGenAI {
  const id = crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
  let c = clients.get(id);
  if (!c) {
    if (clients.size >= MAX_CLIENTS) clients.delete(clients.keys().next().value as string);
    c = new GoogleGenAI({ apiKey: key });
    clients.set(id, c);
  }
  return c;
}

// ---- Kalitni tekshirish ------------------------------------------------------

export type KeyCheck = { ok: true } | { ok: false; reason: "invalid" | "unreachable"; detail: string };

const VERIFY_TIMEOUT_MS = 15_000;

/** Kalitni Google'da TEKSHIRADI (modellar ro'yxati — kvota/pul sarflamaydi).
 *  Haqiqiy HTTP timeout bilan: osilgan ulanishlar to'planib qolmasin. */
export async function verifyGeminiKey(key: string): Promise<KeyCheck> {
  try {
    const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: VERIFY_TIMEOUT_MS } });
    await ai.models.list({ config: { pageSize: 1 } });
    return { ok: true };
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? err);
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403 || (status === 400 && /API key|API_KEY/i.test(msg)) || /permission|unauthenticated/i.test(msg)) {
      return { ok: false, reason: "invalid", detail: "Google kalitni qabul qilmadi" };
    }
    return { ok: false, reason: "unreachable", detail: "Google bilan aloqa oʻrnatilmadi" };
  }
}
