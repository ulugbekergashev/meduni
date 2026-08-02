import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { createHash } from "crypto";
import os from "os";
import path from "path";
import sharp from "sharp";
import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { readFileBuffer, saveBytes } from "../../lib/storage";
import { FFMPEG, run } from "../../lib/exec";
import { enqueueMediaJob } from "../../lib/jobQueue";
import { synthToWav, type TtsUsage } from "../../lib/tts";
import { generateImage, generateStructured } from "../../ai/gemini";
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

/** Chiqish kadri o'lchami. SVG kanvas 1920x1080 da chiziladi (koordinatalar
 *  shunga moslangan), lekin PNG shu o'lchamga KICHRAYTIRILADI: 512 MB
 *  konteynerда 1080p kadrlar sharp+x264 uchun juda og'ir edi. 720p — ma'ruza
 *  videosi uchun yetarli; `VIDEO_HEIGHT=1080` bilan qaytarish mumkin. */
const NL = String.fromCharCode(10);
const OUT_H = Number(process.env.VIDEO_HEIGHT ?? 720);
const OUT_W = Math.round((OUT_H * 16) / 9);
/** SVG 1920x1080 koordinatalarda chiziladi, lekin `viewBox` orqali TO'G'RIDAN
 *  chiqish o'lchamida rasterlanadi — qo'shimcha resize bosqichi kerak emas.
 *
 *  ⚠️ Ilgari `.composite(...).resize(...)` yozilgandi. sharp konveyerida resize
 *  composite'dan OLDIN bajariladi: kanvas 720p ga kichrayib, ustiga 1080p rasm
 *  qo'yilardi va montaj "Image to composite must have same dimensions or smaller"
 *  bilan yiqilardi (jonli serverда aynan shu bo'ldi). */
const K = OUT_W / 1920;
const svgDoc = (parts: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="0 0 1920 1080">${parts}</svg>`;

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

  let base = sharp(Buffer.from(svgDoc(parts.join(""))));

  if (imageBuf) {
    // Kompozit chiqish kanvasi o'lchamida (K koeffitsiyenti) — undan katta bo'lsa sharp xato beradi.
    const box = Math.round(720 * K);
    const resized = await sharp(imageBuf).resize(box, box, { fit: "inside" }).png().toBuffer();
    const meta = await sharp(resized).metadata();
    base = base.composite([
      { input: resized, left: Math.round(W * K) - (meta.width ?? box) - Math.round(90 * K), top: Math.round(300 * K) },
    ]);
  }
  return base.jpeg({ quality: 86, mozjpeg: false }).toBuffer();
}

// ---------- Visual card -> PNG (NotebookLM-style lecture frames) ----------

/** Eksport — kadr dizaynini testda ko'z bilan tekshirish uchun. */
export async function renderVisualPng(visual: VideoVisual, imageBuf: Buffer | null): Promise<Buffer> {
  const W = 1920, H = 1080;
  const BRAND = "#4F46E5", INK = "#101828", BG = "#F6F7F9";
  const AMBER = "#D97706", AMBER_BG = "#FEF3E2";

  const txt = (x: number, y: number, size: number, weight: number, fill: string, s: string, anchor = "start") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;

  // HERO layout: when a diagram exists, make it the star — a title bar on top and
  // the large labeled illustration centered below (the diagram carries its own
  // labels, so no competing bullet text). Applies to points/term cards.
  // ⚠️ Rasm BOR bo'lsa — har turdagi kadr HERO ko'rinishida chiziladi (kirish/
  // xulosa ham). Faqat `warning` (doza ogohlantirishi) matn kartada qoladi:
  // u yerda o'qilishi rasm estetikasidan muhimroq.
  const hero = !!imageBuf && visual.kind !== "warning";
  if (hero) {
    const barH = 150;
    const parts: string[] = [];
    parts.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);
    parts.push(`<rect width="${W}" height="${barH}" fill="${BRAND}"/>`);
    wrap(visual.title, 50).slice(0, 1).forEach(() => parts.push(txt(70, 96, 50, 700, "#FFFFFF", visual.title)));
    // Rasm ham CHIQISH kanvasi o'lchamiga moslanadi (K), aks holda composite yiqiladi.
    const areaW = Math.round((W - 160) * K), areaH = Math.round((H - barH - 90) * K);
    const resized = await sharp(imageBuf!).resize(areaW, areaH, { fit: "inside" }).png().toBuffer();
    const meta = await sharp(resized).metadata();
    const iw = meta.width ?? areaW, ih = meta.height ?? areaH;
    const left = Math.round((OUT_W - iw) / 2);
    const top = Math.round(barH * K) + Math.round((OUT_H - barH * K - ih) / 2);
    return sharp(Buffer.from(svgDoc(parts.join(""))))
      .composite([{ input: resized, left, top }])
      .jpeg({ quality: 86, mozjpeg: false })
      .toBuffer();
  }

  // ⚠️ 2026-08-01 (buyurtmachi: "в начале и в конце очень простой рисунок…
  // просто такой текст показывается"): kirish va xulosa kadrlari sof matn edi va
  // 5–30 soniya shu ko'rinishda turardi. Endi matnli kadrlar ham KOMPOZITSIYA:
  // gradient fon, brend aksenti, EKG motivi, raqamlangan tezis qatorlari.
  const parts: string[] = [];
  const bg = visual.kind === "warning" ? AMBER_BG : BG;
  const accent = visual.kind === "warning" ? AMBER : BRAND;
  parts.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);

  if (visual.kind === "title") {
    // KIRISH/XULOSA kadri — to'liq gradient sahna: katta sarlavha, ostida
    // yupqa EKG chizig'i va tezislar (bo'lsa) chip sifatida.
    parts.length = 0;
    parts.push(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0%" stop-color="#3730A3"/><stop offset="55%" stop-color="${BRAND}"/><stop offset="100%" stop-color="#6D28D9"/>` +
        `</linearGradient></defs>`
    );
    parts.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);
    // Yumshoq dekorativ doiralar (chuqurlik hissi)
    parts.push(`<circle cx="${W - 180}" cy="170" r="240" fill="#FFFFFF" opacity="0.06"/>`);
    parts.push(`<circle cx="150" cy="${H - 120}" r="300" fill="#FFFFFF" opacity="0.05"/>`);

    const lines = wrap(visual.title, 30).slice(0, 3);
    const startY = 470 - (lines.length - 1) * 45;
    lines.forEach((ln, i) => parts.push(txt(W / 2, startY + i * 90, 68, 700, "#FFFFFF", ln, "middle")));

    // ⚠️ Bezak MAVZUGA BOG'LIQ BO'LMASIN (buyurtmachi: "bu yurak haqida
    // bo'lmasachi?"). Ilgari bu yerda EKG chizig'i turardi — u faqat kardiologiya
    // mavzusiga mos edi, botulizm yoki nefrologiyada esa bema'ni ko'rinardi.
    // Endi neytral ajratgich: ingichka chiziq + markazda nuqta.
    const baseY = startY + lines.length * 90 + 40;
    const half = 250;
    parts.push(
      `<line x1="${W / 2 - half}" y1="${baseY}" x2="${W / 2 - 30}" y2="${baseY}" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round"/>`
    );
    parts.push(
      `<line x1="${W / 2 + 30}" y1="${baseY}" x2="${W / 2 + half}" y2="${baseY}" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round"/>`
    );
    parts.push(`<circle cx="${W / 2}" cy="${baseY}" r="9" fill="#FFFFFF" opacity="0.8"/>`);

    // Tezislar — pastda ixcham chiplar (xulosa kadrida ayni muddao)
    const chips = (visual.points ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 3);
    if (chips.length) {
      let cy = baseY + 130;
      for (const c of chips) {
        const line = wrap(c, 58)[0];
        parts.push(`<rect x="${W / 2 - 560}" y="${cy - 44}" width="1120" height="66" rx="33" fill="#FFFFFF" opacity="0.14"/>`);
        parts.push(txt(W / 2, cy, 38, 600, "#FFFFFF", line, "middle"));
        cy += 88;
      }
    }
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
    // Har tezis — o'z kartasida, raqamlangan doira bilan (quruq ro'yxat emas).
    // Blok shapka ostidagi maydonда VERTIKAL MARKAZLANADI (pastda bo'sh joy
    // qolmasin — §4 ZICHLIK).
    const cardHeights = visual.points.map((p) => wrap(p, 46).length * 58 + 56);
    const stackH = cardHeights.reduce((a, h) => a + h + 26, 0) - 26;
    let y = Math.max(210, 150 + Math.round((H - 150 - stackH) / 2));
    visual.points.forEach((p, idx) => {
      const lines = wrap(p, 46);
      const cardH = cardHeights[idx];
      parts.push(`<rect x="70" y="${y}" width="${W - 140}" height="${cardH}" rx="24" fill="#FFFFFF"/>`);
      parts.push(`<rect x="70" y="${y}" width="10" height="${cardH}" rx="5" fill="${accent}"/>`);
      parts.push(`<circle cx="150" cy="${y + cardH / 2}" r="30" fill="${accent}" opacity="0.14"/>`);
      parts.push(txt(150, y + cardH / 2 + 14, 38, 700, accent, String(idx + 1), "middle"));
      lines.forEach((ln, i) => parts.push(txt(210, y + 62 + i * 58, 44, 500, INK, ln)));
      y += cardH + 26;
    });
  }
  return sharp(Buffer.from(svgDoc(parts.join("")))).jpeg({ quality: 86, mozjpeg: false }).toBuffer();
}

// ---------- TTS ----------
// Dvigatel `lib/tts.ts` ga ko'chirildi (video + podkast ikkalasi ishlatadi);
// tartibni `AI_TTS_PROVIDER` belgilaydi, ikkinchisi har doim fallback.

/** Synthesize one segment to `${name}.wav` (24 kHz mono). Returns duration in seconds. */
async function synthSegment(
  text: string,
  geminiVoice: string,
  edgeVoice: string,
  dir: string,
  name: string,
  usage: TtsUsage
): Promise<number> {
  return synthToWav(text, { gemini: geminiVoice, edge: edgeVoice }, dir, name, usage);
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

/**
 * ⚠️ `errorStage` FAQAT aniq berilganda yoziladi.
 *
 * Ilgari u har bosqichda `null` ga tushardi — ya'ni `recovery.ts` dagi
 * avtomatik urinishlar hisoblagichi (`interrupted (2)`, `(3)`) montaj
 * boshlanishi bilan O'CHIB ketardi. Natijada 2026-08-01 da jonli serverda
 * cheksiz sikl bo'ldi: RENDER → OOM → restart → "urinish 1/3" → RENDER → …
 * (MAX_AUTO_RESUME hech qachon ishlamasdi va API 502 bilan uchib turdi).
 */
async function setStatus(videoId: number, status: Prisma.VideoUpdateInput["buildStatus"], errorStage?: string | null) {
  await prisma.video.update({
    where: { id: videoId },
    data: { buildStatus: status, ...(errorStage !== undefined ? { errorStage } : {}) },
  });
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
  /** Barcha tayyor slayd rasmlari (tartibda) — kirish/xulosa kadrlari uchun.
   *  ⚠️ Buyurtmachi (2026-08-01): video BOSHI va OXIRI sof matn kadr edi va
   *  o'nlab soniya shunday turardi. Taqdimotning 1-slaydi aynan mavzu muqovasi,
   *  oxirgisi — xulosa: ularni BEPUL qayta ishlatamiz (yangi rasm yasalmaydi). */
  const readySlideImages = slides
    .filter((sl) => sl.imageSlots?.[0]?.status === "DONE" && sl.imageSlots[0].url)
    .map((sl) => sl.imageSlots[0].url as string);
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
    // Talabaga WAV emas, AAC (m4a) beriladi: 232 s uchun ~11 MB o'rniga ~3 MB,
    // kodlash esa arzon (faqat audio — bir necha soniya CPU).
    await run(FFMPEG, ["-y", "-i", "audio.wav", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "audio.m4a"], { cwd: dir });
    const audioRel = await saveBytes(`topics/${topicId}/video/${v.id}/audio.m4a`, await readFile(path.join(dir, "audio.m4a")));
    await prisma.video.update({ where: { id: videoId }, data: { scriptJson: segments as object, audioUrl: audioRel } });

    // --- VIZUAL TAYYORLASH (kadr chizish YO'Q) ---
    //
    // ⚠️ 2026-08-02 — ENG KATTA ARXITEKTURA O'ZGARISHI (buyurtmachi: "$7 tarif
    // yo'q, eng arzoni $25", "baribir ko'p vaqt oladi").
    //
    // Ilgari bu bosqichda har segment uchun 1280x720 kadr chizilib (sharp),
    // keyin x264 bilan mp4 yig'ilardi. Aynan shu ikki ish Render Free (0.1 CPU)
    // konteynerini o'ldirardi — o'lchandi: montaj mahalliy mashinada 183 s,
    // Render'da esa umuman tugamasdi (uch marta 502).
    //
    // Yechim: MP4 FAYL YASALMAYDI. Talaba ko'radigan narsa o'zgarmaydi —
    // brauzer ovozni ijro etadi va vaqt bo'yicha rasm/matnni almashtiradi
    // (`SlideshowPlayer`). Serverda faqat ovoz birlashtiriladi (~5 s CPU).
    // Haqiqiy mp4 kerak bo'lsa: VIDEO_MP4=1 (kuchliroq hostда).
    await setStatus(videoId, "RENDER");
    let imagesMade = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg.visual) continue;
      // Tayyor slayd rasmini QAYTA ISHLATAMIZ (bepul): bo'lim bo'yicha →
      // kirish/xulosa uchun muqova/yakun slaydi → qolganiga tartib bo'yicha.
      if (!seg.visualImageUrl && seg.sectionId) {
        const reuse = slideImageBySection.get(seg.sectionId);
        if (reuse) seg.visualImageUrl = reuse;
      }
      if (!seg.visualImageUrl && readySlideImages.length) {
        if (i === 0) seg.visualImageUrl = readySlideImages[0];
        else if (i === segments.length - 1) seg.visualImageUrl = readySlideImages[readySlideImages.length - 1];
      }
      if (!seg.visualImageUrl && orderedSlideImages.length) {
        seg.visualImageUrl = orderedSlideImages[reusePtr % orderedSlideImages.length];
        reusePtr++;
      }
      // Mos slayd rasmi umuman bo'lmasa — tushuntiruvchi kartaga yangi rasm.
      const wantsImage = seg.visual.kind === "points" || seg.visual.kind === "term";
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
          seg.visualImageUrl = null; // kvota/429 → brauzer matnli karta chizadi
        }
      }
    }

    const srtRel = await saveBytes(`topics/${topicId}/video/${v.id}/subtitles.srt`, Buffer.from(buildSrt(segments), "utf8"));
    const total = segments.reduce((a, s) => a + s.durationSec, 0);

    // Ixtiyoriy: haqiqiy mp4 (kuchli host uchun). Sukut bo'yicha O'CHIQ.
    let mp4Rel: string | null = null;
    if (process.env.VIDEO_MP4 === "1") {
      const listLines: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        let imgBuf: Buffer | null = null;
        if (seg.visualImageUrl) imgBuf = await readFileBuffer(seg.visualImageUrl).catch(() => null);
        const png = seg.visual
          ? await renderVisualPng(seg.visual, imgBuf)
          : await renderSlidePng(
              slides[seg.slideIndex ?? 0] ?? { id: "", layout: "BULLETS", title: "", bullets: [], speakerNotes: "", imageSlots: [] },
              imgBuf
            );
        await writeFile(path.join(dir, `slide${i}.jpg`), png);
        listLines.push(`file 'slide${i}.jpg'`, `duration ${seg.durationSec}`);
      }
      listLines.push(`file 'slide${segments.length - 1}.jpg'`);
      await writeFile(path.join(dir, "slides.txt"), listLines.join(NL), "utf8");
      await run(
        FFMPEG,
        [
          "-y", "-f", "concat", "-safe", "0", "-i", "slides.txt", "-i", "audio.wav",
          "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-threads", "1", "-crf", "26",
          "-pix_fmt", "yuv420p", "-r", "10", "-c:a", "aac", "-b:a", "160k", "-shortest", "video.mp4",
        ],
        { cwd: dir }
      );
      mp4Rel = await saveBytes(`topics/${topicId}/video/${v.id}/video.mp4`, await readFile(path.join(dir, "video.mp4")));
    }

    await prisma.video.update({
      where: { id: videoId },
      data: {
        scriptJson: segments as object,
        // ⚠️ mp4 yasalmagan bo'lsa ESKISI ham o'chiriladi: u eski skript/ovoz
        // bilan qurilgan bo'lardi va yangi narration bilan mos kelmasdi.
        mp4Url: mp4Rel,
        srtUrl: srtRel,
        durationSec: total,
        buildStatus: "DONE",
        errorStage: null,
      },
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
    // ⚠️ Xato MATNI ham saqlanadi: ilgari faqat bosqich ("RENDER") yozilardi va
    // jonli serverда sabab (ffmpeg yo'q? fayl topilmadi? xotira?) ko'rinmasdi —
    // Render dashboard'iga kirmasdan tashxis qo'yib bo'lmasdi.
    const raw = err instanceof Error ? `${err.message}` : String(err);
    const detail = raw.replace(/\s+/g, " ").trim().slice(0, 300);
    await setStatus(videoId, "ERROR", detail ? `${stage}: ${detail}` : stage);
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

export async function getVideoMedia(videoId: number, teacherId: number, kind: "mp4" | "srt" | "audio") {
  const v = await videoForTeacher(videoId, teacherId);
  const rel = kind === "mp4" ? v.mp4Url : kind === "audio" ? v.audioUrl : v.srtUrl;
  if (!rel) throw notFound("Fayl");
  // Yozuv bor, fayl yo'q (eski disk-drayver davridagi media) → 500 emas, 404.
  const buf = await readFileBuffer(rel).catch(() => null);
  if (!buf) throw notFound("Video");
  return buf;
}
