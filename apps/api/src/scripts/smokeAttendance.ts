// DAVOMAT 2.0 · F0 — QABUL TESTI (HTTP + baza).
//
// Asosiy mezon: TALABA, O'QITUVCHI va ADMIN bitta odam haqida BIR XIL raqamni
// ko'rsin. F0 gacha formula 10 ta joyda mustaqil yozilgan edi va "belgilanmagan"
// holatida null / 0 / 100 qaytarardi.
//
// Ishga tushirish (API 8000 da turgan bo'lsin):
//   npx tsx src/scripts/smokeAttendance.ts
import { prisma } from "../lib/prisma";
import { attendancePct, poolTallies, tallyByStudent, tallyByStatus } from "../modules/attendance/facts";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:8000";
const STUDENT = { email: "student@meduni.uz", password: "student123" };
const TEACHER = { email: "teacher.m11demo@meduni.uz", password: "student123" };
const ADMIN = { email: "admin@meduni.uz", password: "admin123" };

let ok = 0;
let fail = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) {
    ok++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? ` — got: ${JSON.stringify(got)}` : ""}`);
  }
}

async function login(who: { email: string; password: string }): Promise<string> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(who),
  });
  if (!r.ok) throw new Error(`login ${who.email} → ${r.status}`);
  const raw = r.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function api<T>(path: string, cookie: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { cookie, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await r.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: r.status, body: body as T };
}

const dk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function main() {
  console.log(`\nDAVOMAT F0 — qabul testi (${BASE})\n`);
  const [sc, tc, ac] = await Promise.all([login(STUDENT), login(TEACHER), login(ADMIN)]);

  const me = await api<{ id: number }>("/api/v1/me/profile", sc);
  const studentId = (me.body as unknown as { id: number }).id;

  // ---------- 1. Bitta talaba — uchta rol ----------
  console.log("1) Bir talaba, uch rol — raqam bir xilmi");
  const mine = await api<{ stats: { pct: number | null }; byCourse: { courseId: number; pct: number | null }[] }>("/api/v1/me/attendance", sc);
  const prof = await api<{ attendancePct: number | null }>("/api/v1/me/profile", sc);
  const adminProf = await api<{ attendancePct: number | null }>(`/api/v1/users/${studentId}/profile`, ac);

  // Bazadan mustaqil hisob — "haqiqat" (formula facts.ts dan).
  const truth = attendancePct(await tallyByStatus({ studentId }));

  check("talaba /me/attendance = baza", mine.body.stats.pct === truth, { api: mine.body.stats.pct, truth });
  check("talaba /me/profile = baza", prof.body.attendancePct === truth, { api: prof.body.attendancePct, truth });
  check("admin /users/:id/profile = baza", adminProf.body.attendancePct === truth, { api: adminProf.body.attendancePct, truth });

  // ---------- 2. Kurs kesimi: talaba ↔ o'qituvchi ----------
  console.log("\n2) Kurs kesimi — talaba va o'qituvchi bir xil ko'radimi");
  const tStudent = await api<{ courses: { courseId: number; attendance: { pct: number | null } }[] }>(`/api/v1/teach/students/${studentId}`, tc);
  if (tStudent.status === 200 && Array.isArray(tStudent.body.courses)) {
    let compared = 0;
    for (const c of tStudent.body.courses) {
      const mineC = mine.body.byCourse.find((x) => x.courseId === c.courseId);
      if (!mineC) continue;
      compared++;
      check(`kurs ${c.courseId}: talaba ${mineC.pct} = o'qituvchi ${c.attendance.pct}`, mineC.pct === c.attendance.pct);
    }
    check("taqqoslash uchun umumiy kurs topildi", compared > 0, { compared });
  } else {
    console.log(`  · o'qituvchi bu talabani ko'rmaydi (${tStudent.status}) — kurs kesimi o'tkazib yuborildi`);
  }

  // ---------- 3. Guruh o'rtachasi POOLED bo'lishi ----------
  console.log("\n3) Guruh davomati — pooled nisbat (foizlar o'rtachasi EMAS)");
  const groups = await api<{ id: number }[]>("/api/v1/teach/groups", tc);
  const groupId = Array.isArray(groups.body) && groups.body.length ? groups.body[0].id : null;
  if (groupId) {
    const g = await api<{ avgAttendance: number | null; students: { id: number; attendancePct: number | null }[] }>(`/api/v1/admin/groups/${groupId}`, ac);
    if (g.status === 200) {
      const ids = g.body.students.map((s) => s.id);
      const cgs = await prisma.courseGroup.findMany({ where: { groupId }, select: { courseId: true } });
      const cids = cgs.map((c) => c.courseId);
      const byStudent = ids.length && cids.length ? await tallyByStudent({ studentId: { in: ids }, session: { courseId: { in: cids } } }) : new Map();
      const pooled = attendancePct(poolTallies(byStudent.values()));
      const pcts = g.body.students.map((s) => s.attendancePct).filter((x): x is number => x !== null);
      const meanOfPcts = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
      check("admin guruh avgAttendance = pooled", g.body.avgAttendance === pooled, { api: g.body.avgAttendance, pooled, meanOfPcts });
      if (pooled !== meanOfPcts) console.log(`  · farq ko'rinib turibdi: pooled ${pooled} vs eski usul (o'rtacha foiz) ${meanOfPcts}`);
    } else {
      console.log(`  · admin guruhni ko'rmadi (${g.status})`);
    }
  } else {
    console.log("  · o'qituvchida guruh yo'q");
  }

  // ---------- 4. Yo'qlama yozish: ruxsat va validatsiya ----------
  console.log("\n4) Yo'qlama yozish — begona talaba va noto'g'ri baho");
  const to = new Date();
  const from = new Date(to.getTime() - 120 * 86_400_000);
  const lessons = await api<{ courseId: number; groupId: number | null; dayKey: string; startTime: string; sessionId: number | null; markedCount: number }[]>(
    `/api/v1/teach/lessons?from=${dk(from)}&to=${dk(to)}`,
    tc
  );
  const lesson = Array.isArray(lessons.body) ? lessons.body.find((l) => l.sessionId !== null && l.markedCount > 0) : null;
  if (lesson) {
    const roster = await api<{ students: { id: number; status: string | null; grade: number | null }[] }>(
      `/api/v1/teach/attendance-by-date?courseId=${lesson.courseId}&date=${lesson.dayKey}&time=${lesson.startTime}${lesson.groupId ? `&groupId=${lesson.groupId}` : ""}`,
      tc
    );
    const marked = roster.body.students.filter((s) => s.status);
    // Mavjud holatni AYNAN qaytaramiz (o'zgarish yo'q) + bitta yo'q talaba.
    const marks = marked.map((s) => ({ studentId: s.id, status: s.status! }));
    const BOGUS = 99999901;
    const res = await api<{ marked: number; skipped: number }>("/api/v1/teach/attendance-by-date", tc, {
      method: "POST",
      body: JSON.stringify({ courseId: lesson.courseId, date: lesson.dayKey, startTime: lesson.startTime, groupId: lesson.groupId, marks: [...marks, { studentId: BOGUS, status: "PRESENT" }] }),
    });
    check("yozilmagan talaba rad etildi (skipped=1)", res.body?.skipped === 1, res.body);
    check("qolganlari yozildi", res.body?.marked === marks.length, { got: res.body?.marked, expected: marks.length });

    if (marks.length) {
      const bad = await api<{ error?: { code: string } }>("/api/v1/teach/attendance-by-date", tc, {
        method: "POST",
        body: JSON.stringify({ courseId: lesson.courseId, date: lesson.dayKey, startTime: lesson.startTime, groupId: lesson.groupId, marks: [{ ...marks[0], grade: 150 }] }),
      });
      check("baho 150 → 400", bad.status === 400, { status: bad.status, body: bad.body });
    }

    // Statuslar o'zgarmagani uchun o'zgarish jurnaliga yozuv tushmasligi kerak.
    const changed = await prisma.attendanceChange.count({ where: { at: { gte: new Date(Date.now() - 60_000) } } });
    check("o'zgarmagan belgilar jurnalga tushmadi", changed === 0, { changed });
  } else {
    console.log("  · belgilangan dars topilmadi — yozish testlari o'tkazib yuborildi");
  }

  // ---------- 5. O'lik route'lar yopilgan ----------
  console.log("\n5) Sessiya-markazli eski route'lar yopildimi");
  // Yopilgan = teach router endi bu yo'lni ushlamaydi. So'rov oxirgi (org) routerga
  // tushadi, u esa ADMIN guard bilan — shuning uchun o'qituvchiga 403, adminga 404.
  // Ikkalasi ham "endi ishlamaydi" degani; asosiysi — 200 va ma'lumot yo'q.
  const closed = (st: number) => st === 403 || st === 404;
  for (const p of ["/api/v1/teach/sessions", "/api/v1/teach/sessions/1/roster"]) {
    const r = await api(p, tc);
    check(`${p} yopiq`, closed(r.status), r.status);
  }
  const post = await api("/api/v1/teach/courses/1/sessions", tc, { method: "POST", body: JSON.stringify({ date: "2026-01-01" }) });
  check("POST /courses/1/sessions yopiq", closed(post.status), post.status);
  // Admin uchun ham: `/api/v1/teach/*` prefiksida TEACHER guard turadi (router-level),
  // shuning uchun 403. Muhimi — hech kimga 200 va ma'lumot qaytmasligi.
  const adminSees = await api("/api/v1/teach/sessions", ac);
  check("admin uchun ham yopiq", closed(adminSees.status), adminSees.status);

  console.log(`\n${fail === 0 ? "HAMMASI O'TDI" : "XATO BOR"} — ${ok} ✓ / ${fail} ✗\n`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("SMOKE ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});
