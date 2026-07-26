/**
 * Storage drayveri smoke testi (db rejimi — prod'dagi kabi).
 *   npx tsx src/scripts/smokeStorage.ts
 */
process.env.STORAGE_DRIVER = "db";
import { prisma } from "../lib/prisma";

async function main() {
  const { saveBytes, readFileBuffer, readText, saveParsedText, saveMaterialFile, deletePath, fileExists, storageDriver } =
    await import("../lib/storage");

  let ok = 0;
  let fail = 0;
  const check = (name: string, cond: boolean) => {
    if (cond) {
      ok++;
      console.log(`  ✅ ${name}`);
    } else {
      fail++;
      console.log(`  ❌ ${name}`);
    }
  };

  check("drayver = db", storageDriver === "db");

  const bin = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10, 0x42]);
  const rel = await saveBytes("smoke/test/binary.png", bin);
  check("saveBytes yo'lni qaytardi", rel === "smoke/test/binary.png");

  const back = await readFileBuffer(rel);
  check("binar fayl bayt-bayt bir xil", Buffer.compare(back, bin) === 0);

  const txtRel = await saveParsedText(999_999, 888_888, "Yurak — to'rt kamerali mushak a'zo.");
  const txt = await readText(txtRel);
  check("matn UTF-8 saqlandi", txt === "Yurak — to'rt kamerali mushak a'zo.");

  const matRel = await saveMaterialFile(999_999, 888_888, "Konspekt (final).pdf", bin);
  check("material yo'li tozalandi", matRel === "topics/999999/888888_Konspekt_final_.pdf");

  const updated = await saveBytes(rel, Buffer.from("yangi"));
  check("qayta yozish (upsert) ishladi", (await readFileBuffer(updated)).toString() === "yangi");

  check("fileExists = true", await fileExists(rel));
  check("yo'q fayl uchun fileExists = false", !(await fileExists("smoke/yoq/fayl.bin")));

  let threw = false;
  try {
    await readFileBuffer("smoke/yoq/fayl.bin");
  } catch {
    threw = true;
  }
  check("yo'q faylni o'qish xato beradi (chaqiruvchi 404 qiladi)", threw);

  let traversal = false;
  try {
    await saveBytes("../../etc/passwd", bin);
  } catch {
    traversal = true;
  }
  check("traversal bloklandi", traversal);

  for (const p of [rel, txtRel, matRel]) await deletePath(p);
  check("o'chirish ishladi", !(await fileExists(rel)));

  const left = await prisma.fileBlob.count({ where: { path: { startsWith: "smoke/" } } });
  check("smoke qoldiqlari tozalandi", left === 0);

  console.log(`\n${fail === 0 ? "✅" : "❌"} storage smoke: ${ok}/${ok + fail}`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
