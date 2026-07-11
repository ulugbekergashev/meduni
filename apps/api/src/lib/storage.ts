import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

// Local dev storage. Prod would swap this for S3/MinIO (same function surface).
const STORAGE_ROOT = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80);
}

function abs(relPath: string): string {
  // Prevent traversal: resolved path must stay under STORAGE_ROOT.
  const full = path.resolve(STORAGE_ROOT, relPath);
  if (!full.startsWith(STORAGE_ROOT)) throw new Error("invalid path");
  return full;
}

export async function saveMaterialFile(
  topicId: number,
  materialId: number,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const rel = path.posix.join("topics", String(topicId), `${materialId}_${safeName(fileName)}`);
  const full = abs(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return rel;
}

export async function saveParsedText(topicId: number, materialId: number, text: string): Promise<string> {
  const rel = path.posix.join("topics", String(topicId), `${materialId}.txt`);
  const full = abs(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, text, "utf8");
  return rel;
}

export async function readFileBuffer(relPath: string): Promise<Buffer> {
  return readFile(abs(relPath));
}

export async function readText(relPath: string): Promise<string> {
  return readFile(abs(relPath), "utf8");
}

export async function deletePath(relPath: string): Promise<void> {
  try {
    await rm(abs(relPath), { force: true });
  } catch {
    /* already gone */
  }
}
