/**
 * Demo prezentatsiya — mobil UI'ni haqiqiy ma'lumot bilan tekshirish uchun.
 *
 * Nega kerak: demo bazasida birorta Presentation yo'q edi, shuning uchun
 * dars sahifasidagi "Slaydlar" bloki umuman ochilmasdi va uni telefonda
 * ko'rib bo'lmasdi. AI generatsiyasi (Gemini + Nano Banana Pro) pulli va
 * sekin — bu skript o'sha natijaning tuzilishini SXEMAGA MOS ravishda
 * qo'lda yasaydi: 3 slayd, biri sharpda chizilgan diagramma rasmi bilan.
 *
 * Ishga tushirish:  cd apps/api && npx tsx src/scripts/demoSlides.ts [topicId]
 */
import sharp from "sharp";
import { prisma } from "@meduni/db";
import { saveBytes } from "../lib/storage";
import type { Slide } from "../ai/types";

const TOPIC_ID = Number(process.argv[2] ?? 1);

/** Yorliqli sxematik diagramma (yurak kesimi soddalashtirilgani). */
async function drawDiagram(): Promise<Buffer> {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
  <rect width="1280" height="800" fill="#ffffff"/>
  <text x="640" y="64" font-family="Arial" font-size="38" font-weight="bold" fill="#101828" text-anchor="middle">Yurak bo'lmalari va qorinchalari</text>
  <ellipse cx="520" cy="330" rx="150" ry="115" fill="#E0F2FE" stroke="#0284C7" stroke-width="5"/>
  <text x="520" y="338" font-family="Arial" font-size="27" fill="#0284C7" text-anchor="middle">O'ng bo'lma</text>
  <ellipse cx="800" cy="330" rx="150" ry="115" fill="#FDE9EE" stroke="#E11D48" stroke-width="5"/>
  <text x="800" y="338" font-family="Arial" font-size="27" fill="#E11D48" text-anchor="middle">Chap bo'lma</text>
  <ellipse cx="520" cy="580" rx="165" ry="130" fill="#E0F2FE" stroke="#0284C7" stroke-width="5"/>
  <text x="520" y="590" font-family="Arial" font-size="27" fill="#0284C7" text-anchor="middle">O'ng qorincha</text>
  <ellipse cx="800" cy="580" rx="165" ry="130" fill="#FDE9EE" stroke="#E11D48" stroke-width="5"/>
  <text x="800" y="590" font-family="Arial" font-size="27" fill="#E11D48" text-anchor="middle">Chap qorincha</text>
  <line x1="520" y1="445" x2="520" y2="450" stroke="#101828" stroke-width="4"/>
  <line x1="800" y1="445" x2="800" y2="450" stroke="#101828" stroke-width="4"/>
  <text x="245" y="330" font-family="Arial" font-size="23" fill="#5B6474">1 — Trikuspidal klapan</text>
  <text x="245" y="580" font-family="Arial" font-size="23" fill="#5B6474">2 — O'pka arteriyasi</text>
  <text x="985" y="330" font-family="Arial" font-size="23" fill="#5B6474">3 — Mitral klapan</text>
  <text x="985" y="580" font-family="Arial" font-size="23" fill="#5B6474">4 — Aorta</text>
  <text x="640" y="756" font-family="Arial" font-size="21" fill="#98A1B2" text-anchor="middle">Ko'k — kislorodsiz qon · Qizil — kislorodli qon</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const topic = await prisma.topic.findUnique({
    where: { id: TOPIC_ID },
    include: { course: { select: { teacherId: true } } },
  });
  if (!topic) throw new Error(`Mavzu topilmadi: ${TOPIC_ID}`);
  const teacherId = topic.course?.teacherId ?? null;

  const item = await prisma.contentItem.upsert({
    where: { topicId_kind: { topicId: TOPIC_ID, kind: "PRESENTATION" } },
    create: {
      topicId: TOPIC_ID,
      kind: "PRESENTATION",
      language: "uz",
      status: "PUBLISHED",
      approvedById: teacherId,
      approvedAt: new Date(),
      factcheckStatus: "CLEAN",
      factcheckedAt: new Date(),
    },
    update: { status: "PUBLISHED", approvedById: teacherId, approvedAt: new Date() },
  });

  // Rasmni storage'ga yozamiz (STORAGE_DRIVER ni o'zi hal qiladi: disk yoki db).
  const png = await drawDiagram();
  const rel = `presentations/${item.id}/slide0_slot0.png`;
  await saveBytes(rel, png);

  const slides: Slide[] = [
    {
      id: "s_demo1",
      layout: "IMAGE_LEFT",
      title: "Yurak kameralari",
      bullets: [
        "Yurak to'rt kamerali: ikki bo'lma va ikki qorincha.",
        "O'ng yarim — kislorodsiz qon, chap yarim — kislorodli qon.",
        "Chap qorincha devori eng qalin: u qonni butun tanaga haydaydi.",
      ],
      speakerNotes: "Diagrammadagi rang-kodlashga e'tibor qarating.",
      imageSlots: [{ prompt: "yurak kesimi, yorliqlar bilan", url: rel, status: "DONE" }],
      sectionId: null,
    },
    {
      id: "s_demo2",
      layout: "BULLETS",
      title: "Klapanlar",
      bullets: [
        "Trikuspidal klapan — o'ng bo'lma va o'ng qorincha orasida.",
        "Mitral (ikki tavaqali) klapan — chap bo'lma va chap qorincha orasida.",
        "Yarimoysimon klapanlar — o'pka arteriyasi va aorta chiqishida.",
      ],
      speakerNotes: "Klapanlar qonning teskari oqishiga to'sqinlik qiladi.",
      imageSlots: [],
      sectionId: null,
    },
    {
      id: "s_demo3",
      layout: "TWO_BLOCK",
      title: "Qon aylanish doiralari",
      bullets: [
        "Kichik doira: o'ng qorincha → o'pka → chap bo'lma.",
        "Katta doira: chap qorincha → a'zolar → o'ng bo'lma.",
      ],
      speakerNotes: "Ikki doira ketma-ket, bir vaqtda ishlaydi.",
      imageSlots: [],
      sectionId: null,
    },
  ];

  await prisma.presentation.upsert({
    where: { contentItemId: item.id },
    create: { contentItemId: item.id, slidesJson: slides as never },
    update: { slidesJson: slides as never },
  });

  console.log(`✅ Demo prezentatsiya tayyor — mavzu ${TOPIC_ID}, contentItem ${item.id}`);
  console.log(`   ${slides.length} slayd, 1 tasi diagramma rasmi bilan (${rel})`);
  await prisma.$disconnect();
}

void main();
