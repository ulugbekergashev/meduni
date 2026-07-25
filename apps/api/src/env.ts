import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Web bir necha origin'da turishi mumkin (Vercel: prod domen + preview
// deploy'lar + o'z domeningiz). WEB_ORIGIN vergul bilan ajratilgan ro'yxat.
const webOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Vercel preview deploy'lari har push'da yangi subdomen oladi
// (meduni-git-<branch>-<user>.vercel.app) — ularni doim qo'lda yozib
// bo'lmaydi. VERCEL_PROJECT="meduni" bo'lsa shu prefiksli *.vercel.app
// origin'lariga ruxsat beriladi (prod domen baribir WEB_ORIGIN'da bo'ladi).
const vercelProject = process.env.VERCEL_PROJECT?.trim() || null;

export const env = {
  port: Number(process.env.PORT ?? 8000),
  webOrigins,
  /** Birinchi origin — havola yasash kerak bo'lganda (email, redirect). */
  webOrigin: webOrigins[0],
  vercelProject,
  /**
   * Web va API HAR XIL domenda (Vercel ↔ Render) bo'lsa cookie'lar
   * "cross-site" bo'ladi → SameSite=None + Secure SHART, aks holda
   * brauzer login cookie'sini umuman saqlamaydi.
   * Bitta origin (SERVE_WEB=1 yoki dev) bo'lsa — Lax qulayroq/xavfsizroq.
   */
  crossSiteCookies: process.env.CROSS_SITE_COOKIES === "1",
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
};

/** CORS: ro'yxatdagi origin yoki shu loyihaning Vercel preview'i bo'lsa — ruxsat. */
export function isAllowedOrigin(origin: string): boolean {
  const clean = origin.replace(/\/$/, "");
  if (webOrigins.includes(clean)) return true;
  if (!vercelProject) return false;
  return new RegExp(`^https://${vercelProject}-[a-z0-9-]+\\.vercel\\.app$`, "i").test(clean);
}
