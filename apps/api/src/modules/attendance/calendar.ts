// O'QUV KALENDARI — semestr sanalari va dars bo'lmaydigan kunlar.
//
// ⚠️ NEGA (2026-09-08 auditi): `Course.semester` + `academicYear` faqat YORLIQ edi.
// Bazada semestr qachon boshlanib tugashi umuman yozilmagan, bayramlar ham yo'q edi.
// Oqibati: darslar Navro'z va sessiya haftasida ham "hosil bo'lardi", davomat
// maxraji shishardi, "joriy semestr" esa `academicYear` SATRINI saralab taxmin
// qilinardi (`me/profile.ts`).
//
// Xatti-harakat: kalendar BO'SH bo'lsa hech narsa filtrlanmaydi (eski holat).
// Ya'ni jadval kiritilmagan vuzda hech narsa buzilmaydi.
import { prisma } from "../../lib/prisma";
import { dayKey } from "../../lib/time";

export interface TermWindow {
  id: number;
  academicYear: string;
  semester: number;
  startKey: string;
  endKey: string;
}

const TTL_MS = 60_000;
let termCache: { at: number; value: TermWindow[] } | null = null;

export function invalidateCalendarCache(): void {
  termCache = null;
}

export async function loadTerms(): Promise<TermWindow[]> {
  if (termCache && Date.now() - termCache.at < TTL_MS) return termCache.value;
  const rows = await prisma.academicTerm.findMany({ orderBy: [{ academicYear: "desc" }, { semester: "desc" }] });
  const value = rows.map((r) => ({
    id: r.id,
    academicYear: r.academicYear,
    semester: r.semester,
    startKey: dayKey(r.startDate),
    endKey: dayKey(r.endDate),
  }));
  termCache = { at: Date.now(), value };
  return value;
}

/** Berilgan kunga to'g'ri keladigan davr (bo'lmasa null). */
export async function termAt(atKey: string = dayKey(new Date())): Promise<TermWindow | null> {
  const terms = await loadTerms();
  return terms.find((t) => atKey >= t.startKey && atKey <= t.endKey) ?? null;
}

/** Kurs davri — yorliqlari bo'yicha (2026/2027 · 1-semestr). */
export async function termOfCourse(academicYear: string, semester: number): Promise<TermWindow | null> {
  const terms = await loadTerms();
  return terms.find((t) => t.academicYear === academicYear && t.semester === semester) ?? null;
}

/**
 * [from..to] oralig'idagi dars bo'lmaydigan kunlar.
 * Qaytadi: dayKey → fakultetlar to'plami; `null` — butun vuz uchun.
 * Foydalanish: `isNonTeaching(map, dayKey, group.facultyId)`.
 */
export async function loadExceptions(from: string, to: string): Promise<Map<string, Set<number | null>>> {
  const rows = await prisma.calendarException.findMany({
    where: { date: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59.999`) } },
    select: { date: true, facultyId: true },
  });
  const out = new Map<string, Set<number | null>>();
  for (const r of rows) {
    const k = dayKey(r.date);
    let set = out.get(k);
    if (!set) {
      set = new Set();
      out.set(k, set);
    }
    set.add(r.facultyId);
  }
  return out;
}

export function isNonTeaching(map: Map<string, Set<number | null>>, key: string, facultyId: number | null): boolean {
  const set = map.get(key);
  if (!set) return false;
  return set.has(null) || (facultyId != null && set.has(facultyId));
}
