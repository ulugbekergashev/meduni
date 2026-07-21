/**
 * Demo kontent — dars panelini "to'la" ko'rsatish uchun (prezentatsiya/pilot).
 * Mavzuga: tasdiqlangan AI konspekt + o'qituvchi manba materiallari qo'shadi.
 *
 * Ishga tushirish:
 *   npx tsx src/scripts/demoLesson.ts [topicId]
 *
 * ⚠️ Faqat DEMO ma'lumot. Kontent — standart o'quv fiziologiyasi; dori dozalari
 * ATAYLAB bo'sh (doza faqat haqiqiy manbadan kelishi kerak — CLAUDE.md §6).
 */
import { prisma } from "../lib/prisma";
import { saveMaterialFile, saveParsedText } from "../lib/storage";

const DIGEST = {
  objectives: [
    "Yurak avtomatizmi va uni ta'minlovchi tuzilmalarni tushuntirish",
    "Yurak o'tkazuvchi tizimining bo'limlarini va impuls tarqalish yo'lini izohlash",
    "Yurak siklining fazalarini (sistola, diastola) va ular davomiyligini ajratish",
    "Yurak chiqishi (minutlik hajm) qanday shakllanishini asoslash",
  ],
  concepts: [
    "Avtomatizm — yurakning tashqi qo'zg'atuvchisiz o'zidan impuls hosil qila olish xossasi",
    "Sinoatrial (SA) tugun — birlamchi vodiy ritm manbai, chastotasi ~60–100 imp/daq",
    "Atrioventrikulyar (AV) tugun — impulsni ushlab turadi (kechikish), bo'lmacha va qorincha ishini ketma-ket qiladi",
    "Giss tutami va Purkinye tolalari — impulsni qorinchalar miokardiga tez tarqatadi",
    "Yurak sikli — sistola (qisqarish) va diastola (bo'shashish) ketma-ketligi",
    "Frank–Starling qonuni — diastolada cho'zilish qancha ko'p bo'lsa, qisqarish kuchi shuncha katta",
  ],
  terms: [
    { ru: "Автоматизм", uz: "Avtomatizm", lat: "Automatia" },
    { ru: "Синоатриальный узел", uz: "Sinoatrial tugun", lat: "Nodus sinuatrialis" },
    { ru: "Атриовентрикулярный узел", uz: "Atrioventrikulyar tugun", lat: "Nodus atrioventricularis" },
    { ru: "Пучок Гиса", uz: "Giss tutami", lat: "Fasciculus atrioventricularis" },
    { ru: "Волокна Пуркинье", uz: "Purkinye tolalari", lat: "Rami subendocardiales" },
    { ru: "Систола", uz: "Sistola", lat: "Systole" },
    { ru: "Диастола", uz: "Diastola", lat: "Diastole" },
    { ru: "Ударный объём", uz: "Zarba hajmi", lat: "Volumen systolicum" },
  ],
  facts: [
    "SA tugun impuls chastotasi ~60–100 imp/daq — u yurak ritmini belgilaydi (vodiy ritm).",
    "AV tugunda impuls ~0,1 s ushlanadi — shu tufayli bo'lmachalar qorinchalardan oldin qisqaradi.",
    "Tinch holatda yurak sikli ~0,8 s: bo'lmacha sistolasi ~0,1 s, qorincha sistolasi ~0,3 s, umumiy pauza ~0,4 s.",
    "Zarba hajmi tinch holatda ~70 ml; yurak chiqishi = zarba hajmi × yurak urishi soni (~5 l/daq).",
    "Miokard 'hammasi yoki hech narsa' qonuniga bo'ysunadi va uzoq refrakter davrga ega — shuning uchun tetanik qisqarmaydi.",
  ],
  // Dozalar ATAYLAB bo'sh: doza faqat yuklangan manbadan olinadi (CLAUDE.md §6).
  dosages: [] as string[],
  imageIdeas: [] as string[],
};

const MATERIALS: { fileName: string; fileType: string; body: string }[] = [
  {
    fileName: "Yurak fiziologiyasi — ma'ruza konspekti.md",
    fileType: "md",
    body: `# Yurak fiziologiyasi — ma'ruza konspekti

## 1. Yurakning asosiy xossalari
- **Avtomatizm** — o'zidan impuls hosil qilish
- **Qo'zg'aluvchanlik** — qo'zg'atuvchiga javob berish
- **O'tkazuvchanlik** — impulsni tarqatish
- **Qisqaruvchanlik** — mexanik ish bajarish

## 2. O'tkazuvchi tizim
SA tugun -> bo'lmacha miokardi -> AV tugun (~0,1 s kechikish) ->
Giss tutami -> oyoqchalari -> Purkinye tolalari -> qorincha miokardi.

## 3. Yurak sikli (tinch holat, ~0,8 s)
| Faza | Davomiyligi |
|------|-------------|
| Bo'lmacha sistolasi | ~0,1 s |
| Qorincha sistolasi | ~0,3 s |
| Umumiy pauza | ~0,4 s |

## 4. Gemodinamika ko'rsatkichlari
- Zarba hajmi: ~70 ml
- Yurak chiqishi: ~5 l/daq
- Frank-Starling qonuni: cho'zilish ↑ -> qisqarish kuchi ↑
`,
  },
  {
    fileName: "O'tkazuvchi tizim — sxema izohi.txt",
    fileType: "txt",
    body: `YURAK O'TKAZUVCHI TIZIMI — SXEMA IZOHI

1) Sinoatrial (SA) tugun
   Joylashuvi: o'ng bo'lmacha, yuqori kovak vena quyilish joyida.
   Chastotasi: 60-100 imp/daq. Birlamchi vodiy ritm.

2) Atrioventrikulyar (AV) tugun
   Joylashuvi: bo'lmachalararo to'siqning pastki qismi.
   Vazifasi: impulsni ~0,1 s ushlab turish (fiziologik kechikish).
   O'z chastotasi: 40-60 imp/daq (ikkilamchi vodiy ritm).

3) Giss tutami va oyoqchalari
   Impulsni qorinchalararo to'siq bo'ylab tarqatadi.

4) Purkinye tolalari
   Chastotasi: 20-40 imp/daq (uchlamchi vodiy ritm).
   Qorincha miokardini deyarli bir vaqtda qo'zg'atadi.

ESLATMA: vodiy ritm markazi ishdan chiqsa, quyi markaz o'z chastotasida
ishga tushadi — shuning uchun yurak to'xtab qolmaydi.
`,
  },
];

async function main() {
  const topicId = Number(process.argv[2] ?? 29);
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { subject: { include: { department: true } } },
  });
  if (!topic) throw new Error(`Topic ${topicId} topilmadi`);

  // Yuklovchi sifatida shu kafedra o'qituvchisi (bo'lmasa — istalgan TEACHER).
  const teacher =
    (await prisma.user.findFirst({
      where: { role: "TEACHER", teacherProfile: { departmentId: topic.subject.departmentId } },
    })) ?? (await prisma.user.findFirst({ where: { role: "TEACHER" } }));
  if (!teacher) throw new Error("O'qituvchi topilmadi");

  // 1) Tasdiqlangan konspekt (o'rta panel).
  await prisma.topicDigest.upsert({
    where: { topicId },
    create: { topicId, digestJson: DIGEST, version: 1, approvedByTeacher: true },
    update: { digestJson: DIGEST, approvedByTeacher: true },
  });
  console.log(`✓ Konspekt tasdiqlandi (topic ${topicId}: ${topic.title})`);

  // 2) Manba materiallari (chap panel).
  for (const m of MATERIALS) {
    const exists = await prisma.sourceMaterial.findFirst({ where: { topicId, fileName: m.fileName } });
    if (exists) {
      console.log(`· mavjud: ${m.fileName}`);
      continue;
    }
    const row = await prisma.sourceMaterial.create({
      data: {
        topicId,
        fileUrl: "",
        fileName: m.fileName,
        fileType: m.fileType,
        parseStatus: "DONE",
        uploadedById: teacher.id,
      },
    });
    const buf = Buffer.from(m.body, "utf8");
    const fileUrl = await saveMaterialFile(topicId, row.id, m.fileName, buf);
    const parsedTextUrl = await saveParsedText(topicId, row.id, m.body);
    await prisma.sourceMaterial.update({ where: { id: row.id }, data: { fileUrl, parsedTextUrl } });
    console.log(`✓ Material: ${m.fileName}`);
  }

  console.log("\nTayyor. Dars sahifasini oching: /app/topics/" + topicId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
