/**
 * Mavjud konspektlardagi BUZUQ bloklarni tuzatish (bir martalik/idempotent).
 *
 *   npx tsx src/scripts/fixDigests.ts          — nima o'zgarishini ko'rsatadi
 *   npx tsx src/scripts/fixDigests.ts --apply  — bazaga yozadi
 *
 * Sabab: AI ba'zan `list` blokini `items`siz (faqat `text` bilan) qaytargan;
 * talaba tomonida `items.map(...)` butun dars sahifasini oq ekranga aylantirgan.
 * Endi generatsiya/tahrirда normalizatsiya bor, bu skript esa ALLAQACHON
 * saqlangan yozuvlarni tozalaydi.
 */
import { prisma } from "../lib/prisma";
import { normalizeDigestBlocks } from "../modules/topics/service";
import type { DigestJson } from "../ai/types";

/** Kalit tartibiga bog'liq bo'lmagan taqqoslash — Postgres JSONB kalitlarni
 *  o'zi qayta tartiblaydi, shuning uchun oddiy JSON.stringify hamma yozuvni
 *  "o'zgargan" deb ko'rsatadi. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.topicDigest.findMany({
    include: { topic: { select: { title: true } } },
    orderBy: { topicId: "asc" },
  });

  let touched = 0;
  for (const row of rows) {
    const before = canonical(row.digestJson);
    const fixed = normalizeDigestBlocks(structuredClone(row.digestJson) as unknown as DigestJson);
    const after = canonical(fixed);
    if (before === after) continue;

    touched++;
    const sections = (fixed.sections ?? []).length;
    console.log(`topic ${row.topicId} — "${row.topic.title}" (${sections} bo'lim): bloklar tuzatildi`);
    if (apply) {
      await prisma.topicDigest.update({ where: { topicId: row.topicId }, data: { digestJson: fixed as object } });
    }
  }

  console.log(
    touched === 0
      ? `\nHammasi toza (${rows.length} konspekt tekshirildi).`
      : `\n${touched}/${rows.length} konspekt ${apply ? "TUZATILDI" : "tuzatishni kutmoqda (--apply bilan qayta ishga tushiring)"}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
