// Vaqt/sana yordamchilari — BUTUN loyiha uchun BITTA joy.
//
// ⚠️ NEGA KERAK (2026-09-08 auditi): sana hisobi uch xil konvensiyada yozilgan edi —
// (a) mahalliy (timetable), (b) sof UTC (me/service scheduleUnlock), (c) ARALASH:
// `new Date("2026-09-08")` UTC yarim tunni beradi, `end.setHours(23,59,59)` esa
// MAHALLIY kun oxirini. UTC+5 da (Toshkent) oyna boshi soat 05:00 ga surilardi va
// birinchi kunning 00:00–05:00 darslari hisobotdan tushib qolardi.
//
// Qoida: kalendar kuni ("YYYY-MM-DD") — HAR DOIM mahalliy vaqt zonasida.
// Server TZ = kampus TZ bo'lishi shart (prod: TZ=Asia/Tashkent).

import type { Prisma } from "./prisma";

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 0=Dushanba .. 6=Yakshanba (JS getDay: 0=Yakshanba). */
export function mondayIdx(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Date → "YYYY-MM-DD" (mahalliy). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Date → "HH:MM" (mahalliy). */
export function timeOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" + "HH:MM" → mahalliy Date. */
export function atTime(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

/** Kun chegaralari (mahalliy): [gte, lt). */
export function dayBounds(dateKey: string): { gte: Date; lt: Date } {
  const [y, m, d] = dateKey.split("-").map(Number);
  return { gte: new Date(y, m - 1, d, 0, 0, 0, 0), lt: new Date(y, m - 1, d + 1, 0, 0, 0, 0) };
}

/** Bugungi kunning mahalliy boshlanishi. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Kun boshi — "YYYY-MM-DD" mahalliy deb o'qiladi; to'liq ISO bo'lsa o'zicha. */
export function parseDayStart(s: string): Date {
  return DAY_KEY_RE.test(s) ? dayBounds(s).gte : new Date(s);
}

/** Kun oxiri (23:59:59.999) — yuqoridagi bilan bir xil konvensiyada. */
export function parseDayEnd(s: string): Date {
  if (DAY_KEY_RE.test(s)) {
    const end = new Date(dayBounds(s).lt);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return end;
  }
  const d = new Date(s);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Prisma sana filtri [from..to] — IKKALA chekka ham mahalliy kunga tayanadi.
 * Eski `dateRange` nusxalarining (attendance.ts, me/profile.ts) o'rniga.
 */
export function dateRangeFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const f: Prisma.DateTimeFilter = {};
  if (from) f.gte = parseDayStart(from);
  if (to) f.lte = parseDayEnd(to);
  return f;
}
