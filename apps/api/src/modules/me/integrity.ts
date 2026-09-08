// ЧЕСТНОСТЬ ОЦЕНИВАНИЯ (2026-08-11, требование руководства: «сдал сам, а не
// друг и не ИИ»).
//
// ⚠️ ЧЕСТНАЯ ГРАНИЦА. Платформа не знает, кто сидит перед экраном. Здесь нет
// и не будет «детектора ИИ по тексту» — такие детекторы ошибаются на неродном
// языке и медицинской терминологии, то есть регулярно обвиняют честных.
// Что здесь есть:
//   1) ОЧНЫЙ РЕЖИМ — единственное, что реально отвечает на вопрос «кто сдал»:
//      попытка открывается только в день занятия и только если преподаватель
//      отметил студента присутствующим.
//   2) СНИМОК ВАРИАНТА — свой порядок вопросов и вариантов на каждую попытку.
//   3) ПРИВЯЗКА К УСТРОЙСТВУ — начатую попытку нельзя продолжить с другого.
//   4) ТЕЛЕМЕТРИЯ — уход со вкладки, вставка из буфера, аномальная скорость.
//      Это ПОДСКАЗКА преподавателю, а не приговор.
import { createHash } from "crypto";
import type { Request } from "express";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/errors";

// ---------- 1. Очный режим ----------

/**
 * Окно, в течение которого отметка присутствия открывает очную попытку (часы).
 * Смысл: попытка сдаётся НА ТОМ ЖЕ занятии, а не «когда-нибудь в тот же день».
 */
const PRESENCE_WINDOW_HOURS = Number(process.env.PRESENCE_WINDOW_HOURS ?? 4);
/** Небольшой допуск: преподаватель нередко отмечает за пару минут до звонка. */
const PRESENCE_LEAD_MIN = 30;

/**
 * Отмечен ли студент присутствующим на ИДУЩЕМ занятии этого курса.
 * Опирается на существующую перекличку — отдельного «прокторинга» не нужно:
 * преподаватель уже подтвердил присутствие своей рукой.
 *
 * ⚠️ ИСПРАВЛЕНО (2026-09-08): раньше подходила любая отметка PRESENT/LATE за
 * СЕГОДНЯ. При двух парах в день это означало: отметился в 09:00 — открыл
 * проктируемый тест в 14:00 из дома, то есть очный режим не выполнял того
 * единственного, ради чего существует. Теперь занятие должно было начаться
 * не более PRESENCE_WINDOW_HOURS назад.
 */
export async function markedPresentToday(studentId: number, courseId: number): Promise<boolean> {
  const now = new Date();
  const from = new Date(now.getTime() - PRESENCE_WINDOW_HOURS * 3_600_000);
  const until = new Date(now.getTime() + PRESENCE_LEAD_MIN * 60_000);

  const row = await prisma.attendance.findFirst({
    where: {
      studentId,
      status: { in: ["PRESENT", "LATE"] },
      session: { courseId, date: { gte: from, lte: until } },
    },
    select: { id: true },
  });
  return !!row;
}

/** Очный тест без отметки присутствия на ИДУЩЕМ занятии начать нельзя. */
export async function assertPresence(studentId: number, courseId: number): Promise<void> {
  if (await markedPresentToday(studentId, courseId)) return;
  throw new ApiError(
    403,
    "presence_required",
    "Bu test faqat auditoriyada, dars vaqtida topshiriladi — avval oʻqituvchi yoʻqlamada belgilashi kerak",
    "Этот тест сдаётся только в аудитории и во время занятия — преподаватель должен отметить ваше присутствие"
  );
}

// ---------- 2. Снимок варианта ----------

export interface AttemptOrder {
  /** Порядок вопросов в этой попытке. */
  q: number[];
  /** questionId → перестановка вариантов: displayed[i] = original[opt[i]]. */
  opt: Record<string, number[]>;
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Свой вариант на каждую попытку — сосед и пересдача видят другой порядок. */
export function buildOrder(questions: { id: number; optionsJson: unknown }[]): AttemptOrder {
  const opt: Record<string, number[]> = {};
  for (const q of questions) {
    const n = ((q.optionsJson as string[]) ?? []).length;
    opt[String(q.id)] = shuffled([...Array(n).keys()]);
  }
  return { q: shuffled(questions.map((x) => x.id)), opt };
}

export function readOrder(raw: unknown): AttemptOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { q?: unknown; opt?: unknown };
  if (!Array.isArray(o.q) || typeof o.opt !== "object" || o.opt === null) return null;
  return { q: o.q as number[], opt: o.opt as Record<string, number[]> };
}

/** Экранный индекс → исходный (ответы всегда хранятся в исходных индексах). */
export function toOriginalIndex(order: AttemptOrder | null, questionId: number, shown: number): number {
  const perm = order?.opt[String(questionId)];
  if (!perm || shown < 0 || shown >= perm.length) return shown;
  return perm[shown];
}

/** Исходный индекс → экранный (чтобы подсветить выбранный ответ). */
export function toShownIndex(order: AttemptOrder | null, questionId: number, original: number | null): number | null {
  if (original === null) return null;
  const perm = order?.opt[String(questionId)];
  if (!perm) return original;
  const i = perm.indexOf(original);
  return i === -1 ? original : i;
}

// ---------- 3. Привязка к устройству ----------

/**
 * Отпечаток устройства: клиентский стабильный id (localStorage) + user-agent.
 * Не «биометрия» — но закрывает самый простой сценарий: друг открывает тот же
 * аккаунт со своего телефона и дорешивает начатую попытку.
 */
export function deviceHash(req: Request): string {
  const cid = String(req.header("x-device-id") ?? "").slice(0, 100);
  const ua = String(req.header("user-agent") ?? "").slice(0, 200);
  return createHash("sha256").update(`${cid}|${ua}`).digest("hex").slice(0, 32);
}

export function assertSameDevice(stored: string | null, current: string): void {
  if (!stored || stored === current) return;
  throw new ApiError(
    403,
    "device_mismatch",
    "Test boshqa qurilmada boshlangan — oʻsha qurilmada davom ettiring",
    "Попытка начата на другом устройстве — продолжите на нём"
  );
}

// ---------- 4. Телеметрия честности ----------

export type IntegrityEvent = "blur" | "paste" | "fast";

export interface IntegrityLog {
  blur: number;
  paste: number;
  fast: number;
  /** Разные IP в рамках одной попытки — признак, что отвечали с двух мест. */
  ips: string[];
}

export function readIntegrity(raw: unknown): IntegrityLog {
  const o = (raw ?? {}) as Partial<IntegrityLog>;
  return {
    blur: Number(o.blur) || 0,
    paste: Number(o.paste) || 0,
    fast: Number(o.fast) || 0,
    ips: Array.isArray(o.ips) ? o.ips.slice(0, 5).map(String) : [],
  };
}

/** Порог, после которого преподавателю показывается пометка. */
export function integrityFlags(log: IntegrityLog): string[] {
  const flags: string[] = [];
  if (log.blur >= 3) flags.push("tab_switching");
  if (log.paste > 0) flags.push("paste");
  if (log.fast >= 3) flags.push("too_fast");
  if (log.ips.length > 1) flags.push("multiple_ips");
  return flags;
}

/** Событие честности во время попытки (клиент шлёт, сервер только копит). */
export async function recordIntegrity(
  studentId: number,
  attemptId: number,
  event: IntegrityEvent,
  ip: string | null
): Promise<{ ok: true }> {
  const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== studentId || attempt.finishedAt) return { ok: true };

  const log = readIntegrity(attempt.integrityJson);
  if (event === "blur") log.blur++;
  else if (event === "paste") log.paste++;
  else if (event === "fast") log.fast++;
  if (ip && !log.ips.includes(ip)) log.ips = [...log.ips, ip].slice(0, 5);

  await prisma.quizAttempt.update({ where: { id: attemptId }, data: { integrityJson: { ...log } } });
  return { ok: true };
}
