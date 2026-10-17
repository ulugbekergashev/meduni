// Bazasiz sinov: mavzu/kurs o'chirish (topics/purge.ts) + fayl prefiksi (lib/storage.ts).
// Prisma chaqiruvlari sinov ichida almashtiriladi — hech qanday bazaga ulanmaydi.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "purge-"));
process.env.STORAGE_DRIVER = "disk";
process.env.STORAGE_DIR = tmp;

let pass = 0;
let fail = 0;
const ok = (c: boolean, n: string) => {
  c ? pass++ : fail++;
  console.log(`${c ? "ok" : "!!"} ${n}`);
};

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { deleteTopicFiles } = await import("../lib/storage");
  const purge = await import("../modules/topics/purge");

  // ---------- Fayl prefiksi ----------
  const blobWhere: unknown[] = [];
  Object.defineProperty(prisma, "fileBlob", {
    configurable: true,
    value: { deleteMany: async (a: { where: unknown }) => (blobWhere.push(a.where), { count: 0 }) },
  });
  for (const f of ["topics/1/a.pdf", "topics/1/video/3/video.mp4", "topics/10/b.pdf", "topics/12/c.txt"]) {
    fs.mkdirSync(path.join(tmp, path.dirname(f)), { recursive: true });
    fs.writeFileSync(path.join(tmp, f), "x");
  }
  await deleteTopicFiles(1);
  ok(!fs.existsSync(path.join(tmp, "topics/1")), "topics/1/ diskdan o'chdi (ichki papkalar bilan)");
  ok(fs.existsSync(path.join(tmp, "topics/10/b.pdf")) && fs.existsSync(path.join(tmp, "topics/12/c.txt")), "topics/10 va topics/12 tegilmadi");
  ok(JSON.stringify(blobWhere[0]) === JSON.stringify({ path: { startsWith: "topics/1/" } }), "bazadagi fayllar ham aynan 'topics/1/' prefiksi bilan");
  let threw = false;
  try { await deleteTopicFiles(0); } catch { threw = true; }
  ok(threw, "noto'g'ri id (0) rad etiladi — butun topics/ o'chib ketmaydi");

  // ---------- Natija bor/yo'q ----------
  const counts = { quizAttempt: 0, caseAttempt: 0, progress: 0 };
  const setModel = (name: string, impl: object) => Object.defineProperty(prisma, name, { configurable: true, value: impl });
  setModel("contentItem", { findMany: async () => [{ id: 11 }, { id: 12 }] });
  setModel("quiz", { findMany: async () => [{ id: 21 }] });
  setModel("clinicalCase", { findMany: async () => [{ id: 31 }] });
  setModel("quizAttempt", { count: async () => counts.quizAttempt });
  setModel("caseAttempt", { count: async () => counts.caseAttempt });
  setModel("progress", { count: async () => counts.progress });

  let r = await purge.studentResults([5]);
  ok(!purge.hasResults(r), "natija yo'q → o'chirishga ruxsat");
  counts.quizAttempt = 3;
  counts.caseAttempt = 1;
  r = await purge.studentResults([5]);
  ok(purge.hasResults(r), "test urinishi bor → o'chirish to'siladi");
  const err = purge.resultsConflict("topic", r) as unknown as { status: number; code: string; messageUz: string };
  ok(err.status === 409 && err.code === "HAS_STUDENT_RESULTS", "409 HAS_STUDENT_RESULTS (500 emas)");
  ok(/3 ta test urinishi/.test(err.messageUz) && /1 ta keys javobi/.test(err.messageUz), `xabar aniq: "${err.messageUz.slice(0, 70)}…"`);
  counts.quizAttempt = 0; counts.caseAttempt = 0; counts.progress = 2;
  ok(purge.hasResults(await purge.studentResults([5])), "tugatilgan/qo'lda ochilgan progress ham natija hisoblanadi");
  const courseErr = purge.resultsConflict("course", { quizAttempts: 0, caseAttempts: 0, completed: 0 }, 7) as unknown as { messageUz: string };
  ok(/7 ta davomat belgisi/.test(courseErr.messageUz), "kurs: davomat belgisi ham sabab sifatida aytiladi");

  // ---------- O'chirish tartibi (bolalar ota-onadan OLDIN) ----------
  const order: string[] = [];
  const rec = (model: string) =>
    new Proxy({}, {
      get: (_t, op: string) => async () => {
        if (op === "findMany") {
          if (model === "contentItem") return [{ id: 11 }];
          if (model === "quiz") return [{ id: 21 }];
          if (model === "clinicalCase") return [{ id: 31 }];
          if (model === "question") return [{ id: 41 }];
          return [];
        }
        order.push(`${model}.${op}`);
        return { count: 0 };
      },
    });
  const tx = new Proxy({}, { get: (_t, model: string) => rec(model) });
  await purge.purgeTopicRows(tx as never, [5]);
  const idx = (k: string) => order.indexOf(k);
  const before = (a: string, b: string) => idx(a) >= 0 && idx(b) >= 0 && idx(a) < idx(b);
  ok(before("remediationAnswer.deleteMany", "question.deleteMany"), "remediation javoblari → savollardan oldin");
  ok(before("quizAttempt.deleteMany", "quiz.deleteMany") && before("question.deleteMany", "quiz.deleteMany"), "urinishlar va savollar → testdan oldin");
  ok(before("caseAttempt.deleteMany", "clinicalCase.deleteMany"), "keys javoblari → keysdan oldin");
  ok(["quiz", "clinicalCase", "presentation", "video"].every((m) => before(`${m}.deleteMany`, "contentItem.deleteMany")), "test/keys/taqdimot/video → kontent elementidan oldin");
  ok(["contentItem", "topicDigest", "progress", "sourceMaterial"].every((m) => before(`${m}.deleteMany`, "topic.deleteMany")), "kontent/konspekt/progress/material → mavzudan oldin");
  ok(before("lessonSession.updateMany", "topic.deleteMany") && before("task.updateMany", "topic.deleteMany"), "dars va topshiriq o'chmaydi — faqat havola uziladi");
  ok(order[order.length - 1] === "topic.deleteMany", "mavzu eng oxirida o'chadi");

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} ok, ${fail} xato`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
