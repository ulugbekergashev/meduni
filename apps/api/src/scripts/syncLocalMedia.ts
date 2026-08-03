/**
 * MAHALLIY diskdagi mediani JONLI xotiraga (file_blobs) ko'chiradi.
 *
 * ⚠️ NEGA KERAK (2026-08-03, buyurtmachi: "video muammosini to'g'irla"):
 * pipeline mahalliy mashinada ishga tushirilganda `STORAGE_DRIVER` sukut
 * bo'yicha `disk` bo'ladi — fayl `apps/api/storage/` ga tushadi, bazaga esa
 * faqat YO'L yoziladi. Natijada jonli serverда yozuv bor, fayl yo'q:
 * o'qituvchi panelida "Chop etilgan" turadi, talaba esa "Video hozircha
 * tayyor emas" ni ko'radi (o'lchandi: topic 7, /me/videos/5/audio → 404).
 *
 * Skript bazadagi barcha media yo'llarini tekshiradi va faqat YETISHMAYOTGAN
 * va mahalliy diskda MAVJUD bo'lganlarini yuklaydi.
 *
 * Ishlatish (apps/api ichidan):
 *   npx tsx src/scripts/syncLocalMedia.ts           # ko'rsatadi
 *   npx tsx src/scripts/syncLocalMedia.ts --apply   # yuklaydi
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "@meduni/db";
import type { ScriptSegment, Slide } from "../ai/types";

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve("storage");

interface Item {
  rel: string;
  what: string;
}

async function collect(): Promise<Item[]> {
  const out: Item[] = [];
  const push = (rel: string | null | undefined, what: string) => {
    if (rel) out.push({ rel, what });
  };

  for (const v of await prisma.video.findMany()) {
    push(v.audioUrl, `video ${v.id} ovoz`);
    push(v.mp4Url, `video ${v.id} mp4`);
    push(v.srtUrl, `video ${v.id} subtitr`);
    for (const [i, s] of (((v.scriptJson as unknown as ScriptSegment[]) ?? []) as ScriptSegment[]).entries()) {
      push(s.visualImageUrl, `video ${v.id} kadr ${i + 1}`);
      push(s.audioUrl, `video ${v.id} segment ${i + 1}`);
    }
  }
  for (const p of await prisma.presentation.findMany()) {
    for (const [i, sl] of (((p.slidesJson as unknown as Slide[]) ?? []) as Slide[]).entries()) {
      for (const slot of sl.imageSlots ?? []) push(slot.url, `taqdimot ${p.id} slayd ${i + 1}`);
    }
  }
  for (const m of await prisma.sourceMaterial.findMany()) {
    push(m.fileUrl, `material ${m.id} fayl`);
    push(m.parsedTextUrl, `material ${m.id} matn`);
  }
  for (const pod of await prisma.topicPodcast.findMany()) {
    push(pod.audioUrl, `podkast ${pod.id} ovoz`);
  }
  // Takrorlarni olib tashlaymiz.
  return [...new Map(out.map((i) => [i.rel, i])).values()];
}

async function main() {
  const items = await collect();
  console.log(`Bazada ${items.length} ta media yo'li bor. Tekshirilmoqda...\n`);

  let ok = 0;
  const missingBoth: Item[] = [];
  const uploadable: Item[] = [];

  for (const it of items) {
    const blob = await prisma.fileBlob.findUnique({ where: { path: it.rel }, select: { path: true } });
    if (blob) {
      ok++;
      continue;
    }
    const local = path.resolve(ROOT, it.rel);
    if (fs.existsSync(local)) uploadable.push(it);
    else missingBoth.push(it);
  }

  console.log(`  ✅ jonli xotirada bor : ${ok}`);
  console.log(`  ⬆️  mahalliy diskda bor (yuklash mumkin): ${uploadable.length}`);
  console.log(`  ❌ umuman yo'q        : ${missingBoth.length}`);

  for (const it of uploadable) console.log(`     ⬆️  ${it.what} — ${it.rel}`);
  for (const it of missingBoth) console.log(`     ❌ ${it.what} — ${it.rel}`);

  if (!APPLY) {
    console.log("\n(quruq ishga tushirish — --apply bilan yuklanadi)");
    return;
  }
  if (!uploadable.length) return;

  for (const it of uploadable) {
    const buf = fs.readFileSync(path.resolve(ROOT, it.rel));
    await prisma.fileBlob.upsert({
      where: { path: it.rel },
      create: { path: it.rel, data: buf, mimeType: mime(it.rel), size: buf.length },
      update: { data: buf, mimeType: mime(it.rel), size: buf.length },
    });
    console.log(`  yuklandi: ${it.rel} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  }
  console.log("\n✅ Tayyor");
}

function mime(rel: string): string {
  const e = path.extname(rel).toLowerCase();
  const map: Record<string, string> = {
    ".m4a": "audio/mp4", ".wav": "audio/wav", ".mp4": "video/mp4", ".mp3": "audio/mpeg",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    ".pdf": "application/pdf", ".srt": "text/plain", ".txt": "text/plain",
  };
  return map[e] ?? "application/octet-stream";
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
