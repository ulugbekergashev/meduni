// i18n kalitlarini tekshiradi: kodda ishlatilgan har `t("...")` uz.json va
// ru.json da bormi. Yo'q bo'lsa ekranda XOM KALIT ko'rinadi (masalan
// "student.elVideo") — 2026-08-03 da aynan shunday 32 ta kalit topilgan edi.
//   npm run i18n:check   (apps/web ichidan)
import fs from "fs";
import path from "path";

const root = "src";
const uz = JSON.parse(fs.readFileSync("src/messages/uz.json", "utf8"));
const ru = JSON.parse(fs.readFileSync("src/messages/ru.json", "utf8"));
const get = (o, p) => p.split(".").reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), o);

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.tsx?$/.test(e.name)) files.push(f);
  }
})(root);

const PREFIXED = /const\s*\{\s*t(?:\s*:\s*(\w+))?\s*\}\s*=\s*useTranslation\([^)]*keyPrefix:\s*"([^"]+)"/g;
const PLAIN = /const\s*\{\s*t(?:\s*:\s*(\w+))?\s*\}\s*=\s*useTranslation\(\s*\)/g;

const missing = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const prefixes = new Map();
  for (const m of src.matchAll(PREFIXED)) prefixes.set(m[1] ?? "t", m[2]);
  for (const m of src.matchAll(PLAIN)) prefixes.set(m[1] ?? "t", "");
  if (!prefixes.size) continue;

  for (const [alias, prefix] of prefixes) {
    const re = new RegExp("\\b" + alias + '\\("([^"`$]+)"', "g");
    for (const m of src.matchAll(re)) {
      const key = m[1];
      const full = prefix ? prefix + "." + key : key;
      const inUz = get(uz, full) !== undefined;
      const inRu = get(ru, full) !== undefined;
      if (!inUz || !inRu) missing.push({ file: f.split(path.sep).join("/"), key: full, inUz, inRu });
    }
  }
}

const uniq = [...new Map(missing.map((m) => [m.key, m])).values()];
console.log("YO'Q KALITLAR: " + uniq.length);
if (uniq.length) process.exitCode = 1;
for (const m of uniq) {
  const flags = [!m.inUz ? "uz" : null, !m.inRu ? "ru" : null].filter(Boolean).join("+");
  console.log("  " + m.key + "   [" + flags + " yo'q]   " + m.file.split("/").slice(-2).join("/"));
}
