import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";
import { subjectTeacherFilter } from "../topics/service";

// Faza 3 dan keyin kontent fanga tegishli — bu modul o'qituvchiga "Fanlarim"
// yuzasini beradi: kafedradagi (yoki o'zi dars beradigan) har fan bo'yicha
// kontent-pipeline holati bir qarashda.

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu fan sizga tegishli emas", "Этот предмет вам не принадлежит");
}

const pipelineInclude = {
  department: { select: { name: true } },
  topics: {
    orderBy: { orderIndex: "asc" as const },
    select: {
      id: true,
      status: true,
      materials: { select: { parseStatus: true } },
      digest: { select: { approvedByTeacher: true } },
      contentItems: { select: { status: true, factcheckStatus: true } },
    },
  },
};

type SubjectRow = {
  id: number;
  name: string;
  department: { name: string };
  topics: {
    id: number;
    status: string;
    materials: { parseStatus: string }[];
    digest: { approvedByTeacher: boolean } | null;
    contentItems: { status: string; factcheckStatus: string }[];
  }[];
};

/** Mavzularni pipeline bosqichlari bo'yicha jamlaydi (kartadagi chiplar uchun). */
function summarize(s: SubjectRow) {
  let published = 0;
  let inProgress = 0;
  let empty = 0;
  let materialMissing = 0;
  let digestPending = 0;
  let publishPending = 0;
  let factcheckFlagged = 0;

  for (const t of s.topics) {
    const hasPublished = t.contentItems.some((c) => c.status === "PUBLISHED");
    const hasAnything = t.contentItems.length > 0 || t.digest !== null || t.materials.length > 0;
    if (hasPublished) published++;
    else if (hasAnything) inProgress++;
    else empty++;

    const hasDoneMaterial = t.materials.some((m) => m.parseStatus === "DONE");
    if (!hasDoneMaterial) {
      materialMissing++;
      continue;
    }
    if (t.digest?.approvedByTeacher !== true) {
      digestPending++;
      continue;
    }
    if (!hasPublished) publishPending++;
    if (t.contentItems.some((c) => c.factcheckStatus === "FLAGGED")) factcheckFlagged++;
  }

  return {
    topicsTotal: s.topics.length,
    published,
    inProgress,
    empty,
    attention: { materialMissing, digestPending, publishPending, factcheckFlagged },
  };
}

/** GET /teach/subjects — o'qituvchi tahrirlay oladigan fanlar, pipeline xulosasi bilan. */
export async function listTeacherSubjects(teacherId: number) {
  const subjects = (await prisma.subject.findMany({
    where: subjectTeacherFilter(teacherId),
    include: pipelineInclude,
    orderBy: { name: "asc" },
  })) as unknown as SubjectRow[];

  // Back-nav / kurs konteksti: o'qituvchining shu fandagi kursi (bo'lsa).
  const myCourses = await prisma.course.findMany({
    where: { teacherId, subjectId: { in: subjects.map((s) => s.id) } },
    select: { id: true, subjectId: true },
    orderBy: { id: "asc" },
  });
  const myCourseBySubject = new Map<number, number>();
  for (const c of myCourses) {
    if (!myCourseBySubject.has(c.subjectId)) myCourseBySubject.set(c.subjectId, c.id);
  }

  return subjects.map((s) => ({
    id: s.id,
    name: s.name,
    departmentName: s.department.name,
    myCourseId: myCourseBySubject.get(s.id) ?? null,
    ...summarize(s),
  }));
}

/** GET /teach/subjects/:id — fan sahifasi shapkasi uchun metama'lumot. */
export async function getTeacherSubject(subjectId: number, teacherId: number) {
  const subject = (await prisma.subject.findFirst({
    where: { id: subjectId, ...subjectTeacherFilter(teacherId) },
    include: pipelineInclude,
  })) as unknown as SubjectRow | null;
  if (!subject) {
    const exists = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
    if (!exists) throw notFound("Fan");
    throw forbidden();
  }
  const myCourse = await prisma.course.findFirst({
    where: { teacherId, subjectId },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return {
    id: subject.id,
    name: subject.name,
    departmentName: subject.department.name,
    myCourseId: myCourse?.id ?? null,
    ...summarize(subject),
  };
}
