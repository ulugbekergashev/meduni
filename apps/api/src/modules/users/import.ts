import ExcelJS from "exceljs";
import argon2 from "argon2";
import type { Role } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { generatePassword } from "../../lib/password";

export interface ImportRowError {
  row: number;
  messageUz: string;
  messageRu: string;
}

export interface ImportResult {
  added: number;
  errors: ImportRowError[];
}

const HEADERS = ["fullName", "email", "role", "phone", "locale", "group"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  if (typeof value === "object" && "result" in value) return String(value.result).trim();
  return String(value).trim();
}

export async function importUsers(buffer: Buffer): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  // exceljs' .d.ts predates @types/node's generic Buffer; the value is a valid
  // Buffer at runtime, so cast past the nominal type mismatch.
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return { added: 0, errors: [{ row: 0, messageUz: "Fayl boʻsh", messageRu: "Файл пуст" }] };

  // Map header names -> column index from the first row.
  const headerRow = sheet.getRow(1);
  const colOf: Partial<Record<(typeof HEADERS)[number], number>> = {};
  headerRow.eachCell((cell, col) => {
    const name = cellText(cell.value).toLowerCase();
    const match = HEADERS.find((h) => h.toLowerCase() === name);
    if (match) colOf[match] = col;
  });

  const errors: ImportRowError[] = [];
  let added = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const get = (h: (typeof HEADERS)[number]) => (colOf[h] ? cellText(row.getCell(colOf[h]!).value) : "");

    const fullName = get("fullName");
    const email = get("email").toLowerCase();
    const roleRaw = get("role").toUpperCase();
    const phone = get("phone");
    const localeRaw = get("locale").toLowerCase();
    const groupName = get("group");

    // Skip fully empty rows silently.
    if (!fullName && !email && !roleRaw && !groupName) continue;

    if (!fullName) {
      errors.push({ row: r, messageUz: "FISH boʻsh", messageRu: "ФИО пусто" });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ row: r, messageUz: "Email notoʻgʻri", messageRu: "Неверный email" });
      continue;
    }
    if (roleRaw !== "STUDENT" && roleRaw !== "TEACHER") {
      errors.push({ row: r, messageUz: "Rol notoʻgʻri (STUDENT/TEACHER)", messageRu: "Неверная роль (STUDENT/TEACHER)" });
      continue;
    }
    const role = roleRaw as Role;

    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash) {
      errors.push({ row: r, messageUz: "Bu email band", messageRu: "Этот email занят" });
      continue;
    }

    let groupId: number | null = null;
    if (role === "STUDENT") {
      if (!groupName) {
        errors.push({ row: r, messageUz: "Talaba uchun guruh majburiy", messageRu: "Для студента группа обязательна" });
        continue;
      }
      const group = await prisma.studentGroup.findFirst({ where: { name: groupName } });
      if (!group) {
        errors.push({
          row: r,
          messageUz: `Guruh topilmadi: ${groupName}`,
          messageRu: `Группа не найдена: ${groupName}`,
        });
        continue;
      }
      groupId = group.id;
    }

    // TEACHER via import has no department column — skip to keep import simple/safe.
    if (role === "TEACHER") {
      errors.push({
        row: r,
        messageUz: "Oʻqituvchini import orqali qoʻshib boʻlmaydi (kafedra kerak)",
        messageRu: "Преподавателя нельзя добавить импортом (нужна кафедра)",
      });
      continue;
    }

    const passwordHash = await argon2.hash(generatePassword());
    await prisma.user.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        role,
        locale: localeRaw === "ru" ? "ru" : "uz",
        passwordHash,
        groupId,
      },
    });
    added++;
  }

  return { added, errors };
}
