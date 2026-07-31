import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { createHash } from "crypto";
import os from "os";
import path from "path";
import sharp from "sharp";
import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { readFileBuffer, saveBytes } from "../../lib/storage";
import { pcmToWav } from "../../lib/wav";
import { FFMPEG, run } from "../../lib/exec";
import { enqueueMediaJob } from "../../lib/jobQueue";
import { generateImage, generateSpeech, generateStructured } from "../../ai/gemini";
import { assertQuota } from "../../ai/quota";
import { departmentForTopic } from "../../ai/glossary";
import { imagePromptForVisual } from "../../ai/prompts/images";
import {
  lectureScriptGenSchema,
  videoScriptResponseSchema,
  type DigestJson,
  type LectureScriptGen,
  type ScriptSegment,
  type Slide,
  type VideoVisual,
} from "../../ai/types";
import { videoScriptSystemPrompt, videoScriptUserContent } from "../../ai/prompts/videoScript";
import { assertCourseTeacher } from "../topics/service";

// ⚠️ XOTIRA (2026-08-01, jonli 502): Render Free — 512 MB. sharp sukut bo'yicha
// libvips keshini ushlab turadi va bir necha ipda ishlaydi; 1920x1080 kadrlarni
// ketma-ket render qilganda konteyner OOM bilan o'lardi (montaj yarmida uzilib,
// API 502 qaytardi). Kesh o'chirilib, bitta ipga tushirilsa — sekinroq, lekin
// omon qoladi (montaj baribir fon-jobda).
sharp.cache(false);
sharp.concurrency(1);

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}

// edge-tts voices — used only as a fallback if Gemini TTS fails for a segment.
const VOICES: Record<string, string> = {
  "uz:female": "uz-UZ-MadinaNeural",
  "uz:male": "uz-UZ-SardorNeural",
  "ru:female": "ru-RU-SvetlanaNeural",
  "ru:male": "ru-RU-DmitryNeural",
};

// Gemini native TTS voices (studio quality). Voice is language-agnostic.
const GEMINI_VOICES: Record<"female" | "male", string> = { female: "Kore", male: "Charon" };

/** Infer gender from the stored edge-tts voiceId → pick a Gemini voice. */
function geminiVoiceFor(voiceId: string | null): string {
  const female = !voiceId || /Madina|Svetlana/i.test(voiceId);
  return female ? GEMINI_VOICES.female : GEMINI_VOICES.male;
}

// ---------- Ownership (Faza 3: fan/kafedra darajasida) ----------

async function topicForTeacher(topicId: number, teacherId: number) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { digest: true } });
  if (!topic) throw notFound("Mavzu");
  await assertCourseTeacher(topic.courseId, teacherId);
  return topic;
}

const videoInclude = {
  contentItem: { include: { topic: true } },
} satisfies Prisma.VideoInclude;

type VideoFull = Prisma.VideoGetPayload<{ include: typeof videoInclude }>;

async function videoForTeacher(videoId: number, teacherId: number): Promise<VideoFull> {
  const v = await prisma.video.findUnique({ where: { id: videoId }, include: videoInclude });
  if (!v) throw notFound("Video");
  await assertCourseTeacher(v.contentItem.topic.courseId, teacherId);
  return v;
}

function scriptOf(v: { scriptJson: unknown }): ScriptSegment[] {
  return (v.scriptJson as unknown as ScriptSegment[]) ?? [];
}

// ---------- Slide -> PNG (sharp + SVG) ----------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

async function renderSlidePng(slide: Slide, imageBuf: Buffer | null): Promise<Buffer> {
  const W = 1920;
  const H = 1080;
  const hasImg = !!imageBuf;
  const textW = hasImg ? 60 : 90; // wrap width in chars

  const titleLines = wrap(slide.title, hasImg ? 34 : 52);
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#F6F7F9"/>`);
  parts.push(`<rect width="${W}" height="150" fill="#4F46E5"/>`);
  titleLines.slice(0, 2).forEach((ln, i) => {
    parts.push(
      `<text x="70" y="${95 + i * 60}" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="700" fill="#FFFFFF">${esc(ln)}</text>`
    );
  });

  let y = 280;
  for (const b of slide.bullets) {
    const lines = wrap(b, textW);
    parts.push(`<circle cx="82" cy="${y - 12}" r="8" fill="#4F46E5"/>`);
    lines.forEach((ln, i) => {
      parts.push(
        `<text x="110" y="${y + i * 46}" font-family="Segoe UI, Arial, sans-serif" font-size="36" fill="#0F172A">${esc(ln)}</text>`
      );
    });
    y += lines.length * 46 + 30;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
  let base = sharp(Buffer.from(svg));

  if (imageBuf) {
    const resized = await sharp(imageBuf).resize(720, 720, { fit: "inside" }).png().toBuffer();
    const meta = await sharp(resized).metadata();
    base = base.composite([{ input: resized, left: W - (meta.width ?? 720) - 90, top: 300 }]);
  }
  return base.png().toBuffer();
}

// ---------- Visual card -> PNG (NotebookLM-style lecture frames) ----------

async function renderVisualPng(visual: VideoVisual, imageBuf: Buffer | null): Promise<Buffer> {
  const W = 1920, H = 1080;
  const BRAND = "#4F46E5", INK = "#101828", BG = "#F6F7F9";
  const AMBER = "#D97706", AMBER_BG = "#FEF3E2";

  const txt = (x: number, y: number, size: number, weight: number, fill: string, s: string, anchor = "start") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;

  // HERO layout: when a diagram exists, make it the star — a title bar on top and
  // the large labeled illustration centered below (the diagram carries its own
  // labels, so no competing bullet text). Applies to points/term cards.
  const hero = !!imageBuf && (visual.kind === "points" || visual.kind === "term");
  if (hero) {
    const barH = 150;
    const parts: string[] = [];
    parts.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);
    parts.push(`<rect width="${W}" height="${barH}" fill="${BRAND}"/>`);
    wrap(visual.title, 50).slice(0, 1).forEach(() => parts.push(txt(70, 96, 50, 700, "#FFFFFF", visual.title)));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
    const areaW = W - 160, areaH = H - barH - 90;
    const resized = await sharp(imageBuf!).resize(areaW, areaH, { fit: "inside" }).png().toBuffer();
    const meta = await sharp(resized).metadata();
    const iw = meta.width ?? areaW, ih = meta.height ?? areaH;
    const left = Math.round((W - iw) / 2);
    const top = barH + Math.round((H - barH - ih) / 2);
    return sharp(Buffer.from(svg)).composite([{ input: resized, left, top }]).png().toBuffer();
  }

  // Text cards (no illustration): title intro, dosage warning, or points/term
  // when image generation was unavailable.
  const parts: string[] = [];
  const bg = visual.kind === "warning" ? AMBER_BG : BG;
  const accent = visual.kind === "warning" ? AMBER : BRAND;
  parts.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);

  if (visual.kind === "title") {
    parts.push(`<rect x="0" y="518" width="${W}" height="8" fill="${BRAND}"/>`);
    wrap(visual.title, 34).slice(0, 3).forEach((ln, i) => parts.push(txt(W / 2, 430 + i * 78, 60, 700, INK, ln, "middle")));
  } else if (visual.kind === "term") {
    parts.push(`<rect x="0" y="0" width="18" height="${H}" fill="${BRAND}"/>`);
    parts.push(txt(120, 300, 72, 700, BRAND, visual.title));
    let y = 430;
    for (const p of visual.points) {
      wrap(p, 60).forEach((ln, i) => parts.push(txt(120, y + i * 52, 40, 400, INK, ln)));
      y += wrap(p, 60).length * 52 + 20;
    }
  } else {
    parts.push(`<rect width="${W}" height="150" fill="${accent}"/>`);
    parts.push(txt(70, 98, 52, 700, "#FFFFFF", visual.kind === "warning" ? "⚠ " + visual.title : visual.title));
    let y = 320;
    for (const p of visual.points) {
      const lines = wrap(p, 52);
      parts.push(`<circle cx="90" cy="${y - 16}" r="10" fill="${accent}"/>`);
      lines.forEach((ln, i) => parts.push(txt(130, y + i * 58, 46, 500, INK, ln)));
      y += lines.length * 58 + 40;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------- TTS ----------
// Primary: Gemini native TTS (studio quality). Fallback per segment: edge-tts.
// Every segment is normalized to a 24 kHz mono 16-bit WAV so they concat cleanly.

const TTS_RATE = 24000;

interface TtsUsage { topicId?: number; departmentId?: number | null; userId?: number | null }

/** Synthesize one segment to `${name}.wav` (24 kHz mono). Returns duration in seconds. */
async function synthSegment(
  text: string,
  geminiVoice: string,
  edgeVoice: string,
  dir: string,
  name: string,
  usage: TtsUsage
): Promise<number> {
  const wav = path.join(dir, `${name}.wav`);
  try {
    const { pcm, sampleRate } = await generateSpeech(text, geminiVoice, usage);
    await writeFile(wav, pcmToWav(pcm, sampleRate));
    return Math.max(1, Math.round(pcm.length / (sampleRate * 2)));
  } catch {
    // Fallback: edge-tts (python) → mp3 → normalized 24 kHz mono WAV.
    const txtFile = path.join(dir, `${name}.txt`);
    const mp3 = path.join(dir, `${name}.mp3`);
    await writeFile(txtFile, text, "utf8");
    await run("python", ["-m", "edge_tts", "--voice", edgeVoice, "--file", txtFile, "--write-media", mp3]);
    await run(FFMPEG, ["-y", "-i", `${name}.mp3`, "-ar", String(TTS_RATE), "-ac", "1", `${name}.wav`], { cwd: dir });
    const size = (await readFile(wav)).length;
    return Math.max(1, Math.round((size - 44) / (TTS_RATE * 2)));
  }
}

// ---------- SRT builder (combined, cumulative) ----------

function sec2ts(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(ms, 3)}`;
}

function buildSrt(segments: ScriptSegment[]): string {
  let t = 0;
  return segments
    .map((seg, i) => {
      const start = t;
      const end = t + seg.durationSec;
      t = end;
      return `${i + 1}\n${sec2ts(start)} --> ${sec2ts(end)}\n${seg.narration}\n`;
    })
    .join("\n");
}

// ---------- Pipeline ----------

async function setStatus(videoId: number, status: Prisma.VideoUpdateInput["buildStatus"], errorStage?: string | null) {
  await prisma.video.update({ where: { id: videoId }, data: { buildStatus: status, errorStage: errorStage ?? null } });
}

async function stageScript(videoId: number) {
  const v = await prisma.video.findUnique({ where: { id: videoId }, include: videoInclude });
  if (!v) return;
  if (scriptOf(v).length > 0) return; // already have a script (e.g. rebuild after edit)

  const topicId = v.contentItem.topicId;
  // Lecture is written from the approved digest (single source of truth), with
  // presentation section titles as an optional structural hint.
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { digest: true } });
  const digest = (topic?.digest?.digestJson as unknown as DigestJson) ?? { sections: [], objectives: [], concepts: [], terms: [], facts: [], dosages: [], imageIdeas: [] };
  const presContent = await prisma.contentItem.findUnique({
    where: { topicId_kind: { topicId, kind: "PRESENTATION" } },
    include: { presentation: true },
  });
  const slideTitles = ((presContent?.presentation?.slidesJson as unknown as Slide[]) ?? []).map((s) => s.title).filter(Boolean);

  const departmentId = await departmentForTopic(topicId);
  const gen = await generateStructured<LectureScriptGen>({
    systemInstruction: videoScriptSystemPrompt(v.language),
    userContent: videoScriptUserContent(digest, slideTitles),
    responseSchema: videoScriptResponseSchema,
    kind: "VIDEO",
    topicId,
    departmentId,
    thinking: true, // richer, better-structured lecture is worth the extra tokens
  });
  const parsed = lectureScriptGenSchema.safeParse(gen);
  const segs = (parsed.success ? parsed.data : gen).segments;
  // Faza 0: AI qaytargan sectionIndex → digest boʻlimining barqaror ID'si (vaqt
  // xaritasi + video rasm reuse uchun). Diapazondan tashqari → null (graceful).
  const sections = digest.sections ?? [];
  const sectionIdAt = (i: number): string | null => (i >= 0 && i < sections.length ? sections[i].id || null : null);
  const script: ScriptSegment[] = segs.map((s) => ({
    narration: s.narration,
    visual: s.visual,
    durationSec: 0,
    sectionId: sectionIdAt(s.sectionIndex ?? -1),
  }));
  await prisma.video.update({ where: { id: videoId }, data: { scriptJson: script as object } });
}

// Cap illustrations per video so a very long lecture can't run up cost/time;
// beyond it, explanatory cards render as clean text frames.
const MAX_VIDEO_IMAGES = 18;

async function stageTtsAndRender(videoId: number) {
  const v = await prisma.video.findUnique({ where: { id: videoId }, include: videoInclude });
  if (!v) return;
  const topicId = v.contentItem.topicId;
  // Fon-jobda initsiatorni bilmaymiz — AiUsage fanning birinchi kurs o'qituvchisiga yoziladi.
  const subjectCourse = await prisma.course.findFirst({
    where: { id: v.contentItem.topic.courseId },
    orderBy: { id: "asc" },
    select: { teacherId: true },
  });
  const teacherId = subjectCourse?.teacherId ?? null;
  const departmentId = await departmentForTopic(topicId);
  const edgeVoice = v.voiceId ?? VOICES[`${v.language}:female`];
  const geminiVoice = geminiVoiceFor(v.voiceId);
  const segments = scriptOf(v);

  const presContent = await prisma.contentItem.findUnique({
    where: { topicId_kind: { topicId, kind: "PRESENTATION" } },
    include: { presentation: true },
  });
  const slides = (presContent?.presentation?.slidesJson as unknown as Slide[]) ?? [];

  // 3B (xarajat): bo'lim → o'sha bo'limning tayyor slayd rasmi. Segment shu bo'limga
  // tegishli bo'lsa, yangi rasm GENERATSIYA QILMAY, mavjud slayd rasmini ishlatadi
  // (Faza 0 sectionId xaritasi). Video rasm xarajati deyarli 0 ga tushadi.
  const slideImageBySection = new Map<string, string>();
  for (const sl of slides) {
    const url = sl.imageSlots?.[0]?.url;
    if (sl.sectionId && sl.imageSlots?.[0]?.status === "DONE" && url && !slideImageBySection.has(sl.sectionId)) {
      slideImageBySection.set(sl.sectionId, url);
    }
  }
  // ⚠️ ZAXIRA (2026-08-01): bo'lim bog'lanishi (sectionId) HAR DOIM ham bo'lmaydi —
  // eski konspektlarda bo'lim ID'lari yo'q, AI ham -1 qaytarishi mumkin. O'shanda
  // yuqoridagi xarita bo'sh qolib, video butunlay matn-kadrlardan iborat bo'lardi
  // (o'lchandi: 9 segmentdan 0 tasi rasmli). Endi tayyor slayd rasmlari TARTIB
  // bo'yicha segmentlarga taqsimlanadi — bepul va videoda bir nechta rasm bo'ladi.
  const orderedSlideImages = slides
    .map((sl) => (sl.imageSlots?.[0]?.status === "DONE" ? sl.imageSlots[0].url : null))
    .filter((u): u is string => !!u);
  let reusePtr = 0;

  const dir = await mkdtemp(path.join(os.tmpdir(), "meduni-video-"));
  try {
    // --- TTS (Gemini native, per segment → normalized WAV) ---
    // 3E (xarajat): har segment audiosi narration+voice hash bo'yicha keshlanadi.
    // Rebuild'da o'zgarmagan segment QAYTA OVOZLANMAYDI — faqat tahrirlangani.
    // Fayl nomi hash bo'yicha (indeks emas) → reorder'da to'qnashuv yo'q.
    await setStatus(videoId, "TTS");
    const segWavs: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const hash = createHash("sha1").update(`${geminiVoice}::${seg.narration}`).digest("hex");
      const wavName = `seg${i}.wav`;
      let reused = false;
      if (seg.audioHash === hash && seg.audioUrl) {
        const buf = await readFileBuffer(seg.audioUrl).catch(() => null);
        if (buf) {
          await writeFile(path.join(dir, wavName), buf);
          reused = true; // durationSec allaqachon segmentда saqlangan
        }
      }
      if (!reused) {
        const dur = await synthSegment(seg.narration, geminiVoice, edgeVoice, dir, `seg${i}`, { topicId, departmentId, userId: teacherId });
        seg.durationSec = dur;
        seg.audioUrl = await saveBytes(`topics/${topicId}/video/${v.id}/seg-${hash}.wav`, await readFile(path.join(dir, wavName)));
        seg.audioHash = hash;
        // ⚠️ HAR SEGMENTDAN KEYIN saqlaymiz. Ilgari scriptJson faqat BUTUN sikl
        // tugagach yozilardi — jarayon 9/15 da o'lsa (Render restart/OOM) 9 ta
        // ovozlangan segment ham yo'qolardi va qayta urinish NOLDAN boshlardi.
        // Endi uzilgan job qolgan joyidan davom etadi (audioHash keshi).
        await prisma.video.update({ where: { id: videoId }, data: { scriptJson: segments as object } });
      }
      segWavs.push(wavName);
    }
    // concat audio (all segments are 24 kHz mono s16 → copy-concat is safe)
    await writeFile(path.join(dir, "audio.txt"), segWavs.map((f) => `file '${f}'`).join("\n"), "utf8");
    await run(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", "audio.txt", "-c", "copy", "audio.wav"], { cwd: dir });
    const audioRel = await saveBytes(`topics/${topicId}/video/${v.id}/audio.wav`, await readFile(path.join(dir, "audio.wav")));
    await prisma.video.update({ where: { id: videoId }, data: { scriptJson: segments as object, audioUrl: audioRel } });

    // --- RENDER ---
    await setStatus(videoId, "RENDER");
    let imagesMade = 0;
    const listLines: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      let png: Buffer;
      if (seg.visual) {
        // NotebookLM-style card. Explanatory cards (points/term) are enriched
        // with a Nano Banana illustration, generated once and cached on the
        // segment so rebuilds reuse it. Any failure falls back to a text card.
        let imgBuf: Buffer | null = null;
        // 2026-08-01 (buyurtmachi: "videoda bir nechta rasm bo'lishi kerak"):
        // TAYYOR slayd rasmini har turdagi segment ishlatishi mumkin (bepul,
        // cheklovga kirmaydi) — shu bois kirish/xulosa kadrlari ham rasmli.
        // YANGI rasm esa faqat tushuntiruvchi kartalarga generatsiya qilinadi.
        if (!seg.visualImageUrl && seg.sectionId) {
          const reuse = slideImageBySection.get(seg.sectionId);
          if (reuse) seg.visualImageUrl = reuse;
        }
        if (!seg.visualImageUrl && orderedSlideImages.length) {
          seg.visualImageUrl = orderedSlideImages[reusePtr % orderedSlideImages.length];
          reusePtr++;
        }
        const wantsImage = seg.visual.kind === "points" || seg.visual.kind === "term";
        if (wantsImage || seg.visualImageUrl) {
          if (wantsImage && !seg.visualImageUrl && imagesMade < MAX_VIDEO_IMAGES) {
            try {
              const img = await generateImage(imagePromptForVisual(seg.visual, v.language), {
                kind: "IMAGE",
                topicId,
                departmentId,
                userId: teacherId,
              });
              seg.visualImageUrl = await saveBytes(`topics/${topicId}/video/${v.id}/seg${i}.png`, img.buffer);
              imagesMade++;
              // Rasm pullik — uzilib qolsa qayta to'lanmasin (segmentда keshlanadi).
              await prisma.video.update({ where: { id: videoId }, data: { scriptJson: segments as object } });
            } catch {
              seg.visualImageUrl = null; // quota/429/etc → clean text card
            }
          }
          if (seg.visualImageUrl) imgBuf = await readFileBuffer(seg.visualImageUrl).catch(() => null);
        }
        png = await renderVisualPng(seg.visual, imgBuf);
      } else {
        // Legacy fallback: slide-narration videos rebuild without breaking.
        const slide = slides[seg.slideIndex ?? 0] ?? slides[0];
        let imgBuf: Buffer | null = null;
        const url = slide?.imageSlots?.[0]?.url;
        if (slide?.imageSlots?.[0]?.status === "DONE" && url) imgBuf = await readFileBuffer(url).catch(() => null);
        png = await renderSlidePng(slide ?? { id: "", layout: "BULLETS", title: "", bullets: [], speakerNotes: "", imageSlots: [] }, imgBuf);
      }
      await writeFile(path.join(dir, `slide${i}.png`), png);
      listLines.push(`file 'slide${i}.png'`, `duration ${seg.durationSec}`);
    }
    listLines.push(`file 'slide${segments.length - 1}.png'`); // concat needs last frame repeated
    await writeFile(path.join(dir, "slides.txt"), listLines.join("\n"), "utf8");

    await run(
      FFMPEG,
      [
        "-y", "-f", "concat", "-safe", "0", "-i", "slides.txt", "-i", "audio.wav",
        // `-threads 1` + `veryfast` — 512 MB konteynerда x264 xotirasi keskin
        // kamayadi (ko'p ipli kodlashда har ip o'z bufer to'plamini oladi).
        "-c:v", "libx264", "-preset", "veryfast", "-threads", "1",
        "-pix_fmt", "yuv420p", "-r", "25", "-c:a", "aac", "-b:a", "192k", "-shortest", "video.mp4",
      ],
      { cwd: dir }
    );
    const mp4Rel = await saveBytes(`topics/${topicId}/video/${v.id}/video.mp4`, await readFile(path.join(dir, "video.mp4")));
    const srtRel = await saveBytes(`topics/${topicId}/video/${v.id}/subtitles.srt`, Buffer.from(buildSrt(segments), "utf8"));
    const total = segments.reduce((a, s) => a + s.durationSec, 0);

    await prisma.video.update({
      where: { id: videoId },
      // Persist segments again so cached illustration URLs (set during render) survive rebuilds.
      data: { scriptJson: segments as object, mp4Url: mp4Rel, srtUrl: srtRel, durationSec: total, buildStatus: "DONE", errorStage: null },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runPipeline(videoId: number, fromRebuild: boolean) {
  try {
    if (!fromRebuild) {
      await setStatus(videoId, "SCRIPT");
      await stageScript(videoId);
    }
    await stageTtsAndRender(videoId);
  } catch (err) {
    const v = await prisma.video.findUnique({ where: { id: videoId } });
    const stage = v?.buildStatus === "SCRIPT" || v?.buildStatus === "PENDING" ? "SCRIPT" : v?.buildStatus === "TTS" ? "TTS" : "RENDER";
    await setStatus(videoId, "ERROR", stage);
    console.error("video pipeline error:", err);
  }
}

// ---------- Public API ----------

export async function generateVideo(
  topicId: number,
  teacherId: number,
  opts: { language: "uz" | "ru"; voice: "male" | "female" }
) {
  const topic = await topicForTeacher(topicId, teacherId);
  await assertQuota(await departmentForTopic(topicId));
  // Lecture video is built from the approved digest (like quiz/case) — presentation optional.
  if (!topic.digest?.approvedByTeacher) {
    throw new ApiError(403, "digest_not_approved", "Avval konspektni tasdiqlang", "Сначала утвердите конспект");
  }

  const voiceId = VOICES[`${opts.language}:${opts.voice}`] ?? VOICES[`${opts.language}:female`];
  const existing = await prisma.contentItem.findUnique({ where: { topicId_kind: { topicId, kind: "VIDEO" } } });

  const content = await prisma.$transaction(async (tx) => {
    const item = existing
      ? await tx.contentItem.update({
          where: { id: existing.id },
          data: { language: opts.language, status: "DRAFT", editedByTeacher: false, version: { increment: 1 } },
        })
      : await tx.contentItem.create({ data: { topicId, kind: "VIDEO", language: opts.language, status: "DRAFT" } });

    await tx.video.upsert({
      where: { contentItemId: item.id },
      create: { contentItemId: item.id, scriptJson: [], language: opts.language, voiceId, buildStatus: "PENDING" },
      update: { scriptJson: [], language: opts.language, voiceId, buildStatus: "PENDING", audioUrl: null, mp4Url: null, srtUrl: null, errorStage: null },
    });
    return item;
  });

  const video = await prisma.video.findUnique({ where: { contentItemId: content.id } });
  enqueueMediaJob(`video:${video!.id}`, () => runPipeline(video!.id, false));
  return content.id;
}

/** UZILIB QOLGAN montajni DAVOM ETTIRISH — skript va ovozlangan segmentlar
 *  saqlangani uchun qoldiq ishdan boshlanadi (qayta to'lov yo'q).
 *  `teacherId` berilmasa (server tiklashi) egalik tekshirilmaydi. */
export async function resumeVideo(videoId: number, teacherId?: number) {
  if (teacherId !== undefined) await videoForTeacher(videoId, teacherId);
  const v = await prisma.video.findUnique({ where: { id: videoId } });
  if (!v) throw notFound("Video");
  // ⚠️ errorStage'ni O'CHIRMAYMIZ (server tiklashida): u yerda avtomatik
  // urinishlar hisobi turadi — aks holda cheksiz tiklash sikli bo'lardi.
  // O'qituvchi o'zi bosganда esa hisob nolga tushadi (yangi niyat).
  await prisma.video.update({
    where: { id: videoId },
    data: { buildStatus: "PENDING", ...(teacherId !== undefined ? { errorStage: null } : {}) },
  });
  enqueueMediaJob(`video:${videoId}`, () => runPipeline(videoId, scriptOf(v).length > 0));
}

/** Rebuild after script edit — skips SCRIPT, re-runs TTS + RENDER. */
export async function rebuildVideo(videoId: number, teacherId: number) {
  const v = await videoForTeacher(videoId, teacherId);
  await setStatus(v.id, "PENDING");
  // reset segment durations so TTS re-measures
  const segs = scriptOf(v).map((s) => ({ ...s, durationSec: 0 }));
  await prisma.video.update({ where: { id: v.id }, data: { scriptJson: segs as object } });
  enqueueMediaJob(`video:${v.id}`, () => runPipeline(v.id, true));
}

export async function getVideoMedia(videoId: number, teacherId: number, kind: "mp4" | "srt") {
  const v = await videoForTeacher(videoId, teacherId);
  const rel = kind === "mp4" ? v.mp4Url : v.srtUrl;
  if (!rel) throw notFound("Fayl");
  // Yozuv bor, fayl yo'q (eski disk-drayver davridagi media) → 500 emas, 404.
  const buf = await readFileBuffer(rel).catch(() => null);
  if (!buf) throw notFound("Video");
  return buf;
}
