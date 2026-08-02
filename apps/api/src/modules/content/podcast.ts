import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { createHash } from "crypto";
import os from "os";
import path from "path";
import { prisma } from "../../lib/prisma";
import { badRequest, notFound } from "../../lib/errors";
import { readFileBuffer, readText, saveBytes } from "../../lib/storage";
import { FFMPEG, run } from "../../lib/exec";
import { enqueueMediaJob } from "../../lib/jobQueue";
import { synthToWav, voicePair } from "../../lib/tts";
import { generateStructured } from "../../ai/gemini";
import { assertQuota } from "../../ai/quota";
import { departmentForTopic } from "../../ai/glossary";
import { podcastChapterUserContent, podcastSystemPrompt } from "../../ai/prompts/podcast";
import {
  podcastChapterGenSchema,
  podcastChapterResponseSchema,
  type DigestJson,
  type DigestSection,
  type PodcastChapterGen,
  type PodcastSegment,
} from "../../ai/types";
import { assertCourseTeacher } from "../topics/service";

// ============================================================================
// AUDIO-PODKAST (~20 daqiqa) — buyurtmachi 2026-08-02:
//   "аудиоподкаст нужно сделать… где-то 20 минут… чтобы полностью раскрыть тему"
//
// Ilgari mavzuda faqat "audio-konspekt" bor edi: BITTA Gemini TTS chaqiruvi,
// matn 4500 belgiga KESILARDI (~4 daqiqa) va konspektning oxiri umuman ovozga
// aylanmasdi. Podkast boshqa narsa:
//   1) SCRIPT — konspektning HAR BO'LIMI uchun alohida AI chaqiruvi (bob).
//      Shuning uchun "to'liq ochish" strukturaviy kafolat: bo'lim tushib
//      qolishi mumkin emas. Davomiylik bo'limlarga taqsimlanadi.
//   2) TTS  — har replika alohida ovozlanadi, IKKI ovoz (boshlovchi/mutaxassis)
//      navbatma-navbat. Har replika keshlanadi (hash) — uzilsa qolgan joyidan.
//   3) MIX  — ffmpeg bilan concat → m4a (AAC 96k). MP4 YO'Q, kadr chizish YO'Q
//      (§17: aynan kadr+x264 512 MB konteynerni o'ldirardi).
// ============================================================================

/** Mo'ljal: ~20 daqiqa. Ovoz tezligi ~135 so'z/daqiqa (uz/ru o'rtacha). */
const TARGET_MINUTES = Number(process.env.PODCAST_MINUTES ?? 20);
const WORDS_PER_MIN = 135;
/** Bitta bob uchun chegara — juda uzun javob kesilib qolmasin. */
const MAX_CHAPTER_WORDS = 900;
const MIN_CHAPTER_WORDS = 220;

const podcastInclude = { topic: { include: { digest: true, course: true } } } as const;

function scriptOf(p: { scriptJson: unknown }): PodcastSegment[] {
  return (p.scriptJson as PodcastSegment[]) ?? [];
}

async function podcastForTeacher(topicId: number, teacherId: number) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { digest: true } });
  if (!topic) throw notFound("Mavzu");
  await assertCourseTeacher(topic.courseId, teacherId);
  return topic;
}

/** Konspekt bo'limlari — podkast boblari. Eski (bo'limsiz) konspekt bo'lsa
 *  butun konspektdan bitta sun'iy bo'lim quriladi (podkast baribir chiqadi). */
function chaptersOf(digest: DigestJson, topicTitle: string): DigestSection[] {
  const sections = (digest.sections ?? []).filter((s) => (s.blocks ?? []).length > 0);
  if (sections.length) return sections;
  const blocks: DigestSection["blocks"] = [];
  for (const c of digest.concepts ?? []) blocks.push({ type: "para", text: c });
  for (const f of digest.facts ?? []) blocks.push({ type: "para", text: f });
  if (!blocks.length) return [];
  return [{ id: "", title: topicTitle, minutes: TARGET_MINUTES, sourceRef: "", blocks }];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Boblar orasidagi pauza (RPM limiti). */
const CHAPTER_GAP_MS = 6000;
/** Kvota (429) uchun uzoq kutish — fon-jobda bu muammo emas, yiqilish esa muammo. */
const QUOTA_RETRIES = 3;
const QUOTA_WAIT_MS = 45_000;

/**
 * Kvota xatosida (429) uzoq kutib qayta uradi. Fon-jobda 45 soniya kutish —
 * hech kimni kutdirmaydi, lekin butun podkastning yiqilishidan saqlaydi
 * (o'lchandi 2026-08-02: birinchi bob 429 bilan tushib, 20 daqiqalik ish
 * boshlanmasdan tugagan edi).
 */
async function withQuotaRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= QUOTA_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string })?.code;
      const quota = code === "ai_quota" || code === "ai_busy";
      if (!quota || attempt === QUOTA_RETRIES) throw err;
      console.warn(`[podcast] ${code} → ${QUOTA_WAIT_MS / 1000}s kutamiz (urinish ${attempt}/${QUOTA_RETRIES})`);
      await sleep(QUOTA_WAIT_MS);
    }
  }
  throw lastErr;
}

/** Mavzuning "tili" — alohida maydon yo'q, shuning uchun mavjud kontentdan olinadi. */
async function topicLanguage(topicId: number): Promise<"uz" | "ru"> {
  const item = await prisma.contentItem.findFirst({ where: { topicId }, select: { language: true }, orderBy: { id: "asc" } });
  return item?.language === "ru" ? "ru" : "uz";
}

// ---------- Manba matnini boblarga taqsimlash (AI'siz) ----------

/** Bitta bobga beriladigan manba hajmi (belgi). */
const EXCERPT_CHARS = 2200;
const EXCERPTS_PER_CHAPTER = 3;
/** Butun material matnidan o'qiladigan maksimum (xotira + token nazorati). */
const MATERIAL_BUDGET = 120_000;

/** Ma'noli so'zlar (qisqa/umumiy so'zlar tashlanadi) — oddiy o'xshashlik uchun. */
function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5)
  );
}

/** Mavzuning barcha materiallari matni (bo'lsa) — bitta oqim. */
async function materialText(topicId: number): Promise<string> {
  const materials = await prisma.sourceMaterial.findMany({
    where: { topicId, parseStatus: "DONE" },
    orderBy: { id: "asc" },
    select: { parsedTextUrl: true },
  });
  let out = "";
  for (const m of materials) {
    if (!m.parsedTextUrl || out.length >= MATERIAL_BUDGET) continue;
    try {
      out += (out ? "\n\n" : "") + (await readText(m.parsedTextUrl)).slice(0, MATERIAL_BUDGET - out.length);
    } catch {
      /* fayl yo'q — materialsiz davom etamiz */
    }
  }
  return out;
}

/**
 * Bobga eng mos manba parchalarini tanlaydi — embeddingsiz, sof kalit so'z
 * kesishuvi bo'yicha. Sabab: bu qadam AI chaqiruvi bo'lmasligi kerak (xarajat 0,
 * fleshkarta/mindmap presedenti), va tibbiy matnda sarlavha so'zlari parchada
 * deyarli har doim uchraydi — sodda skoring yetarli.
 */
function pickExcerpts(text: string, section: DigestSection, used: Set<number>): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += EXCERPT_CHARS) chunks.push(text.slice(i, i + EXCERPT_CHARS));

  const needle = keywords(`${section.title} ${sectionPlain(section)}`);
  const scored = chunks
    .map((chunk, i) => {
      if (used.has(i)) return { i, chunk, score: -1 };
      const have = keywords(chunk);
      let score = 0;
      for (const w of needle) if (have.has(w)) score++;
      return { i, chunk, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, EXCERPTS_PER_CHAPTER);

  // Mos parcha topilmasa — hech bo'lmasa matn boshidan bir bo'lak (kirish odatda
  // umumiy ta'rif bo'ladi), aks holda bob quruq qolardi.
  if (!scored.length && chunks.length) {
    const first = chunks.findIndex((_, i) => !used.has(i));
    if (first >= 0) {
      used.add(first);
      return [chunks[first]];
    }
    return [];
  }
  for (const s of scored) used.add(s.i);
  return scored.map((s) => s.chunk);
}

function sectionPlain(s: DigestSection): string {
  return (s.blocks ?? [])
    .map((b) => (b.type === "list" ? b.items.map((it) => `${it.lead ?? ""} ${it.text}`).join(" ") : b.text))
    .join(" ");
}

async function setStatus(id: number, status: "PENDING" | "SCRIPT" | "TTS" | "RENDER" | "DONE" | "ERROR", errorStage?: string | null) {
  await prisma.topicPodcast.update({
    where: { id },
    data: { buildStatus: status, ...(errorStage !== undefined ? { errorStage } : {}) },
  });
}

// ---------- 1. SCRIPT ----------

async function stageScript(podcastId: number) {
  const p = await prisma.topicPodcast.findUnique({ where: { id: podcastId }, include: podcastInclude });
  if (!p) return;
  if (scriptOf(p).length > 0) return; // qayta ishga tushirish — skript bor

  const digest = p.topic.digest?.digestJson as unknown as DigestJson | undefined;
  if (!digest) throw badRequest("Konspekt yoʻq", "Конспекта нет");
  const chapters = chaptersOf(digest, p.topic.title);
  if (!chapters.length) throw badRequest("Konspekt matni yetarli emas", "Недостаточно текста конспекта");

  const topicId = p.topicId;
  const departmentId = await departmentForTopic(topicId);
  const totalWords = TARGET_MINUTES * WORDS_PER_MIN;
  const perChapter = Math.min(MAX_CHAPTER_WORDS, Math.max(MIN_CHAPTER_WORDS, Math.round(totalWords / chapters.length)));

  await setStatus(podcastId, "SCRIPT");
  // Manba matni bir marta o'qiladi va boblarga taqsimlanadi (takrorlanmasin
  // uchun `usedChunks` — bir parcha ikki bobda gapirilmaydi).
  const source = await materialText(topicId);
  const usedChunks = new Set<number>();

  const segments: PodcastSegment[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const section = chapters[i];
    // Boblar orasida pauza — 5-8 ta ketma-ket chaqiruv RPM limitiga urilmasin.
    if (i > 0) await sleep(CHAPTER_GAP_MS);
    const gen = await withQuotaRetry(() =>
      generateStructured<PodcastChapterGen>({
      systemInstruction: podcastSystemPrompt(p.language),
      userContent: podcastChapterUserContent({
        topicTitle: p.topic.title,
        section,
        index: i,
        total: chapters.length,
        targetWords: perChapter,
        digest,
        sourceExcerpts: pickExcerpts(source, section, usedChunks),
        isFirst: i === 0,
        isLast: i === chapters.length - 1,
      }),
        responseSchema: podcastChapterResponseSchema,
        kind: "PODCAST",
        topicId,
        departmentId,
        thinking: true, // jonli, bog'langan suhbat uchun arziydi
      })
    );
    const parsed = podcastChapterGenSchema.safeParse(gen);
    const lines = (parsed.success ? parsed.data : gen).lines ?? [];
    lines.forEach((line, li) => {
      const text = String(line.text ?? "").trim();
      if (!text) return;
      segments.push({
        speaker: line.speaker === "expert" ? "expert" : "host",
        text,
        // Bob sarlavhasi FAQAT birinchi replikada — pleyerdagi "boblar" ro'yxati.
        chapterTitle: li === 0 ? section.title : null,
        sectionId: section.id || null,
        durationSec: 0,
      });
    });
    // ⚠️ HAR BOBDAN KEYIN saqlaymiz: 20 daqiqalik ssenariy 5-8 chaqiruv —
    // jarayon uzilsa yozilgan boblar yo'qolmasin (video pipeline saboqi §12).
    await prisma.topicPodcast.update({ where: { id: podcastId }, data: { scriptJson: segments as object } });
  }

  if (!segments.length) throw badRequest("Ssenariy yaratilmadi", "Сценарий не создан");
}

// ---------- 2. TTS + 3. MIX ----------

async function stageVoice(podcastId: number) {
  const p = await prisma.topicPodcast.findUnique({ where: { id: podcastId }, include: podcastInclude });
  if (!p) return;
  const segments = scriptOf(p);
  if (!segments.length) return;

  const topicId = p.topicId;
  const departmentId = await departmentForTopic(topicId);
  const course = await prisma.course.findUnique({ where: { id: p.topic.courseId }, select: { teacherId: true } });
  // Ikki ovoz: boshlovchi — ayol, mutaxassis — erkak.
  const voices = {
    host: voicePair(p.language, "female"),
    expert: voicePair(p.language, "male"),
  };

  const dir = await mkdtemp(path.join(os.tmpdir(), "meduni-podcast-"));
  try {
    await setStatus(podcastId, "TTS");
    const wavs: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const voice = voices[seg.speaker] ?? voices.host;
      const hash = createHash("sha1").update(`${voice.gemini}|${voice.edge}::${seg.text}`).digest("hex");
      const name = `p${i}`;
      const wavName = `${name}.wav`;
      let reused = false;

      if (seg.audioHash === hash && seg.audioUrl) {
        const buf = await readFileBuffer(seg.audioUrl).catch(() => null);
        if (buf) {
          await writeFile(path.join(dir, wavName), buf);
          reused = true; // durationSec allaqachon saqlangan
        }
      }
      if (!reused) {
        seg.durationSec = await synthToWav(seg.text, voice, dir, name, {
          topicId,
          departmentId,
          userId: course?.teacherId ?? null,
        });
        seg.audioUrl = await saveBytes(
          `topics/${topicId}/podcast/${p.id}/seg-${hash}.wav`,
          await readFile(path.join(dir, wavName))
        );
        seg.audioHash = hash;
        // Har replikadan keyin saqlaymiz — uzilgan job qolgan joyidan davom etadi.
        await prisma.topicPodcast.update({ where: { id: podcastId }, data: { scriptJson: segments as object } });
      }
      wavs.push(wavName);
    }

    // Barchasi 24 kHz mono s16 → copy-concat xavfsiz.
    await writeFile(path.join(dir, "list.txt"), wavs.map((f) => `file '${f}'`).join("\n"), "utf8");
    await run(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "all.wav"], { cwd: dir });
    // 20 daqiqalik WAV ~57 MB — talabaga AAC (~14 MB) beriladi.
    await run(
      FFMPEG,
      ["-y", "-i", "all.wav", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "podcast.m4a"],
      { cwd: dir }
    );
    const rel = await saveBytes(
      `topics/${topicId}/podcast/${p.id}/podcast.m4a`,
      await readFile(path.join(dir, "podcast.m4a"))
    );

    await prisma.topicPodcast.update({
      where: { id: podcastId },
      data: {
        scriptJson: segments as object,
        audioUrl: rel,
        durationSec: segments.reduce((a, s) => a + (s.durationSec || 0), 0),
        buildStatus: "DONE",
        errorStage: null,
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runPipeline(podcastId: number) {
  try {
    await stageScript(podcastId);
    await stageVoice(podcastId);
  } catch (err) {
    const msg = String((err as Error)?.message ?? err ?? "").slice(0, 300);
    console.error("[podcast] build failed:", msg);
    // §17 saboqi: xato SABABI saqlanadi (faqat bosqich emas) — aks holda
    // o'qituvchi nega tugamaganini bilmasdan qayta-qayta bosaveradi.
    await setStatus(podcastId, "ERROR", msg || "unknown").catch(() => {});
  }
}

// ---------- Public API ----------

export interface PodcastChapter {
  title: string;
  startSec: number;
  sectionId: string | null;
}

/** Boblar ro'yxati — pleyerdagi navigatsiya (har bob boshlanish sekundi). */
export function chaptersFromScript(segments: PodcastSegment[]): PodcastChapter[] {
  const out: PodcastChapter[] = [];
  let t = 0;
  for (const seg of segments) {
    if (seg.chapterTitle) out.push({ title: seg.chapterTitle, startSec: Math.round(t), sectionId: seg.sectionId ?? null });
    t += seg.durationSec || 0;
  }
  return out;
}

function toOut(p: {
  id: number;
  digestVersion: number;
  language: string;
  scriptJson: unknown;
  audioUrl: string | null;
  durationSec: number | null;
  buildStatus: string;
  errorStage: string | null;
}, currentDigestVersion: number) {
  const segments = scriptOf(p);
  const voiced = segments.filter((s) => !!s.audioUrl).length;
  return {
    id: p.id,
    status: p.buildStatus.toLowerCase(),
    errorStage: p.errorStage,
    language: p.language,
    durationSec: p.durationSec,
    hasAudio: !!p.audioUrl,
    /** Jonli progress: "Ovoz: 12/34" (§12 — bosqich nomi emas, HAQIQIY hisob). */
    progress: { voiced, total: segments.length },
    chapters: chaptersFromScript(segments),
    /** Konspekt tahrirlangan bo'lsa podkast eskirgan — qayta yaratish kerak. */
    stale: p.digestVersion !== currentDigestVersion,
  };
}

/** O'qituvchi: podkast holati (yo'q bo'lsa null). */
export async function getPodcast(topicId: number, teacherId: number) {
  const topic = await podcastForTeacher(topicId, teacherId);
  const p = await prisma.topicPodcast.findUnique({ where: { topicId } });
  if (!p) return null;
  return toOut(p, topic.digest?.version ?? 1);
}

/** O'qituvchi: podkastni yaratish/qayta yaratish (fon-job). */
export async function generatePodcast(
  topicId: number,
  teacherId: number,
  opts?: { rebuild?: boolean; language?: "uz" | "ru" }
) {
  const topic = await podcastForTeacher(topicId, teacherId);
  const digest = topic.digest;
  // Birinchi qulf: podkast ham konspektdan chiqadi, ya'ni konspekt tasdiqlangan
  // bo'lishi kerak (talaba eshitadigan narsa tekshirilmagan bo'lmasin).
  if (!digest?.approvedByTeacher) {
    throw badRequest("Avval konspektni tasdiqlang", "Сначала утвердите конспект");
  }
  const departmentId = await departmentForTopic(topicId);
  await assertQuota(departmentId);

  const existing = await prisma.topicPodcast.findUnique({ where: { topicId } });
  const rebuild = opts?.rebuild || (existing && existing.digestVersion !== digest.version);

  if (existing && existing.buildStatus !== "DONE" && existing.buildStatus !== "ERROR" && !opts?.rebuild) {
    // Allaqachon qurilmoqda — takroriy bosish yangi job ochmaydi.
    return toOut(existing, digest.version);
  }

  const row = existing
    ? await prisma.topicPodcast.update({
        where: { topicId },
        data: {
          buildStatus: "PENDING",
          errorStage: null,
          digestVersion: digest.version,
          // Konspekt o'zgargan bo'lsa (yoki majburiy rebuild) ssenariy YANGIDAN
          // yoziladi; aks holda mavjud ssenariy va ovoz keshi saqlanadi.
          ...(rebuild ? { scriptJson: [] as object, audioUrl: null, durationSec: null } : {}),
        },
      })
    : await prisma.topicPodcast.create({
        data: {
          topicId,
          digestVersion: digest.version,
          // Til: so'ralgani → mavzuning mavjud kontenti tili → uz.
          language: opts?.language ?? (await topicLanguage(topicId)),
          scriptJson: [] as object,
        },
      });

  enqueueMediaJob(`podcast:${row.id}`, () => runPipeline(row.id));
  return toOut(row, digest.version);
}

/** O'qituvchi: tayyor podkast audiosi. */
export async function getPodcastAudio(topicId: number, teacherId: number): Promise<Buffer> {
  await podcastForTeacher(topicId, teacherId);
  const p = await prisma.topicPodcast.findUnique({ where: { topicId } });
  if (!p?.audioUrl) throw notFound("Podkast");
  const buf = await readFileBuffer(p.audioUrl).catch(() => null);
  if (!buf) throw notFound("Podkast");
  return buf;
}

/** Fon-job tiklash (server ko'tarilganda) — `recovery.ts` chaqiradi. */
export async function resumePodcast(podcastId: number) {
  enqueueMediaJob(`podcast:${podcastId}`, () => runPipeline(podcastId));
}
