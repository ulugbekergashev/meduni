import { Router, type CookieOptions } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, unauthorized } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { issueTokens, verifyLogin, verifyRefreshToken } from "./service";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const cookieOpts: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function setAuthCookies(res: import("express").Response, accessToken: string, refreshToken: string) {
  res.cookie("access_token", accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie("refresh_token", refreshToken, { ...cookieOpts, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function toPublicUser(user: { id: number; fullName: string; email: string; role: string; locale: string }) {
  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    role: user.role.toLowerCase(),
    locale: user.locale,
  };
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Email va parolni kiriting", "Введите email и пароль");

    const user = await verifyLogin(parsed.data.email, parsed.data.password);
    const { accessToken, refreshToken } = issueTokens({ id: user.id, role: user.role, email: user.email });
    setAuthCookies(res, accessToken, refreshToken);
    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw unauthorized();

    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive) throw unauthorized();

    const { accessToken, refreshToken } = issueTokens({ id: user.id, role: user.role, email: user.email });
    setAuthCookies(res, accessToken, refreshToken);
    res.json(toPublicUser(user));
  } catch {
    next(unauthorized());
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("access_token", cookieOpts);
  res.clearCookie("refresh_token", cookieOpts);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw unauthorized();
    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
});
