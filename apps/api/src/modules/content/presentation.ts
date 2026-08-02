import { randomUUID } from "crypto";
import PptxGenJS from "pptxgenjs";
import PDFDocument from "pdfkit";
import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError, notFound } from "../../lib/errors";
import { readFileBuffer, saveBytes } from "../../lib/storage";
import { generateImage, generateStructured } from "../../ai/gemini";
import { assertQuota } from "../../ai/quota";
import { enqueueMediaJob } from "../../lib/jobQueue";
import { departmentForTopic } from "../../ai/glossary";
import { slidesGenSchema, slidesResponseSchema, type DigestJson, type Slide, type SlidesGen } from "../../ai/types";
import { slidesSystemPrompt, slidesUserContent } from "../../ai/prompts/slides";
import { imagePromptForSlide } from "../../ai/prompts/images";
import { assertCourseTeacher } from "../topics/service";

// ---------- Ownership (Faza 3: fan/kafedra darajasida) ----------

async function topicForTeacher(topicId: number, teacherId: number) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { digest: true } });
  if (!topic) throw notFound("Mavzu");
  await assertCourseTeacher(topic.courseId, teacherId);
  return topic;
}

const presInclude = {
  contentItem: { include: { topic: true } },
} satisfies Prisma.PresentationInclude;

type PresFull = Prisma.PresentationGetPayload<{ include: typeof presInclude }>;

async function presentationForTeacher(presentationId: number, teacherId: number): Promise<PresFull> {
  const pres = await prisma.presentation.findUnique({ where: { id: presentationId }, include: presInclude });
  if (!pres) throw notFound("Prezentatsiya");
  await assertCourseTeacher(pres.contentItem.topic.courseId, teacherId);
  return pres;
}

function slidesOf(pres: { slidesJson: unknown }): Slide[] {
  return pres.slidesJson as unknown as Slide[];
}

// ---------- Generate slide structure ----------

export async function generatePresentation(
  topicId: number,
  teacherId: number,
  opts: { language: "uz" | "ru" }
) {
  const topic = await topicForTeacher(topicId, teacherId);
  if (!topic.digest || !topic.digest.approvedByTeacher) {
    throw new ApiError(403, "digest_not_approved", "Avval konspektni tasdiqlang", "Сначала утвердите конспект");
  }
  const digest = topic.digest.digestJson as unknown as DigestJson;

  const departmentId = await departmentForTopic(topicId);
  await assertQuota(departmentId);

  const gen = await generateStructured<SlidesGen>({
    systemInstruction: slidesSystemPrompt(opts.language),
    userContent: slidesUserContent(digest),
    responseSchema: slidesResponseSchema,
    kind: "SLIDES",
    topicId,
    departmentId,
    userId: teacherId,
  });
  const parsed = slidesGenSchema.safeParse(gen);
  const raw = (parsed.success ? parsed.data : gen).slides;

  // Faza 0: AI qaytargan sectionIndex → digest boʻlimining barqaror ID'si (bogʻlanish
  // uchun). Diapazondan tashqari/id'siz boʻlim → null (graceful).
  const sections = digest.sections ?? [];
  const sectionIdAt = (i: number): string | null => (i >= 0 && i < sections.length ? sections[i].id || null : null);

  const slides: Slide[] = raw.map((s) => ({
    id: randomUUID(),
    layout: s.layout,
    title: s.title,
    bullets: s.bullets,
    speakerNotes: s.speakerNotes,
    // Taqdimot RASMLI (§16) — shuning uchun har slaydga slot ochiladi. AI
    // `imagePrompt` bermasa ham bo'sh prompt bilan ochamiz: `imagePromptForSlide`
    // uni sarlavha + tezislardan quradi (aks holda slayd matn-only qolardi).
    imageSlots: [{ prompt: s.imagePrompt?.trim() ?? "", url: null, status: "PENDING" as const }],
    sectionId: sectionIdAt(s.sectionIndex ?? -1),
  }));

  const existing = await prisma.contentItem.findUnique({ where: { topicId_kind: { topicId, kind: "PRESENTATION" } } });

  const content = await prisma.$transaction(async (tx) => {
    const item = existing
      ? await tx.contentItem.update({
          where: { id: existing.id },
          data: { language: opts.language, status: "DRAFT", editedByTeacher: false, version: { increment: 1 } },
        })
      : await tx.contentItem.create({ data: { topicId, kind: "PRESENTATION", language: opts.language, status: "DRAFT" } });

    await tx.presentation.upsert({
      where: { contentItemId: item.id },
      create: { contentItemId: item.id, slidesJson: slides as object },
      update: { slidesJson: slides as object, pptxUrl: null, pdfUrl: null },
    });
    return item;
  });

  // ⚠️ 2026-08-01 (buyurtmachi: "prezentatsiyani prosta rasmdan nanobanana orqali
  // qilib ber"): taqdimot endi RASMLI — slaydlar yaratilishi bilan rasm joblari
  // O'ZI boshlanadi (ilgari o'qituvchi alohida "Rasm yasash" bosishi kerak edi va
  // taqdimot matn-only bo'lib qolardi). Navbat ketma-ket (§12 OOM).
  const pres = await prisma.presentation.findUnique({ where: { contentItemId: content.id } });
  if (pres) {
    const targets = slides.flatMap((s, i) => s.imageSlots.map((_, slot) => ({ s: i, slot })));
    if (targets.length) {
      for (const t of targets) await updateSlot(pres.id, t.s, t.slot, { status: "PENDING" });
      enqueueMediaJob(`images:${pres.id}`, () => runImageJob(pres.id, topicId, teacherId, opts.language, targets));
    }
  }

  return content.id;
}

// ---------- Image generation (background) ----------

async function updateSlot(
  presentationId: number,
  slideIndex: number,
  slotIndex: number,
  patch: Partial<{ url: string | null; status: Slide["imageSlots"][number]["status"]; error: string | null }>
) {
  const pres = await prisma.presentation.findUnique({ where: { id: presentationId } });
  if (!pres) return;
  const slides = slidesOf(pres);
  const slot = slides[slideIndex]?.imageSlots[slotIndex];
  if (!slot) return;
  Object.assign(slot, patch);
  await prisma.presentation.update({ where: { id: presentationId }, data: { slidesJson: slides as object } });
}

/** Bitta slot uchun necha marta urinamiz (429 / vaqtinchalik uzilish uchun).
 *  `generateImage` o'zi ham provayder zanjirini sinaydi — bu esa VAQT bo'yicha
 *  ikkinchi imkoniyat (kvota tiklanishi, tarmoq). */
const SLOT_ATTEMPTS = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Slotlar orasidagi pauza. ⚠️ 2026-08-02 o'lchandi: 8 slaydlik taqdimotda
 *  rasm modeli ketma-ket chaqiruvda 429 beradi va slaydlarning YARMI ERROR
 *  bo'lib qolardi (topic 6: 8 dan 4 tasi). Fon-jobda bir necha soniya kutish
 *  hech kimga xalaqit bermaydi. */
const SLOT_GAP_MS = 3000;

async function runImageJob(presentationId: number, topicId: number, teacherId: number, lang: "uz" | "ru", targets: { s: number; slot: number }[]) {
  const departmentId = await departmentForTopic(topicId);
  let first = true;
  for (const { s, slot } of targets) {
    if (!first) await sleep(SLOT_GAP_MS);
    first = false;
    await updateSlot(presentationId, s, slot, { status: "PROCESSING", error: null });
    let lastErr: unknown;
    let done = false;
    for (let attempt = 1; attempt <= SLOT_ATTEMPTS && !done; attempt++) {
      try {
        const pres = await prisma.presentation.findUnique({ where: { id: presentationId } });
        if (!pres) return;
        const slide = slidesOf(pres)[s];
        const slotObj = slide?.imageSlots[slot];
        if (!slotObj) break;
        const prompt = imagePromptForSlide(slide, slotObj.prompt, lang);
        const img = await generateImage(prompt, { kind: "IMAGE", topicId, departmentId, userId: teacherId });
        const rel = await saveBytes(`topics/${topicId}/presentation/${presentationId}/s${s}_slot${slot}.png`, img.buffer);
        await updateSlot(presentationId, s, slot, { url: rel, status: "DONE", error: null });
        done = true;
      } catch (err) {
        lastErr = err;
        if (attempt < SLOT_ATTEMPTS) await sleep(4000 * attempt);
      }
    }
    if (!done) {
      // ⚠️ SABABI saqlanadi (§17 saboqi: "xato sababi ko'rinmasdi" — o'qituvchi
      // nega slayd matn-only qolganini bilmasdi va faqat qayta bosaverardi).
      const msg = String((lastErr as Error)?.message ?? lastErr ?? "").slice(0, 200);
      await updateSlot(presentationId, s, slot, { status: "ERROR", error: msg || null });
    }
  }
}

export async function generateAllImages(presentationId: number, teacherId: number, slideIds?: string[]) {
  const pres = await presentationForTeacher(presentationId, teacherId);
  const topicId = pres.contentItem.topicId;
  const lang = pres.contentItem.language;
  const slides = slidesOf(pres);
  // 3A (xarajat): o'qituvchi tanlagan slaydlarga (slideIds) — bo'sh bo'lsa hammasi
  // (eski xatti-harakat). Matnli slaydga atlas-rasm generatsiya qilinmaydi.
  const pick = slideIds && slideIds.length ? new Set(slideIds) : null;
  const targets: { s: number; slot: number }[] = [];
  // ⚠️ 2026-08-02: RASM SLOTI YO'Q slaydga ham rasm yasaladi. Ilgari faqat
  // mavjud slotlar aylanib chiqilardi — AI `imagePrompt` bermagan slayd (eski
  // taqdimotlarda ko'p) abadiy MATN-ONLY qolardi va "Rasm yasash" tugmasi
  // unga umuman tegmasdi. Prompt bo'sh bo'lsa `imagePromptForSlide` uni
  // sarlavha + tezislardan quradi.
  let slotsAdded = false;
  slides.forEach((slide) => {
    if (pick && !pick.has(slide.id)) return;
    if (!slide.imageSlots?.length) {
      slide.imageSlots = [{ prompt: "", url: null, status: "PENDING" }];
      slotsAdded = true;
    }
  });
  if (slotsAdded) await prisma.presentation.update({ where: { id: presentationId }, data: { slidesJson: slides as object } });

  slides.forEach((slide, s) => {
    if (pick && !pick.has(slide.id)) return;
    slide.imageSlots.forEach((slot, i) => {
      if (slot.status !== "DONE") targets.push({ s, slot: i });
    });
  });
  await assertQuota(await departmentForTopic(topicId));
  // Mark queued as pending immediately so the UI shows progress.
  for (const t of targets) await updateSlot(presentationId, t.s, t.slot, { status: "PENDING" });
  enqueueMediaJob(`images:${presentationId}`, () => runImageJob(presentationId, topicId, teacherId, lang, targets));
}

export async function regenerateOneImage(
  presentationId: number,
  teacherId: number,
  slideIndex: number,
  slotIndex: number
) {
  const pres = await presentationForTeacher(presentationId, teacherId);
  const topicId = pres.contentItem.topicId;
  const lang = pres.contentItem.language;
  await updateSlot(presentationId, slideIndex, slotIndex, { status: "PENDING", url: null });
  enqueueMediaJob(`image:${presentationId}:${slideIndex}`, () => runImageJob(presentationId, topicId, teacherId, lang, [{ s: slideIndex, slot: slotIndex }]));
}

// ---------- Media ----------

export async function getSlotImage(presentationId: number, teacherId: number, slideIndex: number, slotIndex: number) {
  const pres = await presentationForTeacher(presentationId, teacherId);
  const slot = slidesOf(pres)[slideIndex]?.imageSlots[slotIndex];
  if (!slot?.url) throw notFound("Rasm");
  const buf = await readFileBuffer(slot.url).catch(() => null);
  if (!buf) throw notFound("Rasm");
  return buf;
}

// ---------- Exports (branded default template) ----------

const BRAND = "4F46E5";
const INK = "101828";

async function slotImageDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const buf = await readFileBuffer(url);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function exportPptx(presentationId: number, teacherId: number): Promise<Buffer> {
  const pres = await presentationForTeacher(presentationId, teacherId);
  const slides = slidesOf(pres);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "MEDUNI", width: 13.333, height: 7.5 });
  pptx.layout = "MEDUNI";

  for (const slide of slides) {
    const s = pptx.addSlide();
    s.background = { color: "F7F8FA" };
    const img = await slotImageDataUri(slide.imageSlots[0]?.url ?? null);

    // Rasm bor bo'lsa — RASM slaydning o'zi: to'liq kadr + tepada sarlavha lentasi,
    // tezislar ma'ruzachi izohiga tushadi (2026-08-01 buyurtmachi qarori).
    if (img) {
      s.addImage({ data: img, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: "contain", w: 13.333, h: 7.5 } });
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 1.0, fill: { color: BRAND, transparency: 8 } });
      s.addText(slide.title, { x: 0.6, y: 0.12, w: 12.1, h: 0.76, fontSize: 24, bold: true, color: "FFFFFF" });
      const notes = [slide.speakerNotes, ...(slide.bullets ?? [])].filter(Boolean).join("\n");
      if (notes) s.addNotes(notes);
      continue;
    }

    if (slide.layout === "TITLE") {
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 2.8, w: 13.333, h: 0.12, fill: { color: BRAND } });
      s.addText(slide.title, { x: 0.8, y: 1.8, w: 11.7, h: 1, fontSize: 40, bold: true, color: INK });
    } else {
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 1.1, fill: { color: BRAND } });
      s.addText(slide.title, { x: 0.6, y: 0.15, w: 12, h: 0.8, fontSize: 26, bold: true, color: "FFFFFF" });
      const textW = img ? 7 : 12;
      s.addText(
        slide.bullets.map((b) => ({ text: b, options: { bullet: true } })),
        { x: 0.6, y: 1.4, w: textW, h: 5.6, fontSize: 16, color: INK, valign: "top", lineSpacingMultiple: 1.3 }
      );
      if (img) s.addImage({ data: img, x: 7.9, y: 1.4, w: 5, h: 5, sizing: { type: "contain", w: 5, h: 5 } });
    }
    if (slide.speakerNotes) s.addNotes(slide.speakerNotes);
  }

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}

export async function exportPdf(presentationId: number, teacherId: number): Promise<Buffer> {
  const pres = await presentationForTeacher(presentationId, teacherId);
  return buildPdf(slidesOf(pres));
}

/** Pure PDF builder (branded template) — shared by teacher export and student download. */
export function buildPdf(slides: Slide[]): Promise<Buffer> {
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [960, 540], margin: 0 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      let first = true;
      for (const slide of slides) {
        if (!first) doc.addPage({ size: [960, 540], margin: 0 });
        first = false;
        doc.rect(0, 0, 960, 540).fill("#F7F8FA");
        const buf = slide.imageSlots[0]?.url ? await readFileBuffer(slide.imageSlots[0].url).catch(() => null) : null;

        // Rasm bor — u SLAYDNING O'ZI (to'liq kadr), sarlavha tepada lenta bo'lib turadi.
        if (buf) {
          let placed = false;
          try {
            doc.image(buf, 0, 0, { fit: [960, 540], align: "center", valign: "center" });
            placed = true;
          } catch {
            /* skip unrenderable image */
          }
          if (placed) {
            doc.rect(0, 0, 960, 62).fillOpacity(0.92).fill(`#${BRAND}`).fillOpacity(1);
            doc.fillColor("#FFFFFF").fontSize(22).text(slide.title, 36, 20, { width: 888 });
            continue;
          }
        }

        doc.rect(0, 0, 960, 70).fill(`#${BRAND}`);
        doc.fillColor("#FFFFFF").fontSize(24).text(slide.title, 40, 22, { width: 880 });
        doc.fillColor(`#${INK}`).fontSize(15);
        let y = 100;
        for (const b of slide.bullets) {
          doc.text(`•  ${b}`, 40, y, { width: 880 });
          y = doc.y + 8;
        }
      }
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
