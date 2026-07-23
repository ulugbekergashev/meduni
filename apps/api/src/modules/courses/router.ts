import { Router, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import { ADMIN_ROLES, adminScope, assertDeptScope, type AdminScope } from "../../middleware/adminScope";
import { prisma, type Prisma } from "../../lib/prisma";
import * as svc from "./service";

export const coursesRouter = Router();
coursesRouter.use(requireRoles(...ADMIN_ROLES));

async function assertCourseInScope(scope: AdminScope, courseId: number) {
  if (scope.level === "SUPER") return;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { department: { select: { id: true, facultyId: true } } },
  });
  if (!course) throw notFound("Kurs");
  assertDeptScope(scope, course.department);
}

async function assertDepartmentInScope(scope: AdminScope, departmentId: number) {
  if (scope.level === "SUPER") return;
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, facultyId: true },
  });
  if (!department) throw notFound("Kafedra");
  assertDeptScope(scope, department);
}

const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest("Maʼlumotlar notoʻgʻri", "Неверные данные");
  return parsed.data;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  departmentId: z.number().int().positive(),
  teacherId: z.number().int().positive(),
  semester: z.number().int().min(1).max(8),
  academicYear: z.string().trim().min(1),
  groupIds: z.array(z.number().int().positive()).min(1),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  departmentId: z.number().int().positive().optional(),
  teacherId: z.number().int().positive().optional(),
  semester: z.number().int().min(1).max(8).optional(),
  academicYear: z.string().trim().min(1).optional(),
  groupIds: z.array(z.number().int().positive()).optional(),
});

async function scopeWhere(req: Parameters<typeof adminScope>[0]) {
  const scope = await adminScope(req);
  if (scope.level === "SUPER") return {};
  if (scope.level === "FACULTY") return { department: { facultyId: scope.facultyId! } };
  return { departmentId: scope.departmentId! };
}

coursesRouter.get("/", wrap(async (req, res) => {
  const base = await scopeWhere(req);
  const and: Prisma.CourseWhereInput[] = [base];
  const year = typeof req.query.academicYear === "string" ? req.query.academicYear.trim() : "";
  const semester = Number(req.query.semester);
  const departmentId = Number(req.query.departmentId);
  const teacherId = Number(req.query.teacherId);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (year) and.push({ academicYear: year });
  if (Number.isInteger(semester) && semester > 0) and.push({ semester });
  if (Number.isInteger(departmentId) && departmentId > 0) and.push({ departmentId });
  if (Number.isInteger(teacherId) && teacherId > 0) and.push({ teacherId });
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { teacher: { fullName: { contains: search, mode: "insensitive" } } },
        { courseGroups: { some: { group: { name: { contains: search, mode: "insensitive" } } } } },
      ],
    });
  }
  res.json(await svc.listCourses({ AND: and }));
}));

coursesRouter.get("/periods", wrap(async (req, res) => {
  res.json(await svc.listCoursePeriods(await scopeWhere(req)));
}));

coursesRouter.get("/:id", wrap(async (req, res) => {
  const scope = await adminScope(req);
  const id = parseId(req.params.id);
  await assertCourseInScope(scope, id);
  res.json(await svc.getCourseDetail(id));
}));

coursesRouter.get(
  "/:id/students",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const id = parseId(req.params.id);
    await assertCourseInScope(scope, id);
    res.json(await svc.listCourseStudents(id));
  })
);

coursesRouter.post(
  "/",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const body = parseBody(createSchema, req.body);
    await assertDepartmentInScope(scope, body.departmentId);
    res.status(201).json(await svc.createCourse(body));
  })
);

coursesRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const id = parseId(req.params.id);
    await assertCourseInScope(scope, id);
    const body = parseBody(updateSchema, req.body);
    if (body.departmentId) await assertDepartmentInScope(scope, body.departmentId);
    res.json(await svc.updateCourse(id, body));
  })
);

coursesRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const scope = await adminScope(req);
    const id = parseId(req.params.id);
    await assertCourseInScope(scope, id);
    await svc.deleteCourse(id);
    res.status(204).end();
  })
);
