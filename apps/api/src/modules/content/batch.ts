// "Hammasini yarat" — test + keys + prezentatsiya (+ video) BITTA bosishda.
//
// ⚠️ NEGA (2026-07-29, buyurtmachi: "kontent yaratish qismini osonlashtir"):
// o'qituvchi har kontent turi uchun alohida sozlama tanlab, alohida tugma bosib,
// har birining tugashini kutib o'tirardi (4 marta ~40–60s). Endi bitta bosish:
// server ketma-ket yaratadi, o'qituvchi sahifani yopib ketishi mumkin.
//
// Ketma-ket (parallel EMAS): Gemini kvotasi va 429 xavfi + xotira (§12 fon-joblar).
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/errors";
import { generateCase, generateQuiz } from "./service";
import { generatePresentation } from "./presentation";
import { generateVideo } from "./video";

export type BatchKind = "quiz" | "case" | "presentation" | "video";
export type BatchState = "queued" | "running" | "done" | "error";

export interface BatchStatus {
  running: boolean;
  startedAt: string;
  steps: { kind: BatchKind; state: BatchState; error?: string }[];
}

/** Jonli progress — xotirada (jarayon o'lsa yo'qoladi, lekin YARATILGAN kontent
 *  bazada qoladi: UI baribir mavzu tafsilotidan "tayyor"ni ko'radi). */
const runs = new Map<number, BatchStatus>();

export function getBatchStatus(topicId: number): BatchStatus | null {
  return runs.get(topicId) ?? null;
}

const DEFAULT_KINDS: BatchKind[] = ["quiz", "case", "presentation"];

export async function startBatch(
  topicId: number,
  teacherId: number,
  opts: { language: "uz" | "ru"; kinds?: BatchKind[]; questionCount?: number; voice?: "male" | "female" }
): Promise<BatchStatus> {
  const active = runs.get(topicId);
  if (active?.running) throw new ApiError(409, "batch_running", "Generatsiya allaqachon ketmoqda", "Генерация уже идёт");

  // Birinchi qulf shu yerda ham tekshiriladi: konspekt tasdiqlanmagan bo'lsa
  // har bir generator baribir 403 berardi — foydalanuvchi buni BOSHIDA bilsin.
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { digest: true } });
  if (!topic?.digest?.approvedByTeacher) {
    throw new ApiError(403, "digest_not_approved", "Avval konspektni tasdiqlang", "Сначала утвердите конспект");
  }

  const kinds = (opts.kinds?.length ? opts.kinds : DEFAULT_KINDS).filter((k, i, a) => a.indexOf(k) === i);
  // Video prezentatsiyadan keyin turishi SHART (u slaydlardan qurilaydi).
  const order: BatchKind[] = ["quiz", "case", "presentation", "video"];
  const steps = order.filter((k) => kinds.includes(k)).map((kind) => ({ kind, state: "queued" as BatchState }));

  const status: BatchStatus = { running: true, startedAt: new Date().toISOString(), steps };
  runs.set(topicId, status);

  setImmediate(() => void runBatch(topicId, teacherId, status, opts));
  return status;
}

async function runBatch(
  topicId: number,
  teacherId: number,
  status: BatchStatus,
  opts: { language: "uz" | "ru"; questionCount?: number; voice?: "male" | "female" }
) {
  for (const step of status.steps) {
    step.state = "running";
    try {
      if (step.kind === "quiz") {
        await generateQuiz(topicId, teacherId, {
          language: opts.language,
          questionCount: opts.questionCount ?? 10,
          difficulty: "balanced",
        });
      } else if (step.kind === "case") {
        await generateCase(topicId, teacherId, { language: opts.language, format: "SHORT" });
      } else if (step.kind === "presentation") {
        await generatePresentation(topicId, teacherId, { language: opts.language });
      } else {
        // Video — o'zi fon-navbatiga tushadi (montaj uzoq); bu yerda faqat boshlanadi.
        await generateVideo(topicId, teacherId, { language: opts.language, voice: opts.voice ?? "female" });
      }
      step.state = "done";
    } catch (e) {
      // Bitta tur yiqilsa qolganlari BARIBIR yaratiladi (masalan kvota faqat
      // rasmga tegishli bo'lsa test va keys tayyor bo'lib qolsin).
      step.state = "error";
      step.error = e instanceof ApiError ? e.code : "error";
      console.error(`[batch] topic ${topicId} ${step.kind}:`, e);
    }
  }
  status.running = false;
}
