// REGRESSIYA SINOVI (2026-11-01 auditi): "dars bo'lmadi" darsidagi yo'qlama
// hech qayerda foizga kirmaydi, admin profili esa talaba/o'qituvchi bilan bir
// xil raqamni ko'rsatadi.
//
// Ilgari: o'qituvchi "Dars bo'lmadi" bossa, jurnal 100% derdi, talaba, admin va
// "davomat past" vazifasi esa o'sha darsdagi "kelmadi"ni sanab 75% derdi.
// MAHALLIY bazada; o'zi yaratganini oxirida o'chiradi.
import { prisma } from "../lib/prisma";
import { attendancePct, tallyByStatus } from "../modules/attendance/facts";
import { getMyAttendance, getMyGrades, getMyProfile } from "../modules/me/profile";
import { getUserProfile } from "../modules/users/service";

let pass = 0;
let fail = 0;
const ok = (c: boolean, n: string) => {
  c ? pass++ : fail++;
  console.log(`${c ? "ok" : "!!"} ${n}`);
};

async function main() {
  const student = await prisma.user.findUniqueOrThrow({ where: { email: "student@meduni.uz" } });
  const enr = await prisma.enrollment.findFirstOrThrow({ where: { studentId: student.id, status: "ACTIVE" } });
  const teacher = await prisma.user.findFirstOrThrow({ where: { role: "TEACHER" } });

  const before = {
    tally: attendancePct(await tallyByStatus({ studentId: student.id })),
    profile: (await getMyProfile(student.id)) as { attendancePct: number | null },
    admin: (await getUserProfile(student.id)) as { attendancePct?: number | null; avgQuizScore?: number | null },
    list: (await getMyAttendance(student.id, {})) as { stats: { pct: number | null } },
  };

  // Uzoq kelajakdagi sana — boshqa darslar bilan to'qnashmasin.
  const day = new Date(2031, 0, 15, 9, 0);
  const created: number[] = [];
  try {
    const cancelled = await prisma.lessonSession.create({
      data: { courseId: enr.courseId, date: day, createdById: teacher.id, status: "CANCELLED" },
    });
    created.push(cancelled.id);
    await prisma.attendance.create({
      data: { sessionId: cancelled.id, studentId: student.id, status: "ABSENT", markedById: teacher.id },
    });

    const tally = attendancePct(await tallyByStatus({ studentId: student.id }));
    ok(tally === before.tally, `facts: bekor qilingan darsdagi "kelmadi" foizga kirmaydi (${before.tally} → ${tally})`);
    const prof = (await getMyProfile(student.id)) as typeof before.profile;
    ok(typeof prof.attendancePct === "number" && prof.attendancePct === before.profile.attendancePct, `talaba profili o'zgarmadi (${prof.attendancePct})`);
    const adm = (await getUserProfile(student.id)) as typeof before.admin;
    ok(typeof adm.attendancePct === "number" && adm.attendancePct === before.admin.attendancePct, `admin profili o'zgarmadi (${adm.attendancePct})`);
    const list = (await getMyAttendance(student.id, {})) as typeof before.list;
    ok(list.stats.pct === before.list.stats.pct, "talaba davomat sahifasi o'zgarmadi");

    // Nazorat: O'TKAZILGAN darsdagi "kelmadi" esa sanaladi.
    const held = await prisma.lessonSession.create({
      data: { courseId: enr.courseId, date: new Date(2031, 0, 16, 9, 0), createdById: teacher.id },
    });
    created.push(held.id);
    await prisma.attendance.create({
      data: { sessionId: held.id, studentId: student.id, status: "ABSENT", markedById: teacher.id },
    });
    const after = attendancePct(await tallyByStatus({ studentId: student.id }));
    ok(after !== before.tally, `nazorat: o'tkazilgan darsdagi "kelmadi" sanaladi (${before.tally} → ${after})`);

    // Admin o'rtacha testi = talaba "Baholarim" dagi bilan bir xil formula (eng yaxshi ball / mavzu).
    const grades = (await getMyGrades(student.id)) as { courses: { quizzes: { bestScore: number }[] }[] };
    const best = grades.courses.flatMap((c) => c.quizzes.map((q) => q.bestScore));
    const studentAvg = best.length ? Math.round(best.reduce((a, b) => a + b, 0) / best.length) : null;
    ok(adm.avgQuizScore === studentAvg, `admin o'rtacha testi = talabaniki (${adm.avgQuizScore} / ${studentAvg})`);
  } finally {
    await prisma.attendance.deleteMany({ where: { sessionId: { in: created } } });
    await prisma.lessonSession.deleteMany({ where: { id: { in: created } } });
  }

  console.log(`\n${pass}/${pass + fail}`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
