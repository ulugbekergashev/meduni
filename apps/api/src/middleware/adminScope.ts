import type { Request } from "express";
import { prisma } from "../lib/prisma";
import type { Role } from "../lib/prisma";
import { forbidden } from "../lib/errors";

/** All admin tiers. */
export const ADMIN_ROLES: Role[] = ["SUPERADMIN", "FACULTY_ADMIN", "DEPT_ADMIN"];

export interface AdminScope {
  level: "SUPER" | "FACULTY" | "DEPT";
  /** Set for FACULTY and DEPT levels. */
  facultyId: number | null;
  /** Set for DEPT level only. */
  departmentId: number | null;
}

/**
 * Resolve the caller's admin scope. SUPERADMIN sees everything; FACULTY_ADMIN is
 * pinned to their faculty; DEPT_ADMIN to their department (and its faculty).
 * Scope lives on the user row (not the JWT) so demotions apply immediately.
 */
export async function adminScope(req: Request): Promise<AdminScope> {
  const auth = req.user!;
  if (auth.role === "SUPERADMIN") {
    return { level: "SUPER", facultyId: null, departmentId: null };
  }
  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { role: true, facultyId: true, adminDepartmentId: true, adminDepartment: { select: { facultyId: true } } },
  });
  if (!user) throw forbidden();
  if (user.role === "FACULTY_ADMIN") {
    if (!user.facultyId) throw forbidden("Fakultet biriktirilmagan", "Факультет не привязан");
    return { level: "FACULTY", facultyId: user.facultyId, departmentId: null };
  }
  if (user.role === "DEPT_ADMIN") {
    if (!user.adminDepartmentId) throw forbidden("Kafedra biriktirilmagan", "Кафедра не привязана");
    return { level: "DEPT", facultyId: user.adminDepartment?.facultyId ?? null, departmentId: user.adminDepartmentId };
  }
  throw forbidden();
}

/** Faculty-level check: SUPER passes; others must match the faculty. */
export function assertFacultyScope(scope: AdminScope, facultyId: number) {
  if (scope.level === "SUPER") return;
  if (scope.facultyId !== facultyId) throw forbidden("Bu sizning fakultetingiz emas", "Это не ваш факультет");
}

/** Department-level check: SUPER passes; FACULTY must own the dept's faculty; DEPT must match. */
export function assertDeptScope(scope: AdminScope, dept: { id: number; facultyId: number }) {
  if (scope.level === "SUPER") return;
  if (scope.level === "FACULTY") {
    if (scope.facultyId !== dept.facultyId) throw forbidden("Bu sizning fakultetingiz emas", "Это не ваш факультет");
    return;
  }
  if (scope.departmentId !== dept.id) throw forbidden("Bu sizning kafedrangiz emas", "Это не ваша кафедра");
}
