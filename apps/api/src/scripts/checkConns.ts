/** Bazaga nechta ulanish ochiq — Supabase pooler limiti (15) tekshiruvi. */
import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ state: string; n: bigint }[]>(
    `select coalesce(state,'?') as state, count(*)::bigint as n
     from pg_stat_activity where datname = current_database() group by 1 order by 2 desc`
  );
  let total = 0n;
  for (const r of rows) {
    total += r.n;
    console.log(`  ${r.state}: ${r.n}`);
  }
  console.log(`  JAMI: ${total}  (Supabase Session pooler limiti ~15)`);
}

main()
  .catch((e) => console.error("XATO:", e.message))
  .finally(() => prisma.$disconnect());
