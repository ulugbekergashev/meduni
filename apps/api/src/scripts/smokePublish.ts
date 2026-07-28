/**
 * Chop etish oqimi tekshiruvi: "prosta tasdiqlab chop etib yuborsin".
 * Kontentni DRAFT + hech ochilmagan holatga tushirib, bitta chaqiruvda chop
 * etilishini tekshiradi. Oxirida boshlang'ich holat tiklanadi.
 *   npx tsx src/scripts/smokePublish.ts
 */
import { prisma } from "../lib/prisma";
import { publishContent } from "../modules/content/service";

async function main() {
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher.m11demo@meduni.uz" } });
  const item = await prisma.contentItem.findFirstOrThrow({ where: { topicId: 1 } });
  const before = { status: item.status, reviewOpenedAt: item.reviewOpenedAt, approvedAt: item.approvedAt };

  // "Endi generatsiya qilingan, tahrirlagichda umuman ochilmagan" holat.
  await prisma.contentItem.update({
    where: { id: item.id },
    data: { status: "DRAFT", reviewOpenedAt: null },
  });
  console.log("holat: DRAFT + tahrirlagichda ochilmagan");

  let ok = false;
  try {
    const out = await publishContent(item.id, teacher.id);
    ok = out.status === "published";
    console.log(`publishContent → ${out.status}`);
  } catch (e) {
    console.log("publishContent XATO:", (e as { code?: string; message?: string }).code ?? (e as Error).message);
  }

  const after = await prisma.contentItem.findUniqueOrThrow({ where: { id: item.id } });
  console.log("bazadagi holat:", after.status);

  // Boshlang'ich holatni tiklaymiz (demo buzilmasin).
  await prisma.contentItem.update({ where: { id: item.id }, data: before });
  const restored = await prisma.contentItem.findUniqueOrThrow({ where: { id: item.id } });
  console.log("tiklandi:", restored.status);

  console.log(ok ? "\nOK: bitta bosishda chop etildi" : "\nXATO: chop etilmadi");
  if (!ok) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
