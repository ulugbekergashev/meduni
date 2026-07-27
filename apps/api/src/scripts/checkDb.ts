/** Qaysi bazaga ulanyapmiz va unda nima bor — tez tekshiruv. */
import { prisma } from "../lib/prisma";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  console.log("host:", url.split("@")[1] ?? "(DATABASE_URL yo'q)");

  const t = await prisma.$queryRawUnsafe<{ n: number }[]>(
    "select count(*)::int as n from information_schema.tables where table_schema='public'"
  );
  console.log("jadvallar:", t[0]?.n);

  const [users, courses, topics, blobs, attendance] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.topic.count(),
    prisma.fileBlob.count(),
    prisma.attendance.count(),
  ]);
  console.log({ users, courses, topics, fileBlobs: blobs, attendance });

  const t0 = Date.now();
  for (let i = 0; i < 5; i++) await prisma.$queryRawUnsafe("select 1");
  console.log(`5 ta bo'sh so'rov: ${Date.now() - t0}ms (~${Math.round((Date.now() - t0) / 5)}ms/so'rov)`);
}

main()
  .catch((e) => {
    console.error("XATO:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
