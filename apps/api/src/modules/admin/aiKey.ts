import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";
import { assertDeptScope, type AdminScope } from "../../middleware/adminScope";
import { aadForDepartment, decryptKey, encryptKey, last4Of, normalizeApiKey } from "../../ai/keyVault";
import { invalidateDepartmentKey, verifyGeminiKey } from "../../ai/keys";

/**
 * Kafedraning o'z Gemini kaliti (admin tomoni).
 *
 * ⚠️ Kalit bu moduldan TASHQARIGA HECH QACHON chiqmaydi: javoblarda faqat
 * `configured` + `last4`. Audit logga ham kalit emas, faqat oxirgi 4 belgi yoziladi.
 * Ko'ra oladiganlar: SUPERADMIN (hamma), FACULTY_ADMIN (o'z fakulteti), DEPT_ADMIN
 * (o'z kafedrasi) — `assertDeptScope` bilan.
 */

export interface KeyStatus {
  departmentId: number;
  configured: boolean;
  last4: string | null;
  setAt: string | null;
  setByName: string | null;
  checkedAt: string | null;
  /** Serverda umumiy (zaxira) kalit bor — kafedra kalit kiritmasa shuni ishlatadi. */
  platformFallback: boolean;
}

// Har PUT/check Google'ga jonli chaqiruv: foydalanuvchi bo'yicha daqiqasiga 5 ta.
// (Aks holda admin tizim orqali begona kalitlarni "tekshiradigan oracle"ga aylanadi.)
const THROTTLE_WINDOW_MS = 60_000;
const THROTTLE_MAX = 5;
const calls = new Map<number, number[]>();
function throttle(userId: number): void {
  const now = Date.now();
  const recent = (calls.get(userId) ?? []).filter((t) => now - t < THROTTLE_WINDOW_MS);
  if (recent.length >= THROTTLE_MAX) {
    throw new ApiError(429, "rate_limited", "Juda koʻp urinish. Bir daqiqadan keyin qayta urining.", "Слишком много попыток. Повторите через минуту.");
  }
  recent.push(now);
  calls.set(userId, recent);
}

async function loadDept(departmentId: number, scope: AdminScope) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, facultyId: true } });
  if (!dept) throw notFound("Kafedra");
  assertDeptScope(scope, dept);
  return dept;
}

async function statusOf(departmentId: number): Promise<KeyStatus> {
  const row = await prisma.departmentAiKey.findUnique({
    where: { departmentId },
    select: { last4: true, setAt: true, setById: true, checkedAt: true },
  });
  const setBy = row?.setById
    ? await prisma.user.findUnique({ where: { id: row.setById }, select: { fullName: true } })
    : null;
  return {
    departmentId,
    configured: !!row,
    last4: row?.last4 ?? null,
    setAt: row?.setAt.toISOString() ?? null,
    setByName: setBy?.fullName ?? null,
    checkedAt: row?.checkedAt?.toISOString() ?? null,
    platformFallback: !!process.env.GEMINI_API_KEY,
  };
}

export async function getKeyStatus(departmentId: number, scope: AdminScope): Promise<KeyStatus> {
  await loadDept(departmentId, scope);
  return statusOf(departmentId);
}

/** Doira ichidagi barcha kafedralar holati (AI monitoring jadvali uchun). */
export async function listKeyStatuses(scope: AdminScope): Promise<Pick<KeyStatus, "departmentId" | "configured" | "last4" | "setAt">[]> {
  // Sukut: HECH NARSA mos kelmaydi (fail-closed). Faqat SUPER hammasini ko'radi.
  const where =
    scope.level === "SUPER"
      ? {}
      : scope.level === "FACULTY" && scope.facultyId
        ? { department: { facultyId: scope.facultyId } }
        : scope.level === "DEPT" && scope.departmentId
          ? { departmentId: scope.departmentId }
          : { departmentId: -1 };
  const rows = await prisma.departmentAiKey.findMany({ where, select: { departmentId: true, last4: true, setAt: true } });
  return rows.map((r) => ({ departmentId: r.departmentId, configured: true, last4: r.last4, setAt: r.setAt.toISOString() }));
}

export async function setKey(actorId: number, departmentId: number, scope: AdminScope, apiKeyInput: unknown): Promise<KeyStatus> {
  await loadDept(departmentId, scope);
  throttle(actorId);
  const apiKey = normalizeApiKey(apiKeyInput);

  const check = await verifyGeminiKey(apiKey);
  if (!check.ok) {
    if (check.reason === "invalid") {
      throw new ApiError(
        400,
        "ai_key_invalid",
        "Google bu kalitni qabul qilmadi. Kalitni aistudio.google.com dan qayta nusxalang.",
        "Google не принял этот ключ. Скопируйте ключ заново на aistudio.google.com."
      );
    }
    throw new ApiError(
      502,
      "ai_key_unverified",
      "Kalitni tekshirib boʻlmadi: server Google bilan aloqa qila olmayapti. Birozdan keyin qayta urining.",
      "Не удалось проверить ключ: сервер не может связаться с Google. Повторите позже."
    );
  }

  const keyEnc = encryptKey(apiKey, aadForDepartment(departmentId));
  const now = new Date();
  await prisma.departmentAiKey.upsert({
    where: { departmentId },
    create: { departmentId, keyEnc, last4: last4Of(apiKey), setById: actorId, setAt: now, checkedAt: now },
    update: { keyEnc, last4: last4Of(apiKey), setById: actorId, setAt: now, checkedAt: now },
  });
  invalidateDepartmentKey(departmentId);
  await prisma.auditLog.create({
    data: { actorId, action: "SET_AI_KEY", entity: "Department", entityId: departmentId, detailsJson: { last4: last4Of(apiKey) } },
  });
  return statusOf(departmentId);
}

export async function removeKey(actorId: number, departmentId: number, scope: AdminScope): Promise<KeyStatus> {
  await loadDept(departmentId, scope);
  const existing = await prisma.departmentAiKey.findUnique({ where: { departmentId }, select: { last4: true } });
  if (existing) {
    await prisma.departmentAiKey.delete({ where: { departmentId } });
    invalidateDepartmentKey(departmentId);
    await prisma.auditLog.create({
      data: { actorId, action: "REMOVE_AI_KEY", entity: "Department", entityId: departmentId, detailsJson: { last4: existing.last4 } },
    });
  }
  return statusOf(departmentId);
}

/** Saqlangan kalit hali ishlayaptimi (Google'da bekor qilingan/muddati o'tgan bo'lishi mumkin). */
export async function recheckKey(actorId: number, departmentId: number, scope: AdminScope): Promise<{ ok: boolean; reason?: string; status: KeyStatus }> {
  await loadDept(departmentId, scope);
  throttle(actorId);
  const row = await prisma.departmentAiKey.findUnique({ where: { departmentId }, select: { keyEnc: true } });
  if (!row) throw new ApiError(404, "ai_key_not_set", "Bu kafedra kalit kiritmagan", "Эта кафедра не добавила ключ");
  let key: string;
  try {
    key = decryptKey(row.keyEnc, aadForDepartment(departmentId));
  } catch {
    return { ok: false, reason: "unreadable", status: await statusOf(departmentId) };
  }
  const check = await verifyGeminiKey(key);
  if (check.ok) await prisma.departmentAiKey.update({ where: { departmentId }, data: { checkedAt: new Date() } });
  return { ok: check.ok, reason: check.ok ? undefined : check.reason, status: await statusOf(departmentId) };
}
