// DAVOMAT NAZORATI — dekanat ekrani (Davomat 2.0 · F5).
//
// ⚠️ NEGA (buyurtmachi va §22 "stat dietasi"): dekanatga o'rtacha foizlar
// galereyasi kerak emas. Unga kerak bo'lgan javob bitta: KIM koridordan chiqdi
// va NIMA QILISH kerak. Shuning uchun bu yerda ikkita ro'yxat bor —
// belgilanmagan darslar (o'qituvchining ishi) va xavf ro'yxati (talabaning
// ishi), ikkalasi ham ISMLAR bilan.
//
// Hisob `attendance/facts.ts` dan (yagona formula), sikllar `timetable.ts` dan.
import { prisma } from "../../lib/prisma";
import { dayKey } from "../../lib/time";
import type { AdminScope } from "../../middleware/adminScope";
import { type AttZone, attendanceLimits, attendancePct, tallyByStudent } from "../attendance/facts";
import { termAt } from "../attendance/calendar";
import { resolvePolicy } from "../policy/service";

/** Scope → kurs filtri (fakultet admini o'z fakulteti kafedralarini ko'radi). */
function courseWhere(scope: AdminScope) {
  if (scope.level === "SUPER") return {};
  if (scope.level === "FACULTY") return { department: { facultyId: scope.facultyId! } };
  return { departmentId: scope.departmentId! };
}

export interface GroupRow {
  groupId: number;
  groupName: string;
  facultyName: string;
  studentCount: number;
  /** Belgilangan darslar (yozuvlari bor). */
  markedLessons: number;
  /** O'tgan, lekin BELGILANMAGAN darslar — o'qituvchining qarzi. */
  unmarkedLessons: number;
  attendancePct: number | null;
  atRisk: number;
}

export interface RiskRow {
  studentId: number;
  studentName: string;
  groupId: number | null;
  groupName: string | null;
  courseId: number;
  courseName: string;
  teacherName: string;
  unexcusedHours: number;
  limitHours: number;
  remainingHours: number;
  zone: AttZone;
  /** Sikl bo'lsa — mehmon guruh belgisi. */
  isGuest: boolean;
}

export interface CycleRow {
  cycleId: number;
  courseName: string;
  departmentName: string;
  groupName: string;
  facultyName: string;
  isGuest: boolean;
  startKey: string;
  endKey: string;
  status: string;
  studentCount: number;
}

export interface AttendanceControl {
  period: { academicYear: string; semester: number; startKey: string; endKey: string } | null;
  totals: { groups: number; students: number; unmarkedLessons: number; atRisk: number; blocked: number };
  groups: GroupRow[];
  risk: RiskRow[];
  cycles: CycleRow[];
}

/**
 * Dekanat uchun to'liq manzara. Bitta chaqiruv — sahifada tab almashganda
 * qayta so'rov ketmasin (ma'lumot bir-biriga bog'liq: guruh → xavf → sikl).
 */
export async function getAttendanceControl(scope: AdminScope): Promise<AttendanceControl> {
  const courses = await prisma.course.findMany({
    where: courseWhere(scope),
    select: {
      id: true,
      name: true,
      plannedHours: true,
      departmentId: true,
      department: { select: { name: true } },
      teacher: { select: { fullName: true } },
      courseGroups: { select: { groupId: true, group: { select: { id: true, name: true, faculty: { select: { name: true } } } } } },
    },
  });
  const period = await termAt();

  // Guruhlar — kurslar orqali (dekanat o'z fakulteti guruhlarini ko'radi,
  // ⚠️ mehmon sikllarida BOSHQA fakultet guruhi ham chiqadi: u shu kafedrada
  // o'qiyapti, ya'ni bu kafedra uchun nazorat obyekti).
  const groupMap = new Map<number, { name: string; facultyName: string; courseIds: number[] }>();
  for (const c of courses) {
    for (const cg of c.courseGroups) {
      let g = groupMap.get(cg.groupId);
      if (!g) {
        g = { name: cg.group.name, facultyName: cg.group.faculty.name, courseIds: [] };
        groupMap.set(cg.groupId, g);
      }
      g.courseIds.push(c.id);
    }
  }
  const groupIds = [...groupMap.keys()];

  const students = groupIds.length
    ? await prisma.user.findMany({
        where: { role: "STUDENT", isActive: true, groupId: { in: groupIds } },
        select: { id: true, fullName: true, groupId: true },
      })
    : [];
  const byGroup = new Map<number, typeof students>();
  for (const s of students) {
    if (s.groupId == null) continue;
    const arr = byGroup.get(s.groupId) ?? [];
    arr.push(s);
    byGroup.set(s.groupId, arr);
  }

  // Har (kurs, guruh) uchun koridor — bitta o'tishda.
  const risk: RiskRow[] = [];
  const riskByGroup = new Map<number, number>();
  const policyCache = new Map<number, Awaited<ReturnType<typeof resolvePolicy>>>();
  const guestPairs = new Set<string>();

  const cycles = await prisma.courseCycle.findMany({
    where: { course: courseWhere(scope), status: { not: "CANCELLED" } },
    include: {
      course: { select: { name: true, department: { select: { name: true } } } },
      group: { select: { name: true, faculty: { select: { name: true } } } },
    },
    orderBy: { startDate: "desc" },
    take: 100,
  });
  for (const c of cycles) if (c.isGuest) guestPairs.add(`${c.courseId}:${c.groupId}`);

  for (const c of courses) {
    let policy = policyCache.get(c.departmentId);
    if (!policy) {
      policy = await resolvePolicy(c.departmentId);
      policyCache.set(c.departmentId, policy);
    }
    const corridor = {
      maxUnexcusedPct: policy.maxUnexcusedPct,
      warnUnexcusedPct: policy.warnUnexcusedPct,
      makeupClearsAbsence: policy.makeupClearsAbsence,
    };
    for (const cg of c.courseGroups) {
      const list = byGroup.get(cg.groupId) ?? [];
      if (list.length === 0) continue;
      const limits = await attendanceLimits({
        studentIds: list.map((s) => s.id),
        courseId: c.id,
        groupId: cg.groupId,
        plannedHours: c.plannedHours,
        corridor,
      });
      for (const s of list) {
        const lim = limits.get(s.id);
        if (!lim || lim.zone === "OK") continue;
        risk.push({
          studentId: s.id,
          studentName: s.fullName,
          groupId: cg.groupId,
          groupName: cg.group.name,
          courseId: c.id,
          courseName: c.name,
          teacherName: c.teacher.fullName,
          unexcusedHours: lim.unexcusedHours,
          limitHours: lim.limitHours,
          remainingHours: lim.remainingHours,
          zone: lim.zone,
          isGuest: guestPairs.has(`${c.id}:${cg.groupId}`),
        });
        riskByGroup.set(cg.groupId, (riskByGroup.get(cg.groupId) ?? 0) + 1);
      }
    }
  }
  const zoneRank: Record<AttZone, number> = { BLOCKED: 0, DANGER: 1, WARN: 2, OK: 3 };
  risk.sort((a, b) => zoneRank[a.zone] - zoneRank[b.zone] || b.unexcusedHours - a.unexcusedHours);

  // Guruh qatorlari: davomat foizi (pooled) + belgilanmagan darslar.
  const allCourseIds = courses.map((c) => c.id);
  const unmarkedByGroup = new Map<number, number>();
  if (allCourseIds.length && groupIds.length) {
    // Belgilanmagan = o'tgan sessiya, lekin yo'qlama yozuvi yo'q.
    const empties = await prisma.lessonSession.findMany({
      where: { courseId: { in: allCourseIds }, groupId: { in: groupIds }, status: "HELD", date: { lte: new Date() }, attendance: { none: {} } },
      select: { groupId: true },
    });
    for (const e of empties) {
      if (e.groupId == null) continue;
      unmarkedByGroup.set(e.groupId, (unmarkedByGroup.get(e.groupId) ?? 0) + 1);
    }
  }

  const groups: GroupRow[] = [];
  for (const [gid, g] of groupMap) {
    const list = byGroup.get(gid) ?? [];
    const tally = list.length
      ? await tallyByStudent({ studentId: { in: list.map((s) => s.id) }, session: { courseId: { in: g.courseIds }, status: "HELD" } })
      : new Map();
    const pooled = { present: 0, absent: 0, late: 0, excused: 0 };
    let marked = 0;
    for (const t of tally.values()) {
      pooled.present += t.present;
      pooled.absent += t.absent;
      pooled.late += t.late;
      pooled.excused += t.excused;
      marked += t.present + t.absent + t.late + t.excused;
    }
    groups.push({
      groupId: gid,
      groupName: g.name,
      facultyName: g.facultyName,
      studentCount: list.length,
      markedLessons: marked,
      unmarkedLessons: unmarkedByGroup.get(gid) ?? 0,
      attendancePct: attendancePct(pooled),
      atRisk: riskByGroup.get(gid) ?? 0,
    });
  }
  groups.sort((a, b) => b.atRisk - a.atRisk || b.unmarkedLessons - a.unmarkedLessons || a.groupName.localeCompare(b.groupName));

  const studentCounts = new Map<number, number>();
  for (const [gid, list] of byGroup) studentCounts.set(gid, list.length);

  return {
    period: period ? { academicYear: period.academicYear, semester: period.semester, startKey: period.startKey, endKey: period.endKey } : null,
    totals: {
      groups: groups.length,
      students: students.length,
      unmarkedLessons: [...unmarkedByGroup.values()].reduce((a, b) => a + b, 0),
      atRisk: risk.length,
      blocked: risk.filter((r) => r.zone === "BLOCKED").length,
    },
    groups,
    risk: risk.slice(0, 200),
    cycles: cycles.map((c) => ({
      cycleId: c.id,
      courseName: c.course.name,
      departmentName: c.course.department.name,
      groupName: c.group.name,
      facultyName: c.group.faculty.name,
      isGuest: c.isGuest,
      startKey: dayKey(c.startDate),
      endKey: dayKey(c.endDate),
      status: c.status,
      studentCount: studentCounts.get(c.groupId) ?? 0,
    })),
  };
}
