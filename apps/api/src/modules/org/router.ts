import { Router, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../../lib/errors";
import { requireRoles } from "../../middleware/rbac";
import * as svc from "./service";

export const orgRouter = Router();
orgRouter.use(requireRoles("ADMIN"));

// Helpers ---------------------------------------------------------------

function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Maʼlumotlar notoʻgʻri", "Неверные данные");
  }
  return parsed.data;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

function optionalId(raw: unknown): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

const wrap = (fn: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Schemas ---------------------------------------------------------------

// One language is enough; the missing one is mirrored from the other.
const nameOpt = { nameUz: z.string().trim().optional(), nameRu: z.string().trim().optional() };
const atLeastName = (d: { nameUz?: string; nameRu?: string }) => !!(d.nameUz || d.nameRu);
const nameMsg = { message: "Kamida bitta tilda nom kiriting / Введите название хотя бы на одном языке" };
const fillNames = <T extends { nameUz?: string; nameRu?: string }>(d: T) => ({
  ...d,
  nameUz: (d.nameUz || d.nameRu)!,
  nameRu: (d.nameRu || d.nameUz)!,
});

const facultyIn = z.object(nameOpt).refine(atLeastName, nameMsg).transform(fillNames);
const departmentIn = z.object({ facultyId: z.number().int().positive(), ...nameOpt }).refine(atLeastName, nameMsg).transform(fillNames);
const departmentUpdate = z.object({ facultyId: z.number().int().positive().optional(), ...nameOpt }).refine(atLeastName, nameMsg).transform(fillNames);
const subjectIn = z
  .object({ departmentId: z.number().int().positive(), ...nameOpt, description: z.string().trim().optional().nullable() })
  .refine(atLeastName, nameMsg)
  .transform(fillNames);
const subjectUpdate = z
  .object({ departmentId: z.number().int().positive().optional(), ...nameOpt, description: z.string().trim().optional().nullable() })
  .refine(atLeastName, nameMsg)
  .transform(fillNames);
const groupIn = z.object({
  facultyId: z.number().int().positive(),
  name: z.string().trim().min(1),
  yearOfStudy: z.number().int().min(1).max(6),
});
const groupUpdate = z.object({
  facultyId: z.number().int().positive().optional(),
  name: z.string().trim().min(1),
  yearOfStudy: z.number().int().min(1).max(6),
});

// Faculties -------------------------------------------------------------

orgRouter.get("/faculties", wrap(async (_req, res) => res.json(await svc.listFaculties())));
orgRouter.post("/faculties", wrap(async (req, res) =>
  res.status(201).json(await svc.createFaculty(parseBody(facultyIn, req.body)))
));
orgRouter.patch("/faculties/:id", wrap(async (req, res) =>
  res.json(await svc.updateFaculty(parseId(req.params.id), parseBody(facultyIn, req.body)))
));
orgRouter.delete("/faculties/:id", wrap(async (req, res) => {
  await svc.deleteFaculty(parseId(req.params.id));
  res.status(204).end();
}));

// Departments -----------------------------------------------------------

orgRouter.get("/departments", wrap(async (req, res) =>
  res.json(await svc.listDepartments(optionalId(req.query.facultyId)))
));
orgRouter.post("/departments", wrap(async (req, res) =>
  res.status(201).json(await svc.createDepartment(parseBody(departmentIn, req.body)))
));
orgRouter.patch("/departments/:id", wrap(async (req, res) =>
  res.json(await svc.updateDepartment(parseId(req.params.id), parseBody(departmentUpdate, req.body)))
));
orgRouter.delete("/departments/:id", wrap(async (req, res) => {
  await svc.deleteDepartment(parseId(req.params.id));
  res.status(204).end();
}));

// Subjects --------------------------------------------------------------

orgRouter.get("/subjects", wrap(async (req, res) =>
  res.json(await svc.listSubjects(optionalId(req.query.departmentId)))
));
orgRouter.post("/subjects", wrap(async (req, res) =>
  res.status(201).json(await svc.createSubject(parseBody(subjectIn, req.body)))
));
orgRouter.patch("/subjects/:id", wrap(async (req, res) =>
  res.json(await svc.updateSubject(parseId(req.params.id), parseBody(subjectUpdate, req.body)))
));
orgRouter.delete("/subjects/:id", wrap(async (req, res) => {
  await svc.deleteSubject(parseId(req.params.id));
  res.status(204).end();
}));

// Groups ----------------------------------------------------------------

orgRouter.get("/groups", wrap(async (req, res) =>
  res.json(await svc.listGroups(optionalId(req.query.facultyId)))
));
orgRouter.post("/groups", wrap(async (req, res) =>
  res.status(201).json(await svc.createGroup(parseBody(groupIn, req.body)))
));
orgRouter.patch("/groups/:id", wrap(async (req, res) =>
  res.json(await svc.updateGroup(parseId(req.params.id), parseBody(groupUpdate, req.body)))
));
orgRouter.delete("/groups/:id", wrap(async (req, res) => {
  await svc.deleteGroup(parseId(req.params.id));
  res.status(204).end();
}));
