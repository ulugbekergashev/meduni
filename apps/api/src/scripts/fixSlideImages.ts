/**
 * Rasmsiz qolgan slaydlarni TUZATADI (buyurtmachi 2026-08-02: "в некоторых
 * презентации слайды не видны, только текст").
 *
 * Sabab (o'lchandi): rasm modeli ketma-ket chaqiruvda 429 qaytaradi va slot
 * ERROR bo'lib qoladi — talaba esa matn-only slayd ko'radi. Kod tuzatildi
 * (urinishlar + provayder zanjiri + slotlar orasida pauza), lekin ALLAQACHON
 * ERROR bo'lgan slaydlar o'z-o'zidan tiklanmaydi — shu skript ularni qayta
 * yuritadi.
 *
 * Ishlatish (apps/api ichidan):
 *   npx tsx src/scripts/fixSlideImages.ts            # barcha taqdimotlar
 *   npx tsx src/scripts/fixSlideImages.ts 6 4        # faqat shu mavzular
 *
 * ⚠️ JONLI baza bilan ishlatilsa STORAGE_DRIVER=db bo'lishi SHART, aks holda
 * rasm mahalliy diskka tushadi va serverda ko'rinmaydi (§ PILOT TAYYORGARLIGI A).
 */
import "dotenv/config";
import { prisma } from "@meduni/db";
import { generateAllImages } from "../modules/content/presentation";
import type { Slide } from "../ai/types";

const POLL_MS = 4000;
const TIMEOUT_MS = 15 * 60 * 1000;

async function main() {
  const topicFilter = process.argv.slice(2).map(Number).filter(Number.isFinite);

  const items = await prisma.contentItem.findMany({
    where: { kind: "PRESENTATION", ...(topicFilter.length ? { topicId: { in: topicFilter } } : {}) },
    include: { presentation: true, topic: { include: { course: { select: { teacherId: true } } } } },
    orderBy: { id: "asc" },
  });

  for (const item of items) {
    const pres = item.presentation;
    const teacherId = item.topic.course.teacherId;
    if (!pres || !teacherId) continue;

    const slides = (pres.slidesJson as unknown as Slide[]) ?? [];
    const missing = slides.filter((s) => s.imageSlots?.[0]?.status !== "DONE").length;
    if (!missing) {
      console.log(`topic ${item.topicId}: barcha ${slides.length} slaydda rasm bor — o'tkazildi`);
      continue;
    }

    console.log(`topic ${item.topicId}: ${missing}/${slides.length} slaydda rasm yo'q → yaratilmoqda...`);
    await generateAllImages(pres.id, teacherId);

    // Fon-navbat tugashini kutamiz (skript navbat bilan bir jarayonda ishlaydi).
    const started = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const fresh = await prisma.presentation.findUnique({ where: { id: pres.id } });
      const cur = (fresh?.slidesJson as unknown as Slide[]) ?? [];
      const pending = cur.filter((s) => {
        const st = s.imageSlots?.[0]?.status;
        return st === "PENDING" || st === "PROCESSING";
      }).length;
      const done = cur.filter((s) => s.imageSlots?.[0]?.status === "DONE").length;
      process.stdout.write(`  ...tayyor ${done}/${cur.length}, navbatda ${pending}\n`);
      if (!pending) break;
      if (Date.now() - started > TIMEOUT_MS) {
        console.warn("  ⚠️ vaqt tugadi — qolganlari fonda davom etadi");
        break;
      }
    }

    const after = await prisma.presentation.findUnique({ where: { id: pres.id } });
    const cur = (after?.slidesJson as unknown as Slide[]) ?? [];
    const bad = cur.filter((s) => s.imageSlots?.[0]?.status !== "DONE");
    console.log(`topic ${item.topicId}: ${cur.length - bad.length}/${cur.length} rasm tayyor`);
    for (const s of bad) console.log(`   ✗ "${s.title.slice(0, 40)}" — ${s.imageSlots?.[0]?.error ?? "sabab yo'q"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
