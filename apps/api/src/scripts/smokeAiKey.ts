// Gemini'siz, haqiqiy bazasiz mantiqiy sinov: kafedra kaliti shifrlash qatlami + resolver.
// Prisma chaqiruvi sinov ichida almashtiriladi — hech qanday bazaga ulanmaydi.
import { aadForDepartment, decryptKey, encryptKey, last4Of, normalizeApiKey } from "../ai/keyVault";
import { invalidateDepartmentKey, isKeyFatal, resolveGeminiKey } from "../ai/keys";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";

let pass = 0;
let fail = 0;
const ok = (c: boolean, n: string) => {
  c ? pass++ : fail++;
  console.log(`${c ? "ok" : "!!"} ${n}`);
};
const throws = (fn: () => unknown, match?: string) => {
  try {
    fn();
    return false;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return !match || err.code === match || err.message === match;
  }
};
const throwsAsync = async (fn: () => Promise<unknown>, code?: string) => {
  try {
    await fn();
    return false;
  } catch (e) {
    return !code || (e as { code?: string }).code === code;
  }
};

const KEY = "AIzaSyDUMMY-test-key-1234567890abcdefgh";
const SECRET = "s".repeat(40);
const A = aadForDepartment(1);
const B = aadForDepartment(2);

async function main() {
  // --- Production: AI_KEY_SECRET majburiy, JWT sirga o'tilmaydi -----------------
  process.env.NODE_ENV = "production";
  process.env.JWT_REFRESH_SECRET = "j".repeat(48);
  delete process.env.AI_KEY_SECRET;
  ok(throws(() => encryptKey(KEY, A), "ai_key_vault_unconfigured"), "prod: AI_KEY_SECRET yo'q → saqlanmaydi (JWT sirga o'tmaydi)");
  process.env.AI_KEY_SECRET = "short";
  ok(throws(() => encryptKey(KEY, A), "ai_key_vault_unconfigured"), "prod: 32 belgidan qisqa sir rad etiladi");
  process.env.AI_KEY_SECRET = SECRET;

  // --- Shifrlash ----------------------------------------------------------------
  const enc = encryptKey(KEY, A);
  ok(enc.startsWith("v2.") && enc.split(".").length === 4, "format v2.iv.tag.ct");
  ok(!enc.includes(KEY) && !enc.includes(KEY.slice(0, 12)), "shifrda ochiq matn yo'q");
  ok(decryptKey(enc, A) === KEY, "shifrlash → ochish aylanishi");
  ok(encryptKey(KEY, A) !== enc, "har safar boshqa IV");
  ok(last4Of(KEY) === "efgh", "last4");

  // --- Kafedraga bog'lanish (AAD) -------------------------------------------------
  ok(throws(() => decryptKey(enc, B)), "A kafedra shifri B kafedra sifatida OCHILMAYDI (AAD)");

  // --- Buzilish / format -----------------------------------------------------------
  const p = enc.split(".");
  const flip = (s: string) => (s[0] === "A" ? "B" : "A") + s.slice(1);
  ok(throws(() => decryptKey([p[0], p[1], p[2], flip(p[3])].join("."), A)), "ciphertext buzilsa ochilmaydi");
  ok(throws(() => decryptKey([p[0], p[1], flip(p[2]), p[3]].join("."), A)), "teg buzilsa ochilmaydi");
  const shortTag = Buffer.from(p[2], "base64url").subarray(0, 4).toString("base64url");
  ok(throws(() => decryptKey([p[0], p[1], shortTag, p[3]].join("."), A), "ai_key_bad_format"), "qisqartirilgan teg rad etiladi");
  ok(throws(() => decryptKey(enc + ".extra", A), "ai_key_bad_format"), "ortiqcha segment rad etiladi");
  ok(throws(() => decryptKey("v1." + p.slice(1).join("."), A), "ai_key_bad_format"), "eski/noma'lum versiya rad etiladi");

  // --- Sir almashsa ------------------------------------------------------------------
  process.env.AI_KEY_SECRET = "t".repeat(40);
  ok(throws(() => decryptKey(enc, A)), "sir almashsa eski shifr ochilmaydi");
  process.env.AI_KEY_SECRET = SECRET;

  // --- Dev: JWT sirdan hosil qilish mumkin -----------------------------------------
  process.env.NODE_ENV = "development";
  delete process.env.AI_KEY_SECRET;
  process.env.JWT_REFRESH_SECRET = "d".repeat(24);
  ok(decryptKey(encryptKey(KEY, A), A) === KEY, "dev: JWT sirdan hosil qilish ishlaydi");
  process.env.NODE_ENV = "production";
  process.env.AI_KEY_SECRET = SECRET;

  // --- Normalizatsiya ------------------------------------------------------------------
  ok(normalizeApiKey("  " + KEY + "\n") === KEY, "bo'shliqlar kesiladi");
  const NEW_FORMAT = "AQ.Ab8RN6dummy_TEST-key0000000000000000000000000";
  ok(normalizeApiKey(NEW_FORMAT) === NEW_FORMAT, "yangi format (AQ. — nuqta bilan) qabul qilinadi");
  ok(throws(() => normalizeApiKey("qisqa"), "ai_key_format"), "juda qisqa rad etiladi");
  ok(throws(() => normalizeApiKey("AIza with space inside the key value here"), "ai_key_format"), "ichida probel rad etiladi");
  ok(throws(() => normalizeApiKey("AIzaSyDUMMY-тест-key-1234567890abcdef"), "ai_key_format"), "ASCII bo'lmagan belgi rad etiladi");
  ok(throws(() => normalizeApiKey(undefined), "ai_key_format"), "undefined rad etiladi");

  // --- Resolver (prisma almashtirilgan) -------------------------------------------------
  let row: { keyEnc: string } | null = null;
  Object.defineProperty(prisma, "departmentAiKey", {
    configurable: true,
    value: { findUnique: async () => row },
  });
  const setRow = (r: { keyEnc: string } | null) => {
    row = r;
    invalidateDepartmentKey(1);
  };

  delete process.env.GEMINI_API_KEY;
  setRow(null);
  ok((await resolveGeminiKey(1)) === null, "qator yo'q, umumiy kalit yo'q → null");

  process.env.GEMINI_API_KEY = "platform-key-xxxxxxxxxxxxxxxx";
  setRow(null);
  ok((await resolveGeminiKey(1))?.source === "platform", "qator yo'q + umumiy kalit → platform (zaxira)");
  ok((await resolveGeminiKey(undefined))?.source === "platform", "kafedra noma'lum + umumiy kalit → platform");

  setRow({ keyEnc: encryptKey(KEY, A) });
  const own = await resolveGeminiKey(1);
  ok(own?.source === "department" && own.key === KEY, "kafedra kaliti bor → FAQAT u ishlatiladi (umumiy kalit bor bo'lsa ham)");

  setRow({ keyEnc: encryptKey(KEY, B) }); // boshqa kafedra shifri ko'chirilgan
  ok(await throwsAsync(() => resolveGeminiKey(1), "ai_key_unreadable"), "ko'chirilgan shifr → ai_key_unreadable (umumiy kalitga o'tmaydi)");

  setRow({ keyEnc: "v2.bad.bad.bad" });
  ok(await throwsAsync(() => resolveGeminiKey(1), "ai_key_unreadable"), "buzilgan yozuv → ai_key_unreadable (fail-closed)");

  let thrown: unknown;
  try {
    await resolveGeminiKey(1);
  } catch (e) {
    thrown = e;
  }
  ok(thrown instanceof ApiError && isKeyFatal(thrown), "ai_key_unreadable provayder zanjirini TO'XTATADI (isKeyFatal)");
  ok(isKeyFatal(new ApiError(502, "ai_key_error", "x", "x")), "ai_key_error ham zanjirni to'xtatadi");
  ok(!isKeyFatal(new ApiError(409, "ai_key_missing", "x", "x")), "ai_key_missing zanjirni to'xtatMAYDI");

  console.log(`\n${pass} ok, ${fail} xato`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
