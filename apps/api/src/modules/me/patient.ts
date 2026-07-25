// Virtual bemor roleplay (Modul 26) — AI klinik keys asosidagi bemor rolini
// o'ynaydi, talaba anamnez yig'adi; yakunda AI baholaydi.
// Himoya: assertTopicOpen, kafedra AI-kvotasi. AiUsage'da "PATIENT"/"PATIENT_EVAL".
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { generateStructured } from "../../ai/gemini";
import { departmentForTopic } from "../../ai/glossary";
import { assertQuota } from "../../ai/quota";
import {
  evalResponseSchema,
  evalSystemPrompt,
  evalUserContent,
  patientResponseSchema,
  patientSystemPrompt,
  patientUserContent,
  type PatientEval,
} from "../../ai/prompts/patient";
import { caseSystemPrompt, caseUserContent } from "../../ai/prompts/case";
import { caseResponseSchema, caseSchema, type CaseJson, type DigestJson } from "../../ai/types";
import { assertTopicOpen } from "./service";

const HISTORY_TAKE = 16;

interface PatientMsgOut {
  id: number;
  role: "student" | "patient" | "eval";
  text: string;
  eval?: PatientEval;
  createdAt: Date;
}

function serialize(m: { id: number; role: string; text: string; createdAt: Date }): PatientMsgOut {
  if (m.role === "eval") {
    let parsed: PatientEval | undefined;
    try {
      parsed = JSON.parse(m.text) as PatientEval;
    } catch {
      /* buzuq bo'lsa — matn sifatida */
    }
    return { id: m.id, role: "eval", text: parsed ? "" : m.text, eval: parsed, createdAt: m.createdAt };
  }
  return { id: m.id, role: m.role as "student" | "patient", text: m.text, createdAt: m.createdAt };
}

/** Mavzuning tasdiqlangan (PUBLISHED) klinik keysi — bemor "haqiqati" manbasi. */
async function loadCase(topicId: number): Promise<CaseJson | null> {
  const item = await prisma.contentItem.findFirst({
    where: { topicId, kind: "CASE", status: "PUBLISHED" },
    include: { clinicalCase: true },
  });
  return (item?.clinicalCase?.caseJson as unknown as CaseJson) ?? null;
}

/** Generatsiya qilingan bemor ssenariysi (keys yo'q — konspektdan yaratilgan;
 *  per student+topic saqlanadi, reset yangi bemor beradi). */
async function loadScenario(studentId: number, topicId: number): Promise<CaseJson | null> {
  const row = await prisma.patientMessage.findFirst({
    where: { studentId, topicId, role: "scenario" },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  try {
    return JSON.parse(row.text) as CaseJson;
  } catch {
    return null;
  }
}

/** Bemor "haqiqati": avval published keys, keyin saqlangan ssenariy. */
async function loadTruth(studentId: number, topicId: number): Promise<CaseJson | null> {
  return (await loadCase(topicId)) ?? (await loadScenario(studentId, topicId));
}

/** Mavzuда bemor MANBAI bormi — published keys YOKI tasdiqlangan konspekt. */
async function hasPatientSource(topicId: number): Promise<boolean> {
  if (await loadCase(topicId)) return true;
  const d = await prisma.topicDigest.findUnique({ where: { topicId }, select: { approvedByTeacher: true } });
  return !!d?.approvedByTeacher;
}

/** Bemor haqiqatini oladi; yo'q bo'lsa — tasdiqlangan KONSPEKTDAN generatsiya
 *  qiladi (keys shart emas → "hoxlagan payt kirib ishlash"). Konspekt ham
 *  tasdiqlanmagan bo'lsa null. Ssenariy medical → Gemini (roleplay lite'da). */
async function ensureTruth(studentId: number, topicId: number, lang: "uz" | "ru"): Promise<CaseJson | null> {
  const existing = await loadTruth(studentId, topicId);
  if (existing) return existing;

  const digestRow = await prisma.topicDigest.findUnique({ where: { topicId } });
  if (!digestRow?.approvedByTeacher) return null;
  const digest = digestRow.digestJson as unknown as DigestJson;

  const departmentId = await departmentForTopic(topicId);
  if (departmentId) await assertQuota(departmentId);

  const gen = await generateStructured<CaseJson>({
    systemInstruction: caseSystemPrompt(lang, "SHORT"),
    userContent: caseUserContent(digest),
    responseSchema: caseResponseSchema,
    kind: "PATIENT_SCENARIO",
    topicId,
    departmentId: departmentId ?? undefined,
    userId: studentId,
  });
  const parsed = caseSchema.safeParse(gen);
  const scenario = (parsed.success ? parsed.data : gen) as CaseJson;
  await prisma.patientMessage.create({
    data: { studentId, topicId, role: "scenario", text: JSON.stringify(scenario) },
  });
  return scenario;
}

export async function getPatient(studentId: number, topicId: number) {
  await assertTopicOpen(studentId, topicId);
  const [messages, truth, source] = await Promise.all([
    // "scenario" ichki yozuv — talabaga ko'rsatilmaydi.
    prisma.patientMessage.findMany({
      where: { studentId, topicId, role: { in: ["student", "patient", "eval"] } },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    loadTruth(studentId, topicId),
    hasPatientSource(topicId),
  ]);
  const out = messages.map(serialize);
  return {
    // Keys YOKI tasdiqlangan konspekt bo'lsa — bemor mavjud (keys shart emas).
    available: source,
    patientInfo: truth ? { name: truth.patientName || "", info: truth.patientInfo || "" } : null,
    finished: out.some((m) => m.role === "eval"),
    messages: out,
  };
}

export async function sendPatient(studentId: number, topicId: number, textRaw: string) {
  const text = textRaw.trim();
  if (!text) throw badRequest("Xabar boʻsh", "Пустое сообщение");
  if (text.length > 2000) throw badRequest("Xabar juda uzun", "Слишком длинное сообщение");

  await assertTopicOpen(studentId, topicId);

  // Yakunlangan bo'lsa — avval reset qilinsin.
  const already = await prisma.patientMessage.findFirst({ where: { studentId, topicId, role: "eval" }, select: { id: true } });
  if (already) throw new ApiError(409, "patient_finished", "Suhbat yakunlangan", "Сессия завершена");

  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { locale: true } });
  const lang: "uz" | "ru" = user?.locale === "ru" ? "ru" : "uz";

  // Keys bo'lmasa — tasdiqlangan konspektdan bemor generatsiya qilinadi (birinchi
  // xabarda). Konspekt ham tasdiqlanmagan bo'lsagina bemor yo'q.
  const kase = await ensureTruth(studentId, topicId, lang);
  if (!kase) throw new ApiError(400, "no_case", "Bu mavzuda bemor yo'q (konspekt tasdiqlanmagan)", "В этой теме нет пациента (конспект не утверждён)");

  const departmentId = await departmentForTopic(topicId);
  if (departmentId) await assertQuota(departmentId);

  const historyDesc = await prisma.patientMessage.findMany({
    where: { studentId, topicId, role: { in: ["student", "patient"] } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TAKE,
  });
  const history = historyDesc.reverse().map((m) => ({ role: m.role, text: m.text }));

  const gen = await generateStructured<{ reply: string }>({
    systemInstruction: patientSystemPrompt(lang, kase),
    userContent: patientUserContent(history, text),
    responseSchema: patientResponseSchema,
    kind: "PATIENT",
    topicId,
    departmentId: departmentId ?? undefined,
    userId: studentId,
    // 3D: roleplay navbati arzon/past-riskli → lite model (baholash flash'da qoladi).
    preferLite: true,
  });
  const reply =
    (gen?.reply ?? "").toString().trim() ||
    (lang === "ru" ? "…" : "…");

  const [mine, ai] = await prisma.$transaction([
    prisma.patientMessage.create({ data: { studentId, topicId, role: "student", text } }),
    prisma.patientMessage.create({ data: { studentId, topicId, role: "patient", text: reply } }),
  ]);
  return { messages: [serialize(mine), serialize(ai)] };
}

export async function finishPatient(studentId: number, topicId: number, diagnosisRaw: string) {
  const diagnosis = (diagnosisRaw ?? "").trim();
  await assertTopicOpen(studentId, topicId);
  const kase = await loadTruth(studentId, topicId);
  if (!kase) throw new ApiError(400, "no_case", "Bu mavzuda bemor yo'q", "В этой теме нет пациента");

  const existing = await prisma.patientMessage.findFirst({ where: { studentId, topicId, role: "eval" } });
  if (existing) return { eval: serialize(existing).eval, finished: true };

  const convo = await prisma.patientMessage.findMany({
    where: { studentId, topicId, role: { in: ["student", "patient"] } },
    orderBy: { createdAt: "asc" },
  });
  if (convo.filter((m) => m.role === "student").length === 0) {
    throw new ApiError(400, "no_dialogue", "Avval bemor bilan suhbatlashing", "Сначала побеседуйте с пациентом");
  }

  const departmentId = await departmentForTopic(topicId);
  if (departmentId) await assertQuota(departmentId);

  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { locale: true } });
  const lang: "uz" | "ru" = user?.locale === "ru" ? "ru" : "uz";
  const history = convo.map((m) => ({ role: m.role, text: m.text }));

  const result = await generateStructured<PatientEval>({
    systemInstruction: evalSystemPrompt(lang, kase),
    userContent: evalUserContent(history, diagnosis),
    responseSchema: evalResponseSchema,
    kind: "PATIENT_EVAL",
    topicId,
    departmentId: departmentId ?? undefined,
    userId: studentId,
  });

  const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const clean: PatientEval = {
    diagnosis: (result?.diagnosis ?? "").toString(),
    correct: !!result?.correct,
    anamnesisScore: clamp(result?.anamnesisScore),
    communicationScore: clamp(result?.communicationScore),
    overallScore: clamp(result?.overallScore),
    strengths: (result?.strengths ?? "").toString(),
    improvements: (result?.improvements ?? "").toString(),
  };

  const saved = await prisma.patientMessage.create({
    data: { studentId, topicId, role: "eval", text: JSON.stringify(clean) },
  });
  return { eval: serialize(saved).eval, finished: true };
}

export async function resetPatient(studentId: number, topicId: number) {
  await assertTopicOpen(studentId, topicId);
  await prisma.patientMessage.deleteMany({ where: { studentId, topicId } });
  return { ok: true };
}
