/**
 * Bazadagi "idle" sessiyalarni bo'shatish.
 *
 *   npx tsx src/scripts/freeConns.ts           — kim ulanganini ko'rsatadi
 *   npx tsx src/scripts/freeConns.ts --kill    — idle sessiyalarni uzadi
 *
 * ⚠️ Nega kerak: Supabase Session pooler butun loyihaga ~15 mijoz beradi.
 * Konteyner qayta-qayta ko'tarilsa (crash loop) yoki dev serverlar ochiq
 * qolsa, idle sessiyalar to'planib limitni yeydi va YANGI ulanish (jumladan
 * prod serverning ishga tushishi) mumkin bo'lmay qoladi.
 */
import { prisma } from "../lib/prisma";

interface Row {
  pid: number;
  state: string | null;
  client_addr: string | null;
  application_name: string | null;
  idle_sec: number | null;
}

async function main() {
  const kill = process.argv.includes("--kill");

  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `select pid, state, host(client_addr) as client_addr, application_name,
            extract(epoch from (now() - state_change))::int as idle_sec
     from pg_stat_activity
     where datname = current_database() and pid <> pg_backend_pid()
     order by state, idle_sec desc nulls last`
  );

  console.log(`  Jami sessiya: ${rows.length}`);
  for (const r of rows) {
    console.log(
      `   pid=${r.pid} ${r.state ?? "?"} idle=${r.idle_sec ?? "?"}s addr=${r.client_addr ?? "-"} app=${r.application_name || "-"}`
    );
  }

  if (!kill) {
    const idle = rows.filter((r) => r.state === "idle");
    console.log(`\n  ${idle.length} ta idle sessiya bor. Uzish uchun: --kill`);
    return;
  }

  const victims = rows.filter((r) => r.state === "idle" && (r.idle_sec ?? 0) > 30);
  for (const v of victims) {
    await prisma.$queryRawUnsafe(`select pg_terminate_backend(${v.pid})`).catch(() => undefined);
  }
  console.log(`\n  ${victims.length} ta idle sessiya uzildi.`);

  const after = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `select count(*)::bigint as n from pg_stat_activity where datname = current_database()`
  );
  console.log(`  Qolgan sessiya: ${after[0]?.n}`);
}

main()
  .catch((e) => console.error("XATO:", e.message))
  .finally(() => prisma.$disconnect());
