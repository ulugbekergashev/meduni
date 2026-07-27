/**
 * BO'SH bazani to'liq ishlaydigan demo holatiga keltiradi (bitta buyruq).
 *
 * Ishlatish (masalan region ko'chirishda — yangi Supabase loyihasi):
 *   1) packages/db va apps/api dagi .env larda DATABASE_URL ni yangisiga almashtir
 *   2) cd packages/db && npx prisma db push        (sxema)
 *   3) cd apps/api && STORAGE_DRIVER=db npx tsx src/scripts/bootstrapLive.ts
 *
 * ⚠️ `STORAGE_DRIVER=db` MAJBURIY: aks holda material fayllari mahalliy diskka
 * yoziladi va serverда ko'rinmaydi (Render Free'da disk vaqtinchalik).
 *
 * Ketma-ketlik: birlamchi foydalanuvchilar → akademik tuzilma+kontent →
 * dars sahifasi kontenti (topic 2) → jonli demo (10 talaba, jadval, davomat...).
 * Har qadam idempotent — qayta ishga tushirish xavfsiz.
 */
import { spawnSync } from "child_process";
import path from "path";

const ROOT = path.resolve(__dirname, "../../../.."); // monorepo ildizi
const API = path.join(ROOT, "apps", "api");

const STEPS: { title: string; file: string; args?: string[]; cwd?: string }[] = [
  { title: "Birlamchi foydalanuvchilar (seed)", file: path.join(ROOT, "packages", "db", "prisma", "seed.ts") },
  { title: "Akademik tuzilma + kontent (demoRestore)", file: path.join(API, "src", "scripts", "demoRestore.ts") },
  { title: "Dars sahifasi kontenti (demoLesson, topic 2)", file: path.join(API, "src", "scripts", "demoLesson.ts"), args: ["2"] },
  { title: "Jonli demo (demoLive)", file: path.join(API, "src", "scripts", "demoLive.ts") },
];

function run(step: (typeof STEPS)[number]): boolean {
  console.log(`\n──────── ${step.title}`);
  const res = spawnSync("npx", ["tsx", step.file, ...(step.args ?? [])], {
    cwd: step.cwd ?? API,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? "db" },
  });
  return res.status === 0;
}

for (const step of STEPS) {
  if (!run(step)) {
    console.error(`\n❌ To'xtatildi: "${step.title}" bosqichi xato bilan tugadi.`);
    process.exit(1);
  }
}

console.log("\n✅ Baza tayyor. Endi tekshiring:");
console.log("   cd apps/api && PORT=8123 npx tsx src/index.ts");
console.log("   node <scratchpad>/smokeLive.mjs   (SMOKE_API=http://localhost:8123)");
