#!/usr/bin/env node
// PUSHDAN OLDINGI TEKSHIRUV (2026-10-31 auditidan keyin).
//
// Nega: `main` ga push ≤5 daqiqada productionga tushadi (avto-deploy, CLAUDE.md
// §28). 2026-10-31 dagi test baholash xatosi va undan keyin topilganlar
// (qayta topshirish blokda qolishi, kartochkada javob sizishi) aynan shunday
// tekshiruvsiz push'lar bilan productionga yetib borgan. Endi har push oldidan:
//   1) API va web tipizatsiyasi (tsc) — masalan, ekran indeksini asl indeks
//      o'rniga yozish endi kompilyatsiya xatosi (integrity.ts: ShownIndex/OriginalIndex);
//   2) regressiya sinovlari — MAHALLIY bazada (hech qachon jonli bazada emas).
//
// Ishlatish:  npm run check            (qo'lda)
//             .githooks/pre-push       (avtomatik, git push oldidan)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = path.join(root, "apps", "api");
const web = path.join(root, "apps", "web");

// ⛔ Sinovlar ma'lumot yozadi — shuning uchun FAQAT mahalliy baza. apps/api/.env
// jonli bazaga qaraydi, u bu yerda ataylab almashtiriladi.
const LOCAL_DB = process.env.CHECK_DATABASE_URL ?? "postgresql://meduni:meduni@localhost:5432/meduni";

/** Har biri mustaqil, o'zidan keyin tozalaydi, xatoda nol bo'lmagan kod bilan chiqadi. */
const SMOKES = [
  "smokeQuizIntegrity", // baholash snimkasi, remediation, sizish, o'tish balli
  "smokeQuizShuffle", // ekran ↔ asl indeks, eski urinishlarni tuzatish
  "smokeControl", // koridor siyosati
  "smokeExamPlan", // virtual bemor tekshiruv rejasi
  "smokePurge", // mavzu/kurs o'chirish
  "smokeDeleteWithResults",
  "smokeStorage",
  "smokeAttendance", // davomat foizi bitta joyda
  "smokeExcuseMakeup",
];

const isWin = process.platform === "win32";
function run(label, cmd, args, opts = {}) {
  const t0 = Date.now();
  // Windows'da npx .cmd — shell kerak; argumentlar statik, shuning uchun bitta qator.
  const r = isWin
    ? spawnSync([cmd, ...args].join(" "), { stdio: "pipe", encoding: "utf8", shell: true, ...opts })
    : spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", ...opts });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.status === 0) {
    console.log(`  ✓ ${label} (${sec}s)`);
    return true;
  }
  console.log(`  ✗ ${label} (${sec}s)\n`);
  console.log(((r.stdout ?? "") + (r.stderr ?? "")).split("\n").slice(-30).join("\n"));
  return false;
}

function dbReachable(url) {
  const u = new URL(url);
  return new Promise((resolve) => {
    const s = net.connect({ host: u.hostname, port: Number(u.port || 5432) });
    s.setTimeout(2000);
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
    s.once("timeout", () => (s.destroy(), resolve(false)));
  });
}

const failed = [];
console.log("1) Tipizatsiya");
if (!run("API tsc", "npx", ["tsc", "--noEmit", "-p", "."], { cwd: api })) failed.push("API tsc");
if (!run("Web tsc", "npx", ["tsc", "--noEmit", "-p", "."], { cwd: web })) failed.push("Web tsc");

console.log("2) Regressiya sinovlari (mahalliy baza)");
if (!(await dbReachable(LOCAL_DB))) {
  console.log(`  ✗ Mahalliy Postgres ishlamayapti (${new URL(LOCAL_DB).host}).`);
  console.log("    Ishga tushiring (Windows: postgresql-x64-17 xizmati) va qayta urining.");
  failed.push("local db");
} else {
  const env = { ...process.env, DATABASE_URL: LOCAL_DB, STORAGE_DRIVER: "disk" };
  for (const s of SMOKES) {
    if (!run(s, "npx", ["tsx", `src/scripts/${s}.ts`], { cwd: api, env })) failed.push(s);
  }
}

if (failed.length) {
  console.log(`\n✗ TO'XTATILDI: ${failed.join(", ")}. Tuzatmaguncha push qilinmaydi.`);
  process.exit(1);
}
console.log("\n✓ Hammasi o'tdi.");
