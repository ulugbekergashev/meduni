// AI-tutor chat (dars ichida, talaba + AI). Layout v2, Faza 2C.
// Himoya: assertTopicOpen (enrolled+published+unlocked), test jarayonida qulf
// (halollik), kafedra AI-kvotasi. Har chaqiruv AiUsage'da "TUTOR" bo'lib qoladi.
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { readText } from "../../lib/storage";
import { generateStructured } from "../../ai/gemini";
import { departmentForTopic } from "../../ai/glossary";
import { assertQuota } from "../../ai/quota";
import { tutorResponseSchema, tutorSystemPrompt, tutorUserContent } from "../../ai/prompts/tutor";
import type { DigestJson } from "../../ai/types";
import { assertTopicOpen } from "./service";

const MAX_CONTEXT_CHARS = 24_000;
const HISTORY_TAKE = 12;

function serialize(m: { id: number; role: string; text: string; createdAt: Date }) {
  return { id: m.id, role: m.role as "student" | "assistant", text: m.text, createdAt: m.createdAt };
}

export async function getChat(studentId: number, topicId: number) {
  await assertTopicOpen(studentId, topicId);
  const messages = await prisma.tutorMessage.findMany({
    where: { studentId, topicId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return { messages: messages.map(serialize) };
}

/** Dars kontekstini yig'adi: tasdiqlangan konspekt (bo'limlar + atamalar +
 *  faktlar + dozalar) + parsed material matni — jami MAX_CONTEXT_CHARS gacha. */
async function buildContext(topicId: number): Promise<string> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { digest: true, materials: { where: { parseStatus: "DONE" } } },
  });
  if (!topic) throw notFound("Mavzu");

  const parts: string[] = [`MAVZU: ${topic.title}`];

  if (topic.digest?.approvedByTeacher) {
    const d = topic.digest.digestJson as unknown as DigestJson;
    for (const [i, s] of (d.sections ?? []).entries()) {
      parts.push(`\n${i + 1}-BO'LIM: ${s.title}`);
      for (const b of s.blocks) {
        if (b.type === "para" || b.type === "callout") parts.push(b.text);
        else if (b.type === "list")
          parts.push(b.items.map((it) => `- ${it.lead ? `${it.lead}: ` : ""}${it.text}`).join("\n"));
      }
    }
    if (d.terms?.length)
      parts.push("\nATAMALAR:\n" + d.terms.map((t) => `- ${t.uz} / ${t.ru} / ${t.lat}`).join("\n"));
    if (d.facts?.length) parts.push("\nMUHIM FAKTLAR:\n" + d.facts.map((f) => `- ${f}`).join("\n"));
    if (d.dosages?.length) parts.push("\nDOZALAR (manbadan):\n" + d.dosages.map((x) => `- ${x}`).join("\n"));
  }

  // Parsed material matni — qolgan joyga sig'guncha.
  let budget = MAX_CONTEXT_CHARS - parts.join("\n").length;
  for (const m of topic.materials) {
    if (budget < 500 || !m.parsedTextUrl) continue;
    try {
      const text = await readText(m.parsedTextUrl);
      const chunk = text.slice(0, budget);
      parts.push(`\nMANBA FAYL (${m.fileName}):\n${chunk}`);
      budget -= chunk.length;
    } catch {
      /* fayl o'qilmasa — kontekstsiz davom */
    }
  }

  return parts.join("\n").slice(0, MAX_CONTEXT_CHARS);
}

export async function sendChat(studentId: number, topicId: number, textRaw: string) {
  const text = textRaw.trim();
  if (!text) throw badRequest("Xabar boʻsh", "Пустое сообщение");
  if (text.length > 2000) throw badRequest("Xabar juda uzun (maks 2000 belgi)", "Слишком длинное сообщение (макс 2000)");

  await assertTopicOpen(studentId, topicId);

  // Halollik rejimi: test jarayonida chat qulflanadi (AI'dan javob so'rab bo'lmasin).
  const inProgress = await prisma.quizAttempt.findFirst({
    where: { studentId, finishedAt: null, quiz: { contentItem: { topicId } } },
    select: { id: true },
  });
  if (inProgress) {
    throw new ApiError(403, "chat_locked_quiz", "Test paytida chat yopiq", "Во время теста чат закрыт");
  }

  const departmentId = await departmentForTopic(topicId);
  if (departmentId) await assertQuota(departmentId);

  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { locale: true } });
  const lang: "uz" | "ru" = user?.locale === "ru" ? "ru" : "uz";

  const [contextText, historyDesc] = await Promise.all([
    buildContext(topicId),
    prisma.tutorMessage.findMany({
      where: { studentId, topicId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_TAKE,
    }),
  ]);
  const history = historyDesc.reverse().map((m) => ({ role: m.role, text: m.text }));

  const gen = await generateStructured<{ reply: string }>({
    systemInstruction: tutorSystemPrompt(lang, contextText),
    userContent: tutorUserContent(history, text),
    responseSchema: tutorResponseSchema,
    kind: "TUTOR",
    topicId,
    departmentId: departmentId ?? undefined,
    userId: studentId,
  });
  const reply =
    (gen?.reply ?? "").toString().trim() ||
    (lang === "ru" ? "Не удалось получить ответ, попробуйте ещё раз." : "Javob olinmadi, qayta urinib koʻring.");

  const [mine, ai] = await prisma.$transaction([
    prisma.tutorMessage.create({ data: { studentId, topicId, role: "student", text } }),
    prisma.tutorMessage.create({ data: { studentId, topicId, role: "assistant", text: reply } }),
  ]);
  return { messages: [serialize(mine), serialize(ai)] };
}
