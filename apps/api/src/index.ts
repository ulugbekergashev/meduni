import path from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env, isAllowedOrigin } from "./env";
import { textChain } from "./ai/config";
import { authMiddleware } from "./middleware/auth";
import { errorMiddleware } from "./middleware/error";
import { authRouter } from "./modules/auth/router";
import { orgRouter } from "./modules/org/router";
import { usersRouter } from "./modules/users/router";
import { coursesRouter } from "./modules/courses/router";
import { teachCoursesRouter } from "./modules/courses/teachRouter";
import { topicsRouter, materialsRouter } from "./modules/topics/router";
import { generateRouter, contentRouter, presentationsRouter, videosRouter } from "./modules/content/router";
import { meRouter } from "./modules/me/router";
import { accountRouter } from "./modules/account/router";
import { adminRouter } from "./modules/admin/router";
import { tasksRouter } from "./modules/tasks/router";
import { recoverStaleJobs } from "./modules/content/recovery";

const app = express();

// SERVE_WEB=1 — API o'zi qurilgan web'ni ham tarqatadi (bitta origin, demo/deploy).
// Bunda: CSP o'chiriladi (SPA + media bloklanmasin), rate-limit tunnel ortida
// yuqoriroq (barcha foydalanuvchi bitta IP'дан ko'rinadi).
const serveWeb = process.env.SERVE_WEB === "1";

// Render/Vercel/Cloudflare — hammasi reverse-proxy ortida. Busiz:
// (1) `secure` cookie'lar o'rnatilmaydi, (2) rate-limit hamma foydalanuvchini
// bitta proxy IP'si deb hisoblaydi (va express-rate-limit ogohlantirish beradi).
app.set("trust proxy", 1);

app.use(
  helmet({
    // SERVE_WEB rejimida SPA va media bloklanmasin.
    ...(serveWeb ? { contentSecurityPolicy: false as const } : {}),
    // ⚠️ Helmet sukut bo'yicha `Cross-Origin-Resource-Policy: same-origin`
    // qo'yadi. Web (*.vercel.app) va API (*.onrender.com) HAR XIL domenda
    // bo'lgani uchun bu brauzerga API'dan kelgan HAR QANDAY media'ni
    // bloklashni buyuradi: slayd rasmlari, video, PDF, audio —
    // `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`.
    // Resurslar baribir cookie-auth bilan himoyalangan (CORS origin ro'yxati
    // ham kuchda), shuning uchun cross-origin ruxsati xavfsiz.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ⚠️ CORS rate-limit'DAN OLDIN turishi SHART. Aks holda limit oshganda
// express-rate-limit 429 javobini CORS sarlavhalarisiz yuboradi va brauzer
// buni "No 'Access-Control-Allow-Origin' header" deb ko'rsatadi — ya'ni
// haqiqiy sabab (juda ko'p so'rov) butunlay yashirinib qoladi.
app.use(
  cors({
    // Ro'yxatdagi origin + shu loyihaning Vercel preview deploy'lari.
    origin(origin, cb) {
      // origin yo'q = same-origin / curl / mobil ilova — bloklamaymiz.
      if (!origin) return cb(null, true);
      if (isAllowedOrigin(origin)) return cb(null, true);
      // Xato TASHLAMAYMIZ (u 500 bo'lib logni to'ldiradi) — shunchaki CORS
      // sarlavhasini qo'ymaymiz: brauzer javobni o'zi bloklaydi.
      console.warn(`CORS: ruxsat etilmagan origin — ${origin}`);
      cb(null, false);
    },
    credentials: true,
  })
);

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  // SPA bitta sahifa ochilishida 10+ so'rov yuboradi (dashboard, vazifalar,
  // jadval, profil...). Ilgari bu yerda 100 turardi va faol foydalanishda
  // chegaraga urilardi. Prod'da (bitta origin / Vercel) yanada yuqori —
  // universitet Wi-Fi ortida ko'p talaba bitta IP'dan ko'rinishi mumkin.
  max: serveWeb || env.crossSiteCookies ? 2000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  // Preflight (OPTIONS) limitga kirmasin — u foydalanuvchi so'rovi emas.
  skip: (req) => req.method === "OPTIONS",
});
app.use(apiLimiter);

app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
// Specific routers first; the org router is mounted on the generic /api/v1
// prefix (and carries an ADMIN guard), so it must come LAST or it would
// intercept /api/v1/teach/* and 403 teachers before they reach their router.
app.use("/api/v1/me", meRouter);
app.use("/api/v1/account", accountRouter);
app.use("/api/v1/tasks", tasksRouter);
app.use("/api/v1/teach", teachCoursesRouter);
app.use("/api/v1/topics", topicsRouter);
app.use("/api/v1/topics", generateRouter);
app.use("/api/v1/materials", materialsRouter);
app.use("/api/v1/content", contentRouter);
app.use("/api/v1/presentations", presentationsRouter);
app.use("/api/v1/videos", videosRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/courses", coursesRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1", orgRouter);

// Qurilgan web'ni tarqatish (bitta origin). API/auth/health'дан tashqari GET
// so'rovlar — SPA index.html (react-router client-side yo'llar uchun).
if (serveWeb) {
  const webDist = process.env.WEB_DIST || path.resolve(__dirname, "../../web/dist");
  app.use(express.static(webDist));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path === "/health") return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
  console.log(`Serving web from ${webDist}`);
}

app.use(errorMiddleware);

// ⚠️ SERVERNI TIRIK SAQLASH. Node sukut bo'yicha ushlanmagan promise rad
// etilishida BUTUN jarayonni o'ldiradi — bitta so'rovdagi mayda xato tufayli
// hamma foydalanuvchi saytni yo'qotadi (Render'da bu qayta-qayta ko'tarilish
// halqasiga aylanadi: "Application loading" ~15 daqiqada bir marta).
// Xatoni YASHIRMAYMIZ — logga to'liq chiqaramiz, lekin jarayon o'lmaydi.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

app.listen(env.port, () => {
  console.log(`API ready on http://localhost:${env.port}`);
  // Deploy'da eng ko'p uchraydigan xato — noto'g'ri origin/cookie sozlamasi.
  // Shuning uchun ishga tushishda ochiq yozamiz (sekret yo'q).
  console.log(`  web origins : ${env.webOrigins.join(", ")}`);
  if (env.vercelProject) console.log(`  vercel prev : ${env.vercelProject}-*.vercel.app`);
  console.log(`  cookies     : ${env.crossSiteCookies ? "SameSite=None; Secure (cross-site)" : "SameSite=Lax"}`);
  // Matn provayderlari zanjiri — sozlama to'g'ri o'qilganini bir qarashda ko'rish
  // uchun (buyurtmachi: "Gemini kalit tugadi" xatosidan keyin).
  console.log(`  matn AI     : ${textChain("DIGEST").map((l) => l.name).join(" → ")}`);
  // Oldingi jarayonda uzilib qolgan video/rasm joblarini ERROR ga o'tkazamiz —
  // aks holda UI abadiy "ishlamoqda" spinnerini ko'rsatib turadi.
  //
  // ⚠️ KECHIKTIRILGAN (2026-08-02, jonli server o'lgach): tiklash og'ir ish
  // (montaj/TTS) boshlashi mumkin. Uni listen bilan BIR VAQTDA ishga tushirish
  // 512 MB / 0.1 CPU konteynerда birinchi soniyalardayoq event loop'ni bo'g'ib,
  // Render'ning health check'ini yiqitardi → konteyner o'ldiriladi → yana boot.
  // Endi server avval TINCH ko'tariladi, keyin tiklash boshlanadi.
  const delayMs = Number(process.env.RECOVERY_DELAY_MS ?? 30_000);
  setTimeout(() => void recoverStaleJobs(), delayMs).unref();
});
