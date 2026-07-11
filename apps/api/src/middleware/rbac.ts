import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../lib/errors";
import type { Role } from "../lib/prisma";

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
