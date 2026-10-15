import crypto from "node:crypto";
import { ApiError } from "../lib/errors";

/**
 * Kafedra Gemini kalitini bazada saqlash uchun shifrlash (AES-256-GCM).
 *
 * Format: `v2.<iv>.<tag>.<ciphertext>` (base64url). Shifr KAFEDRAGA bog'langan
 * (AAD = `dept:<id>`): bir kafedraning shifrlangan qiymatini boshqa kafedra
 * qatoriga ko'chirib bo'lmaydi — ochilmaydi. IV 12 bayt, tag 16 bayt qat'iy
 * tekshiriladi (qisqartirilgan teg bilan soxtalashtirish yo'q).
 *
 * Shifrlash sirri: `AI_KEY_SECRET`.
 *  - PRODUCTION'da u MAJBURIY (kamida 32 belgi): kafedra kaliti JWT sirining
 *    ostida turmasin va JWT'ni almashtirish kalitlarni yo'q qilmasin.
 *  - Dev'da qulaylik uchun `JWT_REFRESH_SECRET` dan hosil qilinadi.
 * ⚠️ Sirni bir marta qo'ying va O'ZGARTIRMANG: almashsa saqlangan kalitlar
 * o'qilmay qoladi (kafedralar qayta kiritadi — jimgina umumiy kalitga o'tilmaydi).
 */
const VERSION = "v2";
const INFO = "meduni:department-ai-key";
const SALT = Buffer.from("meduni:ai-key:salt:v2");
const IV_LEN = 12;
const TAG_LEN = 16;
const MIN_SECRET_PROD = 32;
const MIN_SECRET_DEV = 16;

function vaultSecret(): Buffer {
  const prod = process.env.NODE_ENV === "production";
  const raw = process.env.AI_KEY_SECRET || (prod ? undefined : process.env.JWT_REFRESH_SECRET);
  if (!raw || raw.length < (prod ? MIN_SECRET_PROD : MIN_SECRET_DEV)) {
    throw new ApiError(
      500,
      "ai_key_vault_unconfigured",
      "Kalitni saqlash uchun serverda AI_KEY_SECRET sozlanmagan (kamida 32 belgi). Server administratoriga ayting.",
      "На сервере не настроен AI_KEY_SECRET (минимум 32 символа). Сообщите администратору сервера."
    );
  }
  return Buffer.from(crypto.hkdfSync("sha256", raw, SALT, INFO, 32));
}

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

/** Shifr qaysi kafedraga tegishli ekanini bog'laydigan AAD. */
export const aadForDepartment = (departmentId: number) => `dept:${departmentId}`;

export function encryptKey(plain: string, aad: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultSecret(), iv, { authTagLength: TAG_LEN });
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, b64u(iv), b64u(cipher.getAuthTag()), b64u(ct)].join(".");
}

/** Shifrni ochadi. Format/sir/AAD/teg mos kelmasa — `Error` tashlaydi. */
export function decryptKey(enc: string, aad: string): string {
  const parts = enc.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("ai_key_bad_format");
  const iv = fromB64u(parts[1]);
  const tag = fromB64u(parts[2]);
  const ct = fromB64u(parts[3]);
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN || ct.length === 0) throw new Error("ai_key_bad_format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", vaultSecret(), iv, { authTagLength: TAG_LEN });
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export const last4Of = (key: string) => key.slice(-4);

/** Foydalanuvchi kiritgan kalitni normallashtiradi va ASOSIY shaklini tekshiradi. */
export function normalizeApiKey(input: unknown): string {
  const key = typeof input === "string" ? input.trim() : "";
  // Google kalitlari: eski "AIza..." (~39 belgi) va YANGI "AQ.Ab8R..." (ichida nuqta
  // bor — 2026-10-15 buyurtmachi kiritganda aynan shu rad etildi). Prefiks/uzunlikni
  // qat'iy tekshirmaymiz — haqiqiy tekshiruv Google'ga chaqiruv bilan. Faqat belgilar
  // to'plami cheklangan: ASCII bo'lmagan belgi HTTP sarlavhada yiqilib, "aloqa yo'q"
  // bo'lib ko'rinmasin.
  if (key.length < 20 || key.length > 200 || !/^[A-Za-z0-9._-]+$/.test(key)) {
    throw new ApiError(
      400,
      "ai_key_format",
      "Kalit formati notoʻgʻri (faqat lotin harflari, raqamlar, nuqta, - va _ boʻlishi kerak)",
      "Неверный формат ключа (допустимы только латинские буквы, цифры, точка, - и _)"
    );
  }
  return key;
}
