import type { RequestHandler } from "express";

/**
 * Uzoq so'rovlar uchun "yurak urishi" (2026-10-15).
 *
 * Universitet serveri oldidagi tashqi nginx (bizning nazoratimizda emas)
 * `proxy_read_timeout` = 60s. AI generatsiyasi 60s dan oshsa nginx 504 qaytarardi,
 * ish esa serverda davom etib, natija KEYIN saqlanardi — foydalanuvchi xato ko'rib,
 * qayta bosardi (ikki marta pul sarfi).
 *
 * Yechim: javob 20s ichida tayyor bo'lmasa 200 sarlavhalarini yuboramiz va har
 * 15s da bitta bo'shliq yozamiz — nginx taymeri har o'qishda nolga qaytadi.
 * JSON oldidagi bo'shliqlar haqiqiy JSON. Sarlavha ketgach statusni o'zgartirib
 * bo'lmaydi, shuning uchun xato TANADA keladi: `{ error: { ..., status } }` —
 * `apps/web/src/lib/api.ts` 2xx javobdagi yolg'iz `error` ni xato deb taniydi.
 *
 * Tez javoblar (deyarli hammasi) bunga UMUMAN tegmaydi. GET va fayl yuklash
 * (multipart — so'rov tanasi hali kelayotgan bo'lishi mumkin) chetlab o'tiladi.
 */
// Env faqat sinov uchun (smoke) — productionda sukut qiymatlar. Chaqiruv paytida o'qiladi.
const startMs = () => Number(process.env.HEARTBEAT_START_MS) || 20_000;
const everyMs = () => Number(process.env.HEARTBEAT_EVERY_MS) || 15_000;

export const heartbeat: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS" || req.is("multipart/form-data")) {
    return next();
  }

  let timer: NodeJS.Timeout | null = null;
  let beating = false;
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const tick = () => {
    timer = null;
    if (res.writableEnded || res.destroyed) return;
    if (!beating) {
      if (res.headersSent) return; // kimdir allaqachon javob yozyapti — aralashmaymiz
      beating = true;
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
    }
    res.write(" ");
    timer = setTimeout(tick, everyMs());
  };
  timer = setTimeout(tick, startMs());
  res.on("finish", stop);
  res.on("close", stop);

  const origJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    stop();
    if (!beating) return origJson(body);
    // `res.status(x)` sarlavhadan keyin ham `statusCode` ni o'zgartiradi (simga ta'sirsiz) —
    // shu orqali xatoni taniymiz va statusni tanaga ko'chiramiz.
    const status = res.statusCode;
    let payload = body;
    if (status >= 400 && body && typeof body === "object" && "error" in body) {
      payload = { error: { ...(body as { error: Record<string, unknown> }).error, status } };
    }
    res.end(JSON.stringify(payload ?? null));
    return res;
  }) as typeof res.json;

  // `res.status(204).end()` kabi tanasiz javob: bo'shliqlardan keyin JSON bo'lishi shart.
  const origEnd = res.end.bind(res) as (...args: unknown[]) => typeof res;
  res.end = ((...args: unknown[]) => {
    stop();
    if (beating && (args.length === 0 || args[0] == null || typeof args[0] === "function")) {
      return origEnd("null");
    }
    return origEnd(...args);
  }) as typeof res.end;

  next();
};
