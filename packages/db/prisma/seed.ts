import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "admin@meduni.uz" } });
  if (existing) {
    // Legacy seeds created the root account with the deprecated ADMIN role.
    if (existing.role !== "SUPERADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "SUPERADMIN" } });
      console.log("admin@meduni.uz roli SUPERADMIN'ga ko'tarildi.");
    } else {
      console.log("Сиды уже применены — пропускаю.");
    }
    return;
  }

  const passwordHash = await argon2.hash("admin123");
  await prisma.user.create({
    data: {
      fullName: "Administrator",
      email: "admin@meduni.uz",
      passwordHash,
      role: "SUPERADMIN",
      locale: "uz",
    },
  });

  console.log("Готово: admin@meduni.uz / admin123 (SUPERADMIN)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
