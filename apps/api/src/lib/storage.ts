import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "./prisma";

// Fayl saqlash — IKKI drayver, bitta yuza (6 funksiya).
//
//   disk — mahalliy papka (dev). Tez, brauzerdan ko'rish oson.
//   db   — Postgres `file_blobs` jadvali (prod/Render).
//
// ⚠️ NEGA `db` prod'da: Render Free'da doimiy disk YO'Q. Konteyner 15 daqiqa
// faoliyatsizlikdan keyin uxlaydi va keyingi kirishда NOLDAN ko'tariladi —
// `/app/storage` bo'sh bo'ladi. Bazadagi yozuv (Video.mp4Url va h.k.) esa
// qoladi, ya'ni UI "video bor" deb pleyer ko'rsatadi, fayl esa yo'q. Fayllarni
// bazaga qo'yish shu tuzoqni butunlay yopadi (baza Supabase'da — doimiy).
//
// Yo'llar ikkala drayverда AYNAN bir xil ("topics/12/video/3/video.mp4"),
// shuning uchun mavjud url qiymatlari migratsiyasiz ishlayveradi va drayverni
// almashtirish xavfsiz.
const DRIVER: "db" | "disk" =
  process.env.STORAGE_DRIVER === "db"
    ? "db"
    : process.env.STORAGE_DRIVER === "disk"
      ? "disk"
      : process.env.NODE_ENV === "production"
        ? "db"
        : "disk";

const STORAGE_ROOT = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));

/** Supabase Free bazasi 500MB — bittalik ulkan fayl kvotani yeb qo'ymasin. */
const WARN_BYTES = 60 * 1024 * 1024;

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80);
}

function abs(relPath: string): string {
  // Prevent traversal: resolved path must stay under STORAGE_ROOT.
  const full = path.resolve(STORAGE_ROOT, relPath);
  if (!full.startsWith(STORAGE_ROOT)) throw new Error("invalid path");
  return full;
}

/** Yo'l shaklini ikkala drayverда bir xil tekshiramiz (db'да ham traversal yo'q). */
function normalizeRel(relPath: string): string {
  const rel = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel || rel.split("/").includes("..")) throw new Error("invalid path");
  return rel;
}

async function writeBlob(relPath: string, buffer: Buffer, mimeType?: string): Promise<string> {
  const rel = normalizeRel(relPath);
  if (buffer.byteLength > WARN_BYTES) {
    console.warn(`[storage] katta fayl (${Math.round(buffer.byteLength / 1024 / 1024)}MB): ${rel}`);
  }
  if (DRIVER === "db") {
    // Prisma Bytes `Uint8Array<ArrayBuffer>` kutadi — Buffer'ni shunga o'tkazamiz.
    const data = { data: new Uint8Array(buffer), size: buffer.byteLength, mimeType: mimeType ?? null };
    await prisma.fileBlob.upsert({ where: { path: rel }, create: { path: rel, ...data }, update: data });
    return rel;
  }
  const full = abs(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return rel;
}

/**
 * O'qish: avval joriy drayver, keyin ikkinchisi. Shu sababли drayver almashgach
 * eski fayllar ham topiladi (disk'da qolgan legacy, yoki dev'да bazadagi).
 */
async function readBlob(relPath: string): Promise<Buffer> {
  const rel = normalizeRel(relPath);
  if (DRIVER === "db") {
    const row = await prisma.fileBlob.findUnique({ where: { path: rel }, select: { data: true } });
    if (row) return Buffer.from(row.data);
    return readFile(abs(rel)); // legacy: hali diskda yotgan fayl
  }
  try {
    return await readFile(abs(rel));
  } catch (err) {
    const row = await prisma.fileBlob.findUnique({ where: { path: rel }, select: { data: true } });
    if (row) return Buffer.from(row.data);
    throw err;
  }
}

export async function saveMaterialFile(
  topicId: number,
  materialId: number,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const rel = path.posix.join("topics", String(topicId), `${materialId}_${safeName(fileName)}`);
  return writeBlob(rel, buffer);
}

export async function saveParsedText(topicId: number, materialId: number, text: string): Promise<string> {
  const rel = path.posix.join("topics", String(topicId), `${materialId}.txt`);
  return writeBlob(rel, Buffer.from(text, "utf8"), "text/plain; charset=utf-8");
}

export async function readFileBuffer(relPath: string): Promise<Buffer> {
  return readBlob(relPath);
}

export async function saveBytes(relPath: string, buffer: Buffer): Promise<string> {
  return writeBlob(relPath, buffer);
}

export async function readText(relPath: string): Promise<string> {
  return (await readBlob(relPath)).toString("utf8");
}

export async function deletePath(relPath: string): Promise<void> {
  const rel = normalizeRel(relPath);
  // Ikkala joydan ham — drayver almashgan bo'lsa qoldiq qolmasin.
  await prisma.fileBlob.deleteMany({ where: { path: rel } }).catch(() => undefined);
  try {
    await rm(abs(rel), { force: true });
  } catch {
    /* already gone */
  }
}

/** Fayl haqiqatan mavjudmi (UI "bor" deb ko'rsatib, keyin 500 bermasin). */
export async function fileExists(relPath: string): Promise<boolean> {
  try {
    await readBlob(relPath);
    return true;
  } catch {
    return false;
  }
}

export const storageDriver = DRIVER;
