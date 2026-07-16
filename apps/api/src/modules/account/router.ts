import { Router, type RequestHandler } from "express";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import { changePassword, setLocale } from "../me/profile";

// Account settings shared by every authenticated role (admin/teacher/student):
// personal info (read-only), interface language, and password.
export const accountRouter = Router();
accountRouter.use(requireRoles("SUPERADMIN", "FACULTY_ADMIN", "DEPT_ADMIN", "TEACHER", "STUDENT"));

const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

async function getAccount(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { group: true, teacherProfile: { include: { department: true } } },
  });
  if (!user) throw notFound("Foydalanuvchi");

  let contextType: "group" | "department" | null = null;
  let context: string | null = null;
  if (user.role === "STUDENT" && user.group) {
    contextType = "group";
    context = user.group.name;
  } else if (user.role === "TEACHER" && user.teacherProfile) {
    contextType = "department";
    context = user.teacherProfile.department.name;
  }

  return {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    locale: user.locale,
    contextType,
    context,
  };
}

accountRouter.get("/me", wrap(async (req, res) => res.json(await getAccount(req.user!.id))));
accountRouter.put("/locale", wrap(async (req, res) => res.json(await setLocale(req.user!.id, req.body?.locale))));
accountRouter.post("/change-password", wrap(async (req, res) => res.json(await changePassword(req.user!.id, req.body?.oldPassword, req.body?.newPassword))));
