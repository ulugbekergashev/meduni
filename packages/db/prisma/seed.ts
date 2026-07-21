import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const seeds = [
    { fullName: "Super Admin", email: "admin@meduni.uz", pass: "admin123", role: "SUPERADMIN" },
    { fullName: "Fakultet Admin", email: "fakultet.admin@meduni.uz", pass: "admin123", role: "FACULTY_ADMIN" },
    { fullName: "Kafedra Admin", email: "kafedra.admin@meduni.uz", pass: "admin123", role: "DEPT_ADMIN" },
    { fullName: "O'qituvchi", email: "teacher.m11demo@meduni.uz", pass: "student123", role: "TEACHER" },
    { fullName: "Talaba", email: "student@meduni.uz", pass: "student123", role: "STUDENT" },
  ] as const;

  for (const s of seeds) {
    const passwordHash = await argon2.hash(s.pass);
    await prisma.user.upsert({
      where: { email: s.email },
      update: { passwordHash, role: s.role },
      create: {
        fullName: s.fullName,
        email: s.email,
        passwordHash,
        role: s.role,
        locale: "uz",
      },
    });
    console.log(`Tayyor: ${s.email} / ${s.pass} (${s.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
