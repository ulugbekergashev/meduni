/**
 * Demo yordamchisi — mavzuning BARCHA kontentini chop etadi (DRAFT → PUBLISHED).
 *
 * Nima uchun kerak: demo bazasida test/keys/prezentatsiya o'qituvchi tomonidan
 * chop etilmagan holda qolib ketgan edi — talaba dars sahifasida ularni umuman
 * ko'rmasdi ("prezentatsiya vabshe yo'q"). Odatdagi oqimda buni o'qituvchi
 * konstruktordagi "Tasdiqlash va chop etish" tugmasi bilan qiladi; bu skript
 * o'sha yozuvni (status + approvedBy/At) demo uchun qo'yadi.
 *
 * ⚠️ mp4 tayyor bo'lmagan VIDEO chop etilmaydi — talaba uchun u kontent emas.
 *
 * Ishlatish:  npx tsx src/scripts/demoPublishTopic.ts <topicId> [...topicId]
 */
import { prisma } from "../lib/prisma";

async function publishTopic(topicId: number) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { contentItems: { include: { video: true } }, course: { select: { name: true, teacherId: true } } },
  });
  if (!topic) {
    console.log(`#${topicId} — mavzu topilmadi`);
    return;
  }
  const teacherId = topic.course.teacherId;

  for (const item of topic.contentItems) {
    if (item.status === "PUBLISHED") {
      console.log(`  ${item.kind}: allaqachon chop etilgan`);
      continue;
    }
    if (item.kind === "VIDEO" && !item.video?.mp4Url) {
      console.log(`  ${item.kind}: mp4 tayyor emas (build=${item.video?.buildStatus}) — o'tkazib yuborildi`);
      continue;
    }
    await prisma.contentItem.update({
      where: { id: item.id },
      data: { status: "PUBLISHED", approvedById: teacherId, approvedAt: new Date() },
    });
    console.log(`  ${item.kind}: chop etildi`);
  }

  // Mavzuning o'zi ham ko'rinadigan bo'lsin.
  if (topic.status !== "PUBLISHED") {
    await prisma.topic.update({ where: { id: topicId }, data: { status: "PUBLISHED" } });
    console.log("  mavzu: PUBLISHED");
  }
}

(async () => {
  const ids = process.argv.slice(2).map(Number).filter(Number.isInteger);
  if (ids.length === 0) {
    console.error("Foydalanish: npx tsx src/scripts/demoPublishTopic.ts <topicId> [...]");
    process.exit(1);
  }
  for (const id of ids) {
    console.log(`\n=== Mavzu #${id} ===`);
    await publishTopic(id);
  }
  await prisma.$disconnect();
})();
