/**
 * MAVJUD testlardagi javob variantlarini aralashtiradi.
 *
 * Muammo (buyurtmachi 2026-08-03: "testlarda ko'pi A javob to'g'ri bo'layapdi
 * ketma-ket"). Jonli bazada o'lchandi — 90 savol:
 *     A 40% · B 48% · C 12% · D 0%
 * Ya'ni mavzuni bilmagan talaba "A yoki B" deb taxmin qilib ham yuqori ball
 * olardi. Generatsiya kodi tuzatildi (`shuffleOptions`), lekin ALLAQACHON
 * yaratilgan savollar o'z-o'zidan tuzalmaydi — shu skript ularni aralashtiradi.
 *
 * ⚠️ TALABA TARIXI BUZILMAYDI: variantlar o'rin almashgani uchun mavjud
 * urinishlardagi saqlangan javob indekslari ham AYNI almashtirish bo'yicha
 * qayta hisoblanadi (`answersJson`). Ya'ni talabaning "qaysi variantni
 * tanlagani" o'zgarmaydi — faqat o'sha variant endi boshqa o'rinda turadi.
 * Ball ham o'zgarmaydi (tekshirildi: skript oxirida qayta hisoblab solishtiradi).
 *
 * Ishlatish (apps/api ichidan):
 *   npx tsx src/scripts/fixQuizBias.ts          # ko'rsatadi, YOZMAYDI
 *   npx tsx src/scripts/fixQuizBias.ts --apply  # yozadi
 */
import "dotenv/config";
import { prisma } from "@meduni/db";
import { shuffleOptions } from "../modules/content/service";

const APPLY = process.argv.includes("--apply");

function dist(list: number[]): string {
  const d = [0, 0, 0, 0, 0, 0];
  for (const c of list) d[c] = (d[c] ?? 0) + 1;
  const total = list.length || 1;
  return d
    .slice(0, 4)
    .map((n, i) => `${"ABCD"[i]} ${Math.round((n / total) * 100)}%`)
    .join(" · ");
}

async function main() {
  const questions = await prisma.question.findMany({ orderBy: { id: "asc" } });
  console.log(`Savollar: ${questions.length}`);
  console.log(`  OLDIN : ${dist(questions.map((q) => q.correctIndex))}`);

  /** questionId → eski indeks → yangi indeks. */
  const remap = new Map<number, number[]>();
  const updates: { id: number; options: string[]; correctIndex: number }[] = [];

  for (const q of questions) {
    const options = (q.optionsJson as string[]) ?? [];
    if (options.length < 2) continue;
    const s = shuffleOptions(options, q.correctIndex);
    // Eski→yangi xarita: yangi ro'yxatdagi o'rni bo'yicha.
    // Eski indeks → yangi indeks. Bir xil matnli variant bo'lsa birinchi mos
    // keladigani olinadi — xatarsiz, chunki ular baribir bir xil javob.
    const map = options.map((opt) => s.options.indexOf(opt));
    remap.set(q.id, map);
    updates.push({ id: q.id, options: s.options, correctIndex: s.correctIndex });
  }

  console.log(`  KEYIN : ${dist(updates.map((u) => u.correctIndex))}`);

  const attempts = await prisma.quizAttempt.findMany();
  console.log(`Urinishlar: ${attempts.length} (javob indekslari ham ko'chiriladi)`);

  if (!APPLY) {
    console.log("\n(quruq ishga tushirish — hech narsa yozilmadi; --apply bilan qayta ishga tushiring)");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.question.update({
        where: { id: u.id },
        data: { optionsJson: u.options as object, correctIndex: u.correctIndex },
      });
    }
    for (const a of attempts) {
      const answers = (a.answersJson as Record<string, number>) ?? {};
      const next: Record<string, number> = {};
      for (const [qid, oldIdx] of Object.entries(answers)) {
        const map = remap.get(Number(qid));
        next[qid] = map && map[oldIdx] !== undefined && map[oldIdx] >= 0 ? map[oldIdx] : oldIdx;
      }
      await tx.quizAttempt.update({ where: { id: a.id }, data: { answersJson: next as object } });
    }
  },
  // ⚠️ Uzoq baza (Frankfurt) + 90 savol + 25 urinish — Prisma'ning sukut
  // 5 soniyalik tranzaksiya chegarasiga sig'maydi (P2028).
  { timeout: 180_000, maxWait: 30_000 });

  // Nazorat: ballar o'zgarmaganini tekshiramiz.
  let mismatch = 0;
  for (const a of attempts) {
    const fresh = await prisma.quizAttempt.findUnique({
      where: { id: a.id },
      include: { quiz: { include: { questions: true } } },
    });
    if (!fresh?.finishedAt) continue;
    const answers = (fresh.answersJson as Record<string, number>) ?? {};
    const correct = fresh.quiz.questions.filter((q) => answers[String(q.id)] === q.correctIndex).length;
    const pct = fresh.quiz.questions.length ? Math.round((correct / fresh.quiz.questions.length) * 100) : 0;
    if (pct !== fresh.scorePct) {
      mismatch++;
      console.warn(`  ⚠️ urinish ${fresh.id}: saqlangan ${fresh.scorePct}% ≠ qayta hisob ${pct}%`);
    }
  }
  console.log(mismatch ? `\n⚠️ ${mismatch} urinishda farq bor` : "\n✅ Tayyor — barcha ballar o'zgarmadi");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
