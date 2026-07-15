import { Router, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import { ADMIN_ROLES, adminScope, assertDeptScope, type AdminScope } from "../../middleware/adminScope";
import { prisma } from "../../lib/prisma";
import * as svc from "./service";

export const coursesRouter = Router();
coursesRouter.use(requireRoles(...ADMIN_ROLES));

/** Assert the course's subject department is inside the admin's scope. */
async function assertCourseInScope(scope: AdminScope, courseId: number) {
  if (scope.level === "SUPER") return;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { subject: { select: { department: { select: { id: true, facultyId: true } } } } },
  });
  if (!course) throw notFound("Kurs");
  assertDeptScope(scope, course.subject.department);
}

/** Check the subject (by id) is inside the admin's scope. */
async function assertSubjectInScope(scope: AdminScope, subjectId: number) {
  if (scope.level === "SUPER") return;
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { department: { select: { id: true, facultyId: true } } },
  });
  if (!subject) throw notFound("Fan");
  assertDeptScope(scope, subject.department);
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
  subjectId: z.number().int().positive(),
  teacherId: z.number().int().positive(),
  semester: z.number().int().min(1).max(8),
  academicYear: z.string().trim().min(1),
  groupIds: z.array(z.number().int().positive()).min(1),
});

const updateSchema = z.object({
  subjectId: z.number().int().positive().optional(),
  teacherId: z.number().int().positive().optional(),
  semester: z.number().int().min(1).max(8).optional(),
  academicYear: z.string().trim().min(1).optional(),
  groupIds: z.array(z.number().int().positive()).optional(),
});

coursesRouter.get("/", wrap(async (req, res) => {
  const scope = await adminScope(req);
  const where =
    scope.level === "SUPER"
      ? undefined
      : scope.level === "FACULTY"
        ? { subject: { department: { facultyId: scope.facultyId! } } }
        : { subject: { departmentId: scope.departmentId! } };
  res.json(await svc.listCourses(where));
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
    await assertSubjectInScope(scope, body.subjectId);
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
    if (body.subjectId) await assertSubjectInScope(scope, body.subjectId);
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
