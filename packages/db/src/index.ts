import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Ulanishlar sonini ANIQ cheklaymiz.
 *
 * ⚠️ Supabase Session pooler butun loyihaga ~15 ta mijoz beradi. Prisma esa
 * sukut bo'yicha `CPU_soni * 2 + 1` ta ulanish ochadi — ko'p yadroli hostда bu
 * bir o'zi limitni yeb qo'yadi va API "FATAL: (EMAXCONNSESSION) max clients
 * reached in session mode" bilan yiqiladi (dev mashinasi ham shu bazaga ulansa,
 * yanada tezroq). Shuning uchun URL'ga `connection_limit` qo'shamiz — URL'da
 * allaqachon bo'lsa tegilmaydi, ya'ni Render'дан sozlash imkoni qoladi.
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", process.env.DB_CONNECTION_LIMIT ?? "5");
    }
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    return raw; // noto'g'ri URL — Prisma o'zi tushunarli xato beradi
  }
}

const url = datasourceUrl();

export const prisma = globalThis.__prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export * from "@prisma/client";
