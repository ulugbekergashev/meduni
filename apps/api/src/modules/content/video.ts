import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { readFileBuffer, saveBytes } from "../../lib/storage";
import { FFMPEG, run } from "../../lib/exec";
import { generateStructured } from "../../ai/gemini";
import { recordAiUsage } from "../../ai/usage";
import { assertQuota } from "../../ai/quota";
import { departmentForTopic, getGlossaryForDepartment, glossaryBlock } from "../../ai/glossary";
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

function forbidden(): ApiError {
  return new ApiError(403, "forbidden", "Bu sizning kursingiz emas", "Это не ваш курс");
}

const VOICES: Record<string, string> = {
  "uz:female": "uz-UZ-MadinaNeural",
  "uz:male": "uz-UZ-SardorNeural",
  "ru:female": "ru-RU-SvetlanaNeural",
  "ru:male": "ru-RU-DmitryNeural",
};

// ---------- Ownership ----------

async function topicForTeacher(topicId: number, teacherId: number) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { course: true, digest: true } });
  if (!topic) throw notFound("Mavzu");
  if (topic.course.teacherId !== teacherId) throw forbidden();
  return topic;
}

const videoInclude = {
  contentItem: { include: { topic: { include: { course: true } } } },
} satisfies Prisma.VideoInclude;

type VideoFull = Prisma.VideoGetPayload<{ include: typeof videoInclude }>;

async function videoForTeacher(videoId: number, teacherId: number): Promise<VideoFull> {
  const v = await prisma.video.findUnique({ where: { id: videoId }, include: videoInclude });
  if (!v) throw notFound("Video");
  if (v.contentItem.topic.course.teacherId !== teacherId) throw forbidden();
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
  parts.push(`<rect width="${W}" height="${H}" fill="#F7F8FA"/>`);
  parts.push(`<rect width="${W}" height="150" fill="#0F9E8E"/>`);
  titleLines.slice(0, 2).forEach((ln, i) => {
    parts.push(
      `<text x="70" y="${95 + i * 60}" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="700" fill="#FFFFFF">${esc(ln)}</text>`
    );
  });

  let y = 280;
  for (const b of slide.bullets) {
    const lines = wrap(b, textW);
    parts.push(`<circle cx="82" cy="${y - 12}" r="8" fill="#0F9E8E"/>`);
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

async function renderVisualPng(visual: VideoVisual): Promise<Buffer> {
  const W = 1920, H = 1080;
  const BRAND = "#0F9E8E", INK = "#0F172A", BG = "#F7F8FA";
  const AMBER = "#D97706", AMBER_BG = "#FCF2E2";
  const parts: string[] = [];
  const bg = visual.kind === "warning" ? AMBER_BG : BG;
  const accent = visual.kind === "warning" ? AMBER : BRAND;
  parts.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);

  const txt = (x: number, y: number, size: number, weight: number, fill: string, s: string) =>
    `<text x="${x}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;

  if (visual.kind === "title") {
    // Centered title band.
    parts.push(`<rect x="0" y="518" width="${W}" height="8" fill="${BRAND}"/>`);
    wrap(visual.title, 34).slice(0, 3).forEach((ln, i) => {
      const w = ln.length * 30;
      parts.push(txt((W - w) / 2, 430 + i * 78, 60, 700, INK, ln));
    });
  } else if (visual.kind === "term") {
    // Big term card: title (term) + definition points.
    parts.push(`<rect x="0" y="0" width="18" height="${H}" fill="${BRAND}"/>`);
    parts.push(txt(120, 300, 72, 700, BRAND, visual.title));
    let y = 430;
    for (const p of visual.points) {
      wrap(p, 60).forEach((ln, i) => { parts.push(txt(120, y + i * 52, 40, 400, INK, ln)); });
      y += wrap(p, 60).length * 52 + 20;
    }
  } else {
    // points / warning: header bar + big bullet points.
    parts.push(`<rect width="${W}" height="150" fill="${accent}"/>`);
    if (visual.kind === "warning") parts.push(txt(70, 98, 52, 700, "#FFFFFF", "⚠ " + visual.title));
    else wrap(visual.title, 40).slice(0, 1).forEach(() => parts.push(txt(70, 98, 52, 700, "#FFFFFF", visual.title)));
    let y = 320;
    for (const p of visual.points) {
      const lines = wrap(p, 52);
      parts.push(`<circle cx="90" cy="${y - 16}" r="10" fill="${accent}"/>`);
      lines.forEach((ln, i) => { parts.push(txt(130, y + i * 58, 46, 500, INK, ln)); });
      y += lines.length * 58 + 40;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------- TTS (edge-tts) ----------

function srtLastEndSec(srt: string): number {
  const times = [...srt.matchAll(/-->\s*(\d\d):(\d\d):(\d\d),(\d\d\d)/g)];
  if (times.length === 0) return 0;
  const m = times[times.length - 1];
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

async function synthSegment(text: string, voice: string, dir: string, name: string): Promise<number> {
  const txtFile = path.join(dir, `${name}.txt`);
  const mp3 = path.join(dir, `${name}.mp3`);
  const srt = path.join(dir, `${name}.srt`);
  await writeFile(txtFile, text, "utf8");
  await run("python", ["-m", "edge_tts", "--voice", voice, "--file", txtFile, "--write-media", mp3, "--write-subtitles", srt]);
  const srtText = await readFile(srt, "utf8").catch(() => "");
  return Math.max(1, Math.round(srtLastEndSec(srtText)) || 3);
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
  const digest = (topic?.digest?.digestJson as unknown as DigestJson) ?? { objectives: [], concepts: [], terms: [], facts: [], dosages: [], imageIdeas: [] };
  const presContent = await prisma.contentItem.findUnique({
    where: { topicId_kind: { topicId, kind: "PRESENTATION" } },
    include: { presentation: true },
  });
  const slideTitles = ((presContent?.presentation?.slidesJson as unknown as Slide[]) ?? []).map((s) => s.title).filter(Boolean);

  const departmentId = await departmentForTopic(topicId);
  const glossary = glossaryBlock(await getGlossaryForDepartment(departmentId));
  const gen = await generateStructured<LectureScriptGen>({
    systemInstruction: videoScriptSystemPrompt(v.language) + glossary,
    userContent: videoScriptUserContent(digest, slideTitles),
    responseSchema: videoScriptResponseSchema,
    kind: "VIDEO",
    topicId,
    departmentId,
  });
  const parsed = lectureScriptGenSchema.safeParse(gen);
  const segs = (parsed.success ? parsed.data : gen).segments;
  const script: ScriptSegment[] = segs.map((s) => ({ narration: s.narration, visual: s.visual, durationSec: 0 }));
  await prisma.video.update({ where: { id: videoId }, data: { scriptJson: script as object } });
}

async function stageTtsAndRender(videoId: number) {
  const v = await prisma.video.findUnique({ where: { id: videoId }, include: videoInclude });
  if (!v) return;
  const topicId = v.contentItem.topicId;
  const voice = v.voiceId ?? VOICES[`${v.language}:female`];
  const segments = scriptOf(v);

  // Record TTS usage (edge-tts is free, but chars are tracked for admin monitoring).
  const ttsChars = segments.reduce((n, s) => n + (s.narration?.length ?? 0), 0);
  if (ttsChars > 0) {
    await recordAiUsage({ kind: "TTS", model: "edge-tts", topicId, departmentId: await departmentForTopic(topicId), ttsChars });
  }

  const presContent = await prisma.contentItem.findUnique({
    where: { topicId_kind: { topicId, kind: "PRESENTATION" } },
    include: { presentation: true },
  });
  const slides = (presContent?.presentation?.slidesJson as unknown as Slide[]) ?? [];

  const dir = await mkdtemp(path.join(os.tmpdir(), "meduni-video-"));
  try {
    // --- TTS ---
    await setStatus(videoId, "TTS");
    const segMp3s: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const dur = await synthSegment(segments[i].narration, voice, dir, `seg${i}`);
      segments[i].durationSec = dur;
      segMp3s.push(`seg${i}.mp3`);
    }
    // concat audio
    await writeFile(path.join(dir, "audio.txt"), segMp3s.map((f) => `file '${f}'`).join("\n"), "utf8");
    await run(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", "audio.txt", "-c", "copy", "audio.mp3"], { cwd: dir });
    const audioRel = await saveBytes(`topics/${topicId}/video/${v.id}/audio.mp3`, await readFile(path.join(dir, "audio.mp3")));
    await prisma.video.update({ where: { id: videoId }, data: { scriptJson: segments as object, audioUrl: audioRel } });

    // --- RENDER ---
    await setStatus(videoId, "RENDER");
    const listLines: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      let png: Buffer;
      if (seg.visual) {
        // New NotebookLM-style: render the segment's key-visual card.
        png = await renderVisualPng(seg.visual);
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
        "-y", "-f", "concat", "-safe", "0", "-i", "slides.txt", "-i", "audio.mp3",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "25", "-c:a", "aac", "-shortest", "video.mp4",
      ],
      { cwd: dir }
    );
    const mp4Rel = await saveBytes(`topics/${topicId}/video/${v.id}/video.mp4`, await readFile(path.join(dir, "video.mp4")));
    const srtRel = await saveBytes(`topics/${topicId}/video/${v.id}/subtitles.srt`, Buffer.from(buildSrt(segments), "utf8"));
    const total = segments.reduce((a, s) => a + s.durationSec, 0);

    await prisma.video.update({
      where: { id: videoId },
      data: { mp4Url: mp4Rel, srtUrl: srtRel, durationSec: total, buildStatus: "DONE", errorStage: null },
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
  setImmediate(() => void runPipeline(video!.id, false));
  return content.id;
}

/** Rebuild after script edit — skips SCRIPT, re-runs TTS + RENDER. */
export async function rebuildVideo(videoId: number, teacherId: number) {
  const v = await videoForTeacher(videoId, teacherId);
  await setStatus(v.id, "PENDING");
  // reset segment durations so TTS re-measures
  const segs = scriptOf(v).map((s) => ({ ...s, durationSec: 0 }));
  await prisma.video.update({ where: { id: v.id }, data: { scriptJson: segs as object } });
  setImmediate(() => void runPipeline(v.id, true));
}

export async function getVideoMedia(videoId: number, teacherId: number, kind: "mp4" | "srt") {
  const v = await videoForTeacher(videoId, teacherId);
  const rel = kind === "mp4" ? v.mp4Url : v.srtUrl;
  if (!rel) throw notFound("Fayl");
  return readFileBuffer(rel);
}
