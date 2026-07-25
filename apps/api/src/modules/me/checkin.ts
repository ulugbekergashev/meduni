// FaceID davomat: talaba o'z telefonidan WebAuthn passkey (FaceID/barmoq) + GPS
// geofence bilan davomatdan o'zi o'tadi. Biometrika qurilmada qoladi — serverda
// faqat ochiq kalit saqlanadi (WebAuthnCredential). Dars boshlanish vaqti oynasiga
// qarab avtomatik KELDI/KECHIKDI yoziladi (selfMarked=true).
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { getStudentLessons, ensureSession, type StudentLesson } from "../courses/timetable";

type Status = "PRESENT" | "LATE";

// ---------- Konfiguratsiya (env) ----------
const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const RP_NAME = "MedUni";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";
// Geofence: markaz + radius (metr). Berilmasa GPS tekshiruvi o'chiq (dev rejim).
const CAMPUS_LAT = process.env.CAMPUS_LAT ? Number(process.env.CAMPUS_LAT) : null;
const CAMPUS_LNG = process.env.CAMPUS_LNG ? Number(process.env.CAMPUS_LNG) : null;
const CAMPUS_RADIUS_M = process.env.CAMPUS_RADIUS_M ? Number(process.env.CAMPUS_RADIUS_M) : 300;
const GEOFENCE_ON = Number.isFinite(CAMPUS_LAT) && Number.isFinite(CAMPUS_LNG);

// Dars boshlanish vaqti oynasi (daqiqa).
const OPEN_BEFORE_MIN = 10; // boshlanishdan 10 daqiqa oldin ochiladi
const LATE_AFTER_MIN = 15; // 15 daqiqagacha KELDI, keyin KECHIKDI
const CLOSE_AFTER_MIN = 90; // boshlanishdan 90 daqiqa keyin yopiladi

// ---------- Challenge saqlash (in-memory) ----------
// ⚠️ Bitta node uchun. Klaster/prod'da Redis kerak bo'ladi (TTL 5 daqiqa).
const challenges = new Map<string, { challenge: string; expires: number }>();
const CHALLENGE_TTL = 5 * 60 * 1000;
function putChallenge(key: string, challenge: string) {
  challenges.set(key, { challenge, expires: Date.now() + CHALLENGE_TTL });
}
function takeChallenge(key: string): string {
  const c = challenges.get(key);
  challenges.delete(key);
  if (!c || c.expires < Date.now()) throw badRequest("Sessiya eskirdi, qayta urinib koʻring", "Сессия истекла, попробуйте снова");
  return c.challenge;
}

// ---------- Vaqt/masofa yordamchilari ----------
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
/** ISO dars sanasidan mahalliy dayKey + startTime ("HH:MM") — ensureSession uchun. */
function lessonKeys(iso: string): { dayKey: string; startTime: string; start: number } {
  const dt = new Date(iso);
  return {
    dayKey: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    startTime: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
    start: dt.getTime(),
  };
}
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Haversine — ikki koordinata orasidagi masofa (metr). */
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Bugungi darslar ichidan vaqt oynasi ochiq bo'lganini topadi. */
function findOpenLesson(lessons: StudentLesson[], now: number): { lesson: StudentLesson; status: Status } | null {
  let best: { lesson: StudentLesson; status: Status; start: number } | null = null;
  for (const l of lessons) {
    const { start } = lessonKeys(l.date);
    const openFrom = start - OPEN_BEFORE_MIN * 60000;
    const closeAt = start + CLOSE_AFTER_MIN * 60000;
    if (now < openFrom || now > closeAt) continue;
    const status: Status = now <= start + LATE_AFTER_MIN * 60000 ? "PRESENT" : "LATE";
    // Bir vaqtda bir necha oyna ochiq bo'lsa — boshlanishi eng yaqinini tanlaymiz.
    if (!best || Math.abs(start - now) < Math.abs(best.start - now)) best = { lesson: l, status, start };
  }
  return best ? { lesson: best.lesson, status: best.status } : null;
}

async function hasCredential(userId: number): Promise<boolean> {
  return (await prisma.webAuthnCredential.count({ where: { userId } })) > 0;
}

// ---------- Holat (tugma ko'rsatish uchun) ----------
export async function getCheckinState(studentId: number) {
  const tk = todayKey();
  const lessons = await getStudentLessons(studentId, tk, tk);
  const open = findOpenLesson(lessons, Date.now());
  const nextUpcoming = lessons.find((l) => !l.isPast) ?? null;

  return {
    hasCredential: await hasCredential(studentId),
    geofenceRequired: GEOFENCE_ON,
    open: open
      ? {
          key: open.lesson.key,
          courseId: open.lesson.courseId,
          courseName: open.lesson.courseName,
          room: open.lesson.room,
          date: open.lesson.date,
          // Vaqt oynasiga qarab yoziladigan holat + talaba allaqachon belgilanganmi.
          wouldBe: open.status,
          myStatus: open.lesson.myStatus,
        }
      : null,
    next: nextUpcoming
      ? { courseName: nextUpcoming.courseName, room: nextUpcoming.room, date: nextUpcoming.date }
      : null,
  };
}

// ---------- WebAuthn: qurilma (passkey) ro'yxatdan o'tkazish ----------
export async function registerOptions(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } });
  if (!user) throw notFound("Foydalanuvchi");
  const existing = await prisma.webAuthnCredential.findMany({ where: { userId } });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(String(userId)),
    userName: user.email,
    userDisplayName: user.fullName,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (c.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  putChallenge(`${userId}:reg`, options.challenge);
  return options;
}

export async function verifyRegister(userId: number, rawResponse: unknown, deviceName?: string) {
  const response = rawResponse as RegistrationResponseJSON;
  const expectedChallenge = takeChallenge(`${userId}:reg`);
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw badRequest("Qurilma tasdiqlanmadi", "Устройство не подтверждено");
  }
  const { credential } = verification.registrationInfo;
  // credentialId band bo'lsa (boshqa akkaunt) — 409.
  const dup = await prisma.webAuthnCredential.findUnique({ where: { credentialId: credential.id } });
  if (dup) throw new ApiError(409, "credential_exists", "Bu qurilma allaqachon ulangan", "Это устройство уже привязано");
  await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports?.join(",") || null,
      deviceName: deviceName?.trim()?.slice(0, 80) || null,
    },
  });
  return { ok: true };
}

export async function listCredentials(userId: number) {
  const creds = await prisma.webAuthnCredential.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return creds.map((c) => ({
    id: c.id,
    deviceName: c.deviceName,
    createdAt: c.createdAt.toISOString(),
    lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
  }));
}

export async function removeCredential(userId: number, id: number) {
  const cred = await prisma.webAuthnCredential.findUnique({ where: { id } });
  if (!cred || cred.userId !== userId) throw notFound("Qurilma");
  await prisma.webAuthnCredential.delete({ where: { id } });
  return { ok: true };
}

// ---------- WebAuthn: check-in (autentifikatsiya) ----------
export async function checkinOptions(userId: number) {
  const creds = await prisma.webAuthnCredential.findMany({ where: { userId } });
  if (!creds.length) throw new ApiError(400, "no_credentials", "Avval qurilmangizni ulang", "Сначала привяжите устройство");
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (c.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
    })),
  });
  putChallenge(`${userId}:auth`, options.challenge);
  return options;
}

export async function checkin(
  userId: number,
  body: { response: unknown; lat?: number; lng?: number; accuracy?: number }
) {
  const response = body.response as AuthenticationResponseJSON;
  // 1) Passkey (FaceID) tasdig'i.
  const expectedChallenge = takeChallenge(`${userId}:auth`);
  const cred = await prisma.webAuthnCredential.findUnique({ where: { credentialId: response.id } });
  if (!cred || cred.userId !== userId) throw badRequest("Qurilma topilmadi", "Устройство не найдено");
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
    credential: {
      id: cred.credentialId,
      publicKey: isoBase64URL.toBuffer(cred.publicKey),
      counter: cred.counter,
      transports: cred.transports ? (cred.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
    },
  });
  if (!verification.verified) throw badRequest("FaceID tasdiqlanmadi", "FaceID не подтверждён");
  await prisma.webAuthnCredential.update({
    where: { id: cred.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });

  // 2) Ochiq darsni SERVER o'zi aniqlaydi (klientga ishonmaymiz).
  const tk = todayKey();
  const lessons = await getStudentLessons(userId, tk, tk);
  const open = findOpenLesson(lessons, Date.now());
  if (!open) throw new ApiError(400, "no_open_lesson", "Hozir davomat oynasi ochiq dars yoʻq", "Сейчас нет урока с открытым окном отметки");
  const { lesson, status } = open;

  // 3) Geofence (yoqilgan bo'lsa).
  let distance: number | null = null;
  if (GEOFENCE_ON) {
    if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
      throw new ApiError(400, "geo_required", "Joylashuvni yoqing", "Включите геолокацию");
    }
    distance = Math.round(distanceM(CAMPUS_LAT as number, CAMPUS_LNG as number, body.lat as number, body.lng as number));
    if (distance > CAMPUS_RADIUS_M) {
      throw new ApiError(403, "geo_out_of_campus", "Siz universitet hududida emassiz", "Вы не на территории университета");
    }
  }

  // 4) Sessiya (lazy) + yozish. Guruh = talabaning o'z guruhi (o'qituvchi RollCall bilan bir kalit).
  const { dayKey, startTime } = lessonKeys(lesson.date);
  const course = await prisma.course.findUnique({ where: { id: lesson.courseId }, select: { teacherId: true } });
  const sessionId = await ensureSession(lesson.courseId, lesson.groupId, dayKey, startTime, course?.teacherId ?? userId);

  const existing = await prisma.attendance.findUnique({ where: { sessionId_studentId: { sessionId, studentId: userId } } });
  if (existing) {
    // O'qituvchi belgilagan bo'lsa (selfMarked=false) — ustidan yozmaymiz.
    if (!existing.selfMarked) {
      throw new ApiError(409, "already_marked", "Davomat allaqachon belgilangan", "Посещаемость уже отмечена");
    }
    // O'zi allaqachon belgilagan — idempotent.
    return { ok: true, status: existing.status as Status, already: true, courseName: lesson.courseName, distance };
  }
  await prisma.attendance.create({
    data: { sessionId, studentId: userId, status, markedById: userId, selfMarked: true },
  });
  await prisma.auditLog
    .create({
      data: {
        actorId: userId,
        action: "SELF_CHECKIN",
        entity: "LessonSession",
        entityId: sessionId,
        detailsJson: { courseId: lesson.courseId, dayKey, startTime, status, distance },
      },
    })
    .catch(() => {});

  return { ok: true, status, already: false, courseName: lesson.courseName, distance };
}
