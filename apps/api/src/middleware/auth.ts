import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { unauthorized } from "../lib/errors";
import type { Role } from "../lib/prisma";

export interface AuthUser {
  id: number;
  role: Role;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AuthUser;
    req.user = { id: payload.id, role: payload.role, email: payload.email };
  } catch {
    // invalid/expired token — leave req.user undefined, requireAuth/requireRoles will reject
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}
