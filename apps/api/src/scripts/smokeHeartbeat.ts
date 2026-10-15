// Bazasiz sinov: "yurak urishi" middleware'i + klient tahlili (lib/api.ts mantiqi).
process.env.HEARTBEAT_START_MS = "300";
process.env.HEARTBEAT_EVERY_MS = "200";
import express from "express";
import http from "node:http";
import { heartbeat } from "../middleware/heartbeat";
import { errorMiddleware } from "../middleware/error";
import { ApiError } from "../lib/errors";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const app = express();
app.use(express.json());
app.use(heartbeat);
app.post("/slow-ok", async (_req, res) => { await wait(1000); res.json({ ok: true, n: 1 }); });
app.post("/slow-err", async (_req, _res, next) => { await wait(1000); next(new ApiError(403, "ai_key_missing", "kalit yo'q", "нет ключа")); });
app.post("/slow-204", async (_req, res) => { await wait(1000); res.status(204).end(); });
app.post("/fast", (_req, res) => res.status(201).json({ fast: true }));
app.post("/fast-err", (_req, _res, next) => next(new ApiError(409, "dup", "band", "занято")));
app.get("/slow-get", async (_req, res) => { await wait(1000); res.json({ get: true }); });
app.use(errorMiddleware);

// lib/api.ts dagi tahlil mantiqining nusxasi
function clientParse(status: number, text: string) {
  if (status >= 400) return { thrown: true, status, body: JSON.parse(text) };
  if (status === 204) return { value: undefined };
  const data = JSON.parse(text);
  if (data && typeof data === "object" && Object.keys(data).length === 1 && data.error?.code && typeof data.error.messageUz === "string") {
    return { thrown: true, status: data.error.status ?? 500, code: data.error.code };
  }
  return { value: data };
}

let pass = 0, fail = 0;
const ok = (c: boolean, n: string) => { c ? pass++ : fail++; console.log(`${c ? "ok" : "!!"} ${n}`); };

const server = http.createServer(app).listen(0, async () => {
  const port = (server.address() as { port: number }).port;
  const call = async (method: string, path: string) => {
    const t0 = Date.now();
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined });
    const text = await r.text();
    return { status: r.status, text, hb: r.headers.get("x-accel-buffering") === "no", ms: Date.now() - t0 };
  };

  let r = await call("POST", "/slow-ok");
  ok(r.status === 200 && r.hb && /^\s+\{/.test(r.text), `sekin muvaffaqiyat: 200 + bo'shliqlar + JSON (${r.text.match(/^\s*/)![0].length} bo'shliq)`);
  ok(JSON.stringify(clientParse(r.status, r.text)) === JSON.stringify({ value: { ok: true, n: 1 } }), "klient: qiymat to'g'ri o'qiladi");

  r = await call("POST", "/slow-err");
  const pe = clientParse(r.status, r.text) as { thrown?: boolean; status?: number; code?: string };
  ok(r.status === 200 && pe.thrown === true && pe.status === 403 && pe.code === "ai_key_missing", "sekin xato: tanadan xato + asl status 403 tiklanadi");

  r = await call("POST", "/slow-204");
  ok(r.status === 200 && r.text.trim() === "null", "sekin 204: tana 'null' (JSON buzilmaydi)");

  r = await call("POST", "/fast");
  ok(r.status === 201 && !r.hb && r.text === '{"fast":true}', "tez javob: o'zgarishsiz (status 201, bo'shliq yo'q)");

  r = await call("POST", "/fast-err");
  ok(r.status === 409 && !r.hb && clientParse(r.status, r.text).thrown === true, "tez xato: oddiy 409 (o'zgarishsiz)");

  r = await call("GET", "/slow-get");
  ok(r.status === 200 && !r.hb && r.text === '{"get":true}', "GET: yurak urishi qo'llanmaydi");

  console.log(`\n${pass} ok, ${fail} xato`);
  server.close();
  process.exit(fail ? 1 : 0);
});
