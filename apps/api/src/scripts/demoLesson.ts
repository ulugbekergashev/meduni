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

/** v2 — bo'limli konspekt ("Mavzu ekrani" 1a). Har bo'limda vaqt + manba bet. */
const SECTIONS = [
  {
    title: "Kirish — yurakning asosiy xossalari",
    minutes: 3,
    sourceRef: "Ma'ruza, 1–3-betlar",
    blocks: [
      {
        type: "para",
        text: "Yurak to'rtta asosiy fiziologik xossaga ega: avtomatizm, qo'zg'aluvchanlik, o'tkazuvchanlik va qisqaruvchanlik. Shu xossalar birgalikda yurakning uzluksiz nasos vazifasini ta'minlaydi.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          { lead: "Avtomatizm", text: "tashqi qo'zg'atuvchisiz o'zidan impuls hosil qilish." },
          { lead: "Qo'zg'aluvchanlik", text: "qo'zg'atuvchiga javob berish qobiliyati." },
          { lead: "O'tkazuvchanlik", text: "impulsni miokard bo'ylab tarqatish." },
          { lead: "Qisqaruvchanlik", text: "mexanik ish bajarish — qonni haydash." },
        ],
      },
      {
        type: "callout",
        tone: "important",
        text: "Miokard 'hammasi yoki hech narsa' qonuniga bo'ysunadi va uzoq refrakter davrga ega — shuning uchun skelet mushagidan farqli o'laroq tetanik qisqarmaydi.",
      },
    ],
  },
  {
    title: "Yurak sikli",
    minutes: 4,
    sourceRef: "Ma'ruza, 6–9-betlar",
    blocks: [
      {
        type: "para",
        text: "Yurak sikli — bitta yurak urishi davomida sodir bo'ladigan elektrik va mexanik hodisalar ketma-ketligi. U ikki asosiy fazadan iborat: sistola (qisqarish) va diastola (bo'shashish).",
      },
      {
        type: "callout",
        tone: "important",
        text: "Normal sharoitda sikl davomiyligi ~0,8 s: bo'lmacha sistolasi ~0,1 s, qorincha sistolasi ~0,3 s, umumiy pauza ~0,4 s. Taxikardiyada asosan diastola qisqaradi.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          { lead: "Atriyal sistola", text: "bo'lmachalar qisqarib, qorinchalarni to'ldiradi." },
          { lead: "Izovolumetrik qisqarish", text: "barcha klapanlar yopiq, bosim keskin ortadi." },
          { lead: "Ejeksiya", text: "qon aorta va o'pka arteriyasiga otiladi." },
          { lead: "Izovolumetrik bo'shashish", text: "klapanlar yopiq, bosim tushadi." },
        ],
      },
    ],
  },
  {
    title: "O'tkazuvchi tizim",
    minutes: 4,
    sourceRef: "Ma'ruza, 10–14-betlar",
    blocks: [
      {
        type: "para",
        text: "Impuls sinoatrial tugunda hosil bo'lib, bo'lmachalar miokardi orqali atrioventrikulyar tugunga yetadi, so'ng Giss tutami va Purkinye tolalari orqali qorinchalarga tarqaladi.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          { lead: "SA tugun", text: "o'ng bo'lmachada, 60–100 imp/daq — birlamchi vodiy ritm." },
          { lead: "AV tugun", text: "impulsni ~0,1 s ushlaydi; o'z chastotasi 40–60 imp/daq." },
          { lead: "Giss tutami", text: "impulsni qorinchalararo to'siq bo'ylab o'tkazadi." },
          { lead: "Purkinye tolalari", text: "20–40 imp/daq; qorinchalarni deyarli bir vaqtda qo'zg'atadi." },
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text: "Yuqori vodiy ritm markazi ishdan chiqsa, quyi markaz o'z chastotasida ishga tushadi — shuning uchun yurak butunlay to'xtab qolmaydi.",
      },
    ],
  },
  {
    title: "Gemodinamika ko'rsatkichlari",
    minutes: 3,
    sourceRef: "Ma'ruza, 15–18-betlar",
    blocks: [
      {
        type: "para",
        text: "Yurakning nasos funksiyasi zarba hajmi va yurak chiqishi bilan baholanadi. Bu ko'rsatkichlar organizm ehtiyojiga qarab keng diapazonda o'zgaradi.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          { lead: "Zarba hajmi", text: "tinch holatda ~70 ml." },
          { lead: "Yurak chiqishi", text: "zarba hajmi × yurak urishi soni ≈ 5 l/daq." },
          { lead: "Ejeksiya fraksiyasi", text: "normada 55–70%." },
        ],
      },
      {
        type: "callout",
        tone: "important",
        text: "Frank–Starling qonuni: diastolada miokard tolalari qancha ko'p cho'zilsa, keyingi qisqarish kuchi shuncha katta bo'ladi.",
      },
    ],
  },
  {
    title: "Xulosa",
    minutes: 2,
    sourceRef: "Ma'ruza, 19-bet",
    blocks: [
      {
        type: "para",
        text: "Yurak avtomatizmi SA tugun bilan boshlanadi, o'tkazuvchi tizim orqali tarqaladi va yurak siklining aniq fazalarida mexanik ishga aylanadi. Gemodinamika ko'rsatkichlari shu jarayonning samaradorligini aks ettiradi.",
      },
    ],
  },
];

const DIGEST = {
  sections: SECTIONS,
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

/**
 * v2 klinik keys — bosqichma-bosqich qaror qabul qilish (4 qadam) + yozma savollar.
 * Bemor vitals'i konspektdagi normal diapazonlardan kelib chiqadi; doza YO'Q.
 */
const CASE_JSON = {
  patientName: "Bemor R.A.",
  patientInfo: "62 yosh, erkak",
  vitals: { bp: "110/70 mm sim. ust.", pulse: "38 urish/daq", spo2: "96%", temp: "36,6 °C" },
  complaints:
    "Umumiy holsizlik, bosh aylanishi, zinapoyaga ko'tarilganda hansirash. So'nggi hafta ichida ikki marta ko'z oldi qorayib, bir necha soniya hushidan ketgan.",
  anamnesis:
    "Shikoyatlar taxminan bir oy oldin boshlangan va asta-sekin kuchaygan. Ilgari yurak kasalliklari bo'yicha kuzatilmagan, muntazam dori qabul qilmaydi.",
  objectiveStatus:
    "Holati qoniqarli. Teri oqargan. Puls ritmik, lekin sekin — 38 urish/daq. Yurak chegaralari kengaymagan. O'pkada vezikulyar nafas.",
  labData:
    "EKG: bo'lmacha va qorincha qisqarishlari bir-biridan mustaqil; qorincha chastotasi 38/daq, bo'lmacha chastotasi 78/daq. Umumiy qon tahlili — o'zgarishsiz.",
  steps: [
    {
      title: "Anamnez",
      prompt: "Bemorning hushidan ketishi qaysi mexanizmga eng ko'p mos keladi?",
      options: [
        {
          text: "Yurak chiqishi kamayib, miya qon bilan yetarli ta'minlanmagan",
          correct: true,
          feedback:
            "To'g'ri. Yurak chiqishi = zarba hajmi × yurak urishi soni. Chastota keskin kamayganda minutlik hajm tushadi va miya perfuziyasi buziladi.",
        },
        {
          text: "O'pka ventilyatsiyasi buzilgan (gipoksiya)",
          correct: false,
          feedback: "Noto'g'ri: SpO₂ normal va o'pkada vezikulyar nafas — nafas tizimi buzilishiga dalil yo'q.",
        },
        {
          text: "Anemiya tufayli kislorod tashish kamaygan",
          correct: false,
          feedback: "Noto'g'ri: umumiy qon tahlili o'zgarishsiz.",
        },
      ],
    },
    {
      title: "Tekshiruv",
      prompt: "Ritm manbaini aniqlash uchun qaysi tekshiruv birinchi navbatda ma'lumot beradi?",
      options: [
        {
          text: "EKG — bo'lmacha va qorincha qisqarishlari nisbatini baholash",
          correct: true,
          feedback:
            "To'g'ri. Impuls SA tugundan Giss tutamigacha bo'lgan yo'lni bosib o'tadi; EKG shu yo'lning qayerida uzilish borligini ko'rsatadi.",
        },
        {
          text: "Qorin bo'shlig'i UTT",
          correct: false,
          feedback: "Noto'g'ri: yurak o'tkazuvchi tizimi haqida ma'lumot bermaydi.",
        },
        {
          text: "Spirometriya",
          correct: false,
          feedback: "Noto'g'ri: bu tashqi nafas funksiyasini baholaydi, ritmni emas.",
        },
      ],
    },
    {
      title: "Talqin",
      prompt:
        "EKG'da bo'lmacha 78/daq, qorincha 38/daq va ular bir-biridan mustaqil qisqaryapti. Qorincha ritmini kim boshqarmoqda?",
      options: [
        {
          text: "AV tugundan pastdagi markaz (Giss–Purkinye), chunki yuqoridan impuls o'tmayapti",
          correct: true,
          feedback:
            "To'g'ri. Yuqori vodiy ritm markazi bilan bog'lanish uzilganda quyi markaz o'z chastotasida (20–40 imp/daq) ishga tushadi — shuning uchun yurak butunlay to'xtamaydi.",
        },
        {
          text: "SA tugun — u sekinlashib qolgan",
          correct: false,
          feedback:
            "Noto'g'ri: SA tugun bo'lmachalarni 78/daq bilan boshqaryapti; muammo impulsning qorinchalarga yetib bormasligida.",
        },
        {
          text: "Bo'lmacha miokardi qorinchalarni to'g'ridan-to'g'ri qo'zg'atmoqda",
          correct: false,
          feedback:
            "Noto'g'ri: normal sharoitda bo'lmacha va qorincha faqat o'tkazuvchi tizim orqali bog'lanadi.",
        },
      ],
    },
    {
      title: "Taktika",
      prompt: "Fiziologik nuqtai nazardan davolash maqsadi nima bo'lishi kerak?",
      options: [
        {
          text: "Qorincha chastotasini yetarli darajaga ko'tarib, yurak chiqishini tiklash",
          correct: true,
          feedback:
            "To'g'ri. Zarba hajmi cheklangan sharoitda minutlik hajmni tiklashning asosiy yo'li — chastotani oshirish.",
        },
        {
          text: "Zarba hajmini oshirish uchun ritmni yanada sekinlashtirish",
          correct: false,
          feedback:
            "Noto'g'ri: Frank–Starling mexanizmi zarba hajmini biroz oshirsa-da, bu chastota tushishini qoplay olmaydi.",
        },
        {
          text: "Faqat kuzatuv — aralashuv shart emas",
          correct: false,
          feedback: "Noto'g'ri: takroriy hushdan ketish miya perfuziyasi yetishmasligining xavfli belgisi.",
        },
      ],
    },
  ],
  questions: [
    "Yurak chiqishi qanday shakllanadi va bu bemorda nima uchun kamaygan? Formulaga tayanib tushuntiring.",
    "Nima uchun yuqori vodiy ritm markazi ishlamay qolganda ham yurak butunlay to'xtamaydi?",
  ],
  referenceAnswer: [
    "Yurak chiqishi = zarba hajmi × yurak urishi soni (tinch holatda ~70 ml × 60–80 ≈ 5 l/daq). Bemorda chastota 38/daq gacha tushgan, zarba hajmi esa Frank–Starling mexanizmi hisobiga faqat cheklangan darajada oshadi — natijada minutlik hajm normadan past bo'lib, miya perfuziyasi buziladi (bosh aylanishi, hushdan ketish).",
    "O'tkazuvchi tizimning har bir bo'limi o'z avtomatizmiga ega: SA tugun 60–100, AV tugun 40–60, Purkinye tolalari 20–40 imp/daq. Yuqori markaz impulsi yetib bormasa, quyi markaz o'z chastotasida vodiy ritm rolini oladi — shuning uchun qorinchalar 38/daq bilan qisqarishda davom etmoqda.",
  ],
};

async function main() {
  const topicId = Number(process.argv[2] ?? 29);
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { course: true },
  });
  if (!topic) throw new Error(`Topic ${topicId} topilmadi`);

  // Yuklovchi sifatida shu kafedra o'qituvchisi (bo'lmasa — istalgan TEACHER).
  const teacher =
    (await prisma.user.findFirst({
      where: { role: "TEACHER", teacherProfile: { departmentId: topic.course.departmentId } },
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
      // Eski yozuvlarda metama'lumot yo'q — to'ldiramiz.
      if (exists.sizeBytes === null) {
        await prisma.sourceMaterial.update({
          where: { id: exists.id },
          data: { sizeBytes: Buffer.byteLength(m.body, "utf8") },
        });
        console.log(`· yangilandi (hajm): ${m.fileName}`);
      } else {
        console.log(`· mavjud: ${m.fileName}`);
      }
      continue;
    }
    const buf = Buffer.from(m.body, "utf8");
    const row = await prisma.sourceMaterial.create({
      data: {
        topicId,
        fileUrl: "",
        fileName: m.fileName,
        fileType: m.fileType,
        sizeBytes: buf.length,
        parseStatus: "DONE",
        uploadedById: teacher.id,
      },
    });
    const fileUrl = await saveMaterialFile(topicId, row.id, m.fileName, buf);
    const parsedTextUrl = await saveParsedText(topicId, row.id, m.body);
    await prisma.sourceMaterial.update({ where: { id: row.id }, data: { fileUrl, parsedTextUrl } });
    console.log(`✓ Material: ${m.fileName}`);
  }

  // 3) Tashqi manbalar (chap panel, "Tashqi havola").
  const LINKS = [
    {
      title: "Guyton & Hall — Textbook of Medical Physiology",
      url: "https://www.sciencedirect.com/book/9780323597128/guyton-and-hall-textbook-of-medical-physiology",
      note: "9-bo'lim: Yurak mushagi va qon aylanishi",
    },
    {
      title: "AMBOSS — Cardiac physiology",
      url: "https://www.amboss.com/us/knowledge/cardiac-physiology",
      note: "Klinik ma'lumotnoma",
    },
  ];
  for (const [i, l] of LINKS.entries()) {
    const exists = await prisma.topicLink.findFirst({ where: { topicId, url: l.url } });
    if (exists) {
      console.log(`· mavjud havola: ${l.title}`);
      continue;
    }
    await prisma.topicLink.create({ data: { topicId, ...l, orderIndex: i } });
    console.log(`✓ Havola: ${l.title}`);
  }

  // 4) Klinik keys (v2 — 4 qadamli qaror + yozma savollar), chop etilgan.
  const caseItem = await prisma.contentItem.upsert({
    where: { topicId_kind: { topicId, kind: "CASE" } },
    create: {
      topicId,
      kind: "CASE",
      language: "uz",
      status: "PUBLISHED",
      approvedById: teacher.id,
      approvedAt: new Date(),
      factcheckStatus: "CLEAN",
      factcheckedAt: new Date(),
    },
    update: { status: "PUBLISHED", approvedById: teacher.id, approvedAt: new Date() },
  });
  await prisma.clinicalCase.upsert({
    where: { contentItemId: caseItem.id },
    create: { contentItemId: caseItem.id, caseJson: CASE_JSON, format: "EXTENDED" },
    update: { caseJson: CASE_JSON, format: "EXTENDED" },
  });
  console.log(`✓ Klinik keys (v2, ${CASE_JSON.steps.length} qadam + ${CASE_JSON.questions.length} yozma savol)`);

  console.log("\nTayyor. Dars sahifasini oching: /app/topics/" + topicId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
