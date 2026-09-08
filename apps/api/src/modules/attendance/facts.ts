// DAVOMAT FAKTLARI — BUTUN tizim uchun YAGONA manba (Davomat 2.0, F0).
//
// ⚠️ NEGA (2026-09-08 auditi): davomat foizi 10 ta joyda MUSTAQIL yozilgan edi —
// courses/attendance.ts, me/profile.ts, admin/groups.ts (2×), admin/students.ts,
// users/service.ts, courses/progress.ts (2×), courses/service.ts (2×),
// timetable.ts, tasks/service.ts. Ular uch xil javob berardi ("belgilanmagan"
// holatida null / 0 / 100), guruh o'rtachasi esa FOIZLAR o'rtachasi edi (pooled
// nisbat emas) — natijada talaba, o'qituvchi va dekanat BIR odam haqida boshqa-boshqa
// raqam ko'rardi. Endi formula shu faylda, bir marta.
//
// FORMULA (F0 da AYNAN eski xatti-harakat saqlanadi — bu faza faqat birlashtiradi):
//   davomat % = (PRESENT + LATE) / (PRESENT + ABSENT + LATE + EXCUSED)
//   belgilanmagan darslar hisobga KIRMAYDI (maxrajda yo'q) → marked=0 bo'lsa null.
//
// ⚠️ F1 da o'zgaradi (rejadagi koridor, `.claude/plans/davomat-2-...md`):
//   (1) hisob DARS emas, AKADEMIK SOAT bo'yicha (Vazirlar Mahkamasi №824: bir fanga
//       ajratilgan auditoriya soatining 25 % i SABABSIZ qoldirilsa — yakuniy nazoratga
//       kiritilmaydi; №393: semestrda 74 soatdan ortiq — chetlashtirish);
//   (2) EXCUSED ayni paytda maxrajda turibdi, ya'ni spravkali propusk progul kabi
//       jazolaydi — F1 da "sababsiz soat / limit" asosiy ko'rsatkichga aylanadi;
//   (3) "Dars bo'lmadi" (CANCELLED) maxrajdan chiqadi.
// Shu sabab bu yerda `pct` — MA'LUMOT uchun ko'rsatkich, `unexcused*` esa F1 da
// qo'shiladigan REGULYATOR ko'rsatkich uchun joy.

import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";

export type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export const ATT_STATUSES: AttStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export function isAttStatus(s: unknown): s is AttStatus {
  return typeof s === "string" && (ATT_STATUSES as string[]).includes(s);
}

/**
 * Past davomat chegarasi (%). F0 da BITTA konstanta (ilgari frontendda 13 ta joyda,
 * backendda tasks/service.ts da qattiq yozilgan edi; matritsada esa 80/60 turardi).
 * ⚠️ F1: `LearningPolicy` koridoridan olinadi (warnUnexcusedPct/maxUnexcusedPct) —
 * o'zgartirish relizni emas, /admin/control sahifasini talab qiladi.
 */
export const LOW_ATTENDANCE_PCT = 75;

export function isLowAttendance(pct: number | null): boolean {
  return pct !== null && pct < LOW_ATTENDANCE_PCT;
}

// ---------- Sanoq (tally) ----------

export interface AttTally {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface AttStats extends AttTally {
  /** Belgilangan darslar soni (maxraj). */
  marked: number;
  /** (present+late)/marked, belgilanmagan bo'lsa null — HECH QACHON 0 yoki 100 emas. */
  pct: number | null;
}

export function emptyTally(): AttTally {
  return { present: 0, absent: 0, late: 0, excused: 0 };
}

/** Bitta belgini (yoki n tasini) sanoqqa qo'shadi. Notanish status e'tiborsiz. */
export function addMark(t: AttTally, status: string, n = 1): void {
  if (status === "PRESENT") t.present += n;
  else if (status === "ABSENT") t.absent += n;
  else if (status === "LATE") t.late += n;
  else if (status === "EXCUSED") t.excused += n;
}

/** `groupBy(["status"])` natijasidan yoki oddiy `{status}[]` dan sanoq. */
export function tallyOf(rows: { status: string; _count?: number }[]): AttTally {
  const t = emptyTally();
  for (const r of rows) addMark(t, r.status, r._count ?? 1);
  return t;
}

export function markedOf(t: AttTally): number {
  return t.present + t.absent + t.late + t.excused;
}

/**
 * YAGONA FORMULA. Boshqa hech qayerda takrorlanmaydi.
 * Kelgan = PRESENT + LATE (kechikish — kelgan deb hisoblanadi).
 */
export function attendancePct(t: AttTally): number | null {
  const marked = markedOf(t);
  return marked === 0 ? null : Math.round(((t.present + t.late) / marked) * 100);
}

export function attendanceStats(t: AttTally): AttStats {
  return { ...t, marked: markedOf(t), pct: attendancePct(t) };
}

/**
 * Bir nechta sanoqni QO'SHADI (pooled), ya'ni guruh/kurs ko'rsatkichi —
 * foizlar o'rtachasi EMAS.
 * ⚠️ Bu `admin/groups.ts::avgAttendance` xatosini tuzatadi: ilgari har talabaning
 * foizi o'rtachalanardi, shuning uchun 2 ta belgisi bor talaba 40 ta belgisi bor
 * talaba bilan bir xil "og'irlikda" edi va guruh raqami hisobot bilan mos kelmasdi.
 */
export function poolTallies(list: Iterable<AttTally>): AttTally {
  const out = emptyTally();
  for (const t of list) {
    out.present += t.present;
    out.absent += t.absent;
    out.late += t.late;
    out.excused += t.excused;
  }
  return out;
}

// ---------- Bazadan sanoq ----------

/** Bitta kesim bo'yicha sanoq (kurs / guruh / universitet darajasi). */
export async function tallyByStatus(where: Prisma.AttendanceWhereInput): Promise<AttTally> {
  const rows = await prisma.attendance.groupBy({ by: ["status"], where, _count: true });
  return tallyOf(rows.map((r) => ({ status: r.status as string, _count: r._count })));
}

/** Talabalar kesimida sanoq — bitta so'rovda (N+1 emas). */
export async function tallyByStudent(where: Prisma.AttendanceWhereInput): Promise<Map<number, AttTally>> {
  const rows = await prisma.attendance.groupBy({ by: ["studentId", "status"], where, _count: true });
  const out = new Map<number, AttTally>();
  for (const r of rows) {
    let t = out.get(r.studentId);
    if (!t) {
      t = emptyTally();
      out.set(r.studentId, t);
    }
    addMark(t, r.status as string, r._count);
  }
  return out;
}

/** Kurslar kesimida sanoq — bitta so'rovda (guruh profili: har kurs uchun alohida
 *  `groupBy` sikli o'rniga). */
export async function tallyByCourse(where: Prisma.AttendanceWhereInput): Promise<Map<number, AttTally>> {
  // `groupBy` bog'langan jadval ustuni (session.courseId) bo'yicha guruhlay olmaydi,
  // shuning uchun ikkita ustunni o'qib JS'da yig'amiz — bu baribir har kurs uchun
  // alohida so'rov yuborishdan (N+1) arzon.
  const marks = await prisma.attendance.findMany({
    where,
    select: { status: true, session: { select: { courseId: true } } },
  });
  const out = new Map<number, AttTally>();
  for (const m of marks) {
    const cid = m.session.courseId;
    let t = out.get(cid);
    if (!t) {
      t = emptyTally();
      out.set(cid, t);
    }
    addMark(t, m.status as string);
  }
  return out;
}
