import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../../env";
import { prisma } from "../../lib/prisma";
import { unauthorized } from "../../lib/errors";
import type { AuthUser } from "../../middleware/auth";

const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

export async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw unauthorized();

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) throw unauthorized();

  return user;
}

export function issueTokens(user: AuthUser) {
  const payload: AuthUser = { id: user.id, role: user.role, email: user.email };
  const accessToken = jwt.sign(payload, env.jwtAccessSecret, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: REFRESH_TTL });
  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): AuthUser {
  return jwt.verify(token, env.jwtRefreshSecret) as AuthUser;
}
