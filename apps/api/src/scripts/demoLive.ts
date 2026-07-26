/**
 * JONLI DEMO — pilot/taqdimot uchun to'liq, izchil ma'lumot.
 *
 *   npx tsx src/scripts/demoLive.ts
 *
 * Idempotent: qayta ishga tushirsa dublikat yaratmaydi (mavjudini yangilaydi).
 *
 * Nima quradi:
 *   · 301-guruhda 10 talaba (har biri O'Z profili bilan: davomat, test balli,
 *     keys holati) — heatmap/reyting/guruh profili ma'noli ko'rinishi uchun
 *   · Yurak anatomiyasi va Buyrak fiziologiyasi mavzulariga tasdiqlangan
 *     bo'limli konspekt (checkpoint savollari + atamalar) + manba materiallari
 *     + tashqi havolalar → dars sahifasining uchala paneli to'ladi
 *   · Nefrologiyaga chop etilgan test (kurs bo'sh ko'rinmasin)
 *   · Haftalik jadval (slot) + sikl davri → "Darslarim", kalendar, talaba jadvali
 *   · O'tgan darslar bo'yicha yo'qlama tarixi (har talabaga o'z foizi)
 *   · Test urinishlari (xatolari bilan → "Guruh xatolari xaritasi" jonlanadi)
 *   · Keys javoblari: 3 tasi TEKSHIRUVDA (o'qituvchi demo paytida baholaydi),
 *     2 tasi baholangan (talaba bahoni va izohni ko'radi)
 *   · Bugunga tayyor fleshkarta takrorlari + ochiq topshiriqlar
 *
 * ⚠️ Faqat DEMO ma'lumot. Tibbiy kontent — standart o'quv darsligi darajasida;
 * dori dozalari ATAYLAB yo'q (doza faqat haqiqiy manbadan olinadi — CLAUDE.md §6).
 */
import argon2 from "argon2";
import { prisma } from "../lib/prisma";
import { saveMaterialFile, saveParsedText } from "../lib/storage";
import { syncTopicProgress } from "../modules/me/service";

// ---------------------------------------------------------------- yordamchilar

const log = (s: string) => console.log(s);

/** Mahalliy kun kaliti (UTC surilishisiz — loyihaning boshqa joylari kabi). */
function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Berilgan hafta kunidagi (0=Dushanba) sanani soat bilan qaytaradi. */
function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}
function mondayOf(d: Date): Date {
  const x = dayStart(d);
  const idx = (x.getDay() + 6) % 7; // 0=Dushanba
  return addDays(x, -idx);
}

const TODAY = dayStart(new Date());

// ------------------------------------------------------------------ talabalar

/** Har talabaning "xarakteri" — barcha ko'rsatkichlar shundan hosil bo'ladi. */
interface StudentPlan {
  fullName: string;
  email: string;
  attendance: number; // 0..1 — darsga kelish ulushi
  quiz1: number | null; // Yurak anatomiyasi testi bali (null = ishlamagan)
  quiz2: number | null; // Yurak fiziologiyasi testi
  caseState: "reviewed" | "pending" | null;
  flashcardsDue?: boolean;
}

const STUDENTS: StudentPlan[] = [
  // Mavjud demo talabasi (email o'zgarmaydi — login shu bilan ko'rsatiladi).
  { fullName: "Talaba Demo", email: "student@meduni.uz", attendance: 0.9, quiz1: 67, quiz2: 80, caseState: "reviewed", flashcardsDue: true },
  { fullName: "Aziza Rahimova", email: "aziza.rahimova@meduni.uz", attendance: 1.0, quiz1: 100, quiz2: 100, caseState: "reviewed", flashcardsDue: true },
  { fullName: "Bekzod Tursunov", email: "bekzod.tursunov@meduni.uz", attendance: 0.92, quiz1: 100, quiz2: 80, caseState: "pending" },
  { fullName: "Dilnoza Yusupova", email: "dilnoza.yusupova@meduni.uz", attendance: 0.85, quiz1: 67, quiz2: 60, caseState: "pending" },
  { fullName: "Eldor Qodirov", email: "eldor.qodirov@meduni.uz", attendance: 0.77, quiz1: 67, quiz2: 40, caseState: "pending", flashcardsDue: true },
  { fullName: "Feruza Ismoilova", email: "feruza.ismoilova@meduni.uz", attendance: 0.95, quiz1: 100, quiz2: 80, caseState: null },
  { fullName: "G'ayrat Sobirov", email: "gayrat.sobirov@meduni.uz", attendance: 0.62, quiz1: 33, quiz2: null, caseState: null },
  { fullName: "Hilola Nazarova", email: "hilola.nazarova@meduni.uz", attendance: 1.0, quiz1: 100, quiz2: 100, caseState: null },
  { fullName: "Islom Abdullayev", email: "islom.abdullayev@meduni.uz", attendance: 0.46, quiz1: null, quiz2: null, caseState: null },
  { fullName: "Jasmina Karimova", email: "jasmina.karimova@meduni.uz", attendance: 0.88, quiz1: 67, quiz2: 60, caseState: null },
];

// ----------------------------------------------------- konspekt: Yurak anatomiyasi

const ANATOMY_DIGEST = {
  sections: [
    {
      title: "Yurakning joylashuvi va tashqi tuzilishi",
      minutes: 4,
      sourceRef: "Ma'ruza, 1–4-betlar",
      blocks: [
        {
          type: "para",
          text: "Yurak ko'krak qafasining o'rta ko'ks bo'shlig'ida, ikki o'pka orasida joylashgan. Uning uchdan ikki qismi o'rta chiziqdan chapda turadi. Yurak asosi yuqoriga va o'ngga, cho'qqisi esa pastga, chapga va oldinga qaragan.",
        },
        {
          type: "list",
          ordered: false,
          items: [
            { lead: "Asos (basis cordis)", text: "yuqori qism — yirik tomirlar shu yerdan chiqadi." },
            { lead: "Cho'qqi (apex cordis)", text: "chapda, V qovurg'alararo oraliqda paypaslanadi." },
            { lead: "Massasi", text: "kattalarda ~250–350 g, tana vazniga bog'liq." },
          ],
        },
        {
          type: "callout",
          tone: "important",
          text: "Yurak perikard (yurak xaltasi) ichida yotadi. Uning ikki varag'i orasidagi suyuqlik qisqarish paytida ishqalanishni kamaytiradi.",
        },
      ],
      checkpoint: {
        question: "Yurak cho'qqisi (apex cordis) qayerga yo'nalgan?",
        options: ["Yuqoriga va o'ngga", "Pastga, chapga va oldinga", "Orqaga va yuqoriga", "To'g'ri pastga"],
        correctIndex: 1,
        explanation: "Yurak asosi yuqoriga va o'ngga, cho'qqisi esa pastga, chapga va oldinga qaragan — shuning uchun cho'qqi turtkisi chapda, V qovurg'alararo oraliqda paypaslanadi.",
      },
    },
    {
      title: "Yurak kameralari",
      minutes: 5,
      sourceRef: "Ma'ruza, 5–9-betlar",
      blocks: [
        {
          type: "para",
          text: "Yurak to'rt kamerali: ikki bo'lmacha (atrium) va ikki qorincha (ventriculus). O'ng va chap yarim to'siqlar bilan to'liq ajratilgan — sog'lom kattalarda ular orasida bevosita aloqa yo'q.",
        },
        {
          type: "list",
          ordered: true,
          items: [
            { lead: "O'ng bo'lmacha", text: "yuqori va pastki kovak venalardan kislorodsiz qonni qabul qiladi." },
            { lead: "O'ng qorincha", text: "qonni o'pka arteriyasi orqali kichik qon aylanish doirasiga haydaydi." },
            { lead: "Chap bo'lmacha", text: "to'rtta o'pka venasidan kislorodli qonni oladi." },
            { lead: "Chap qorincha", text: "eng qalin devorli kamera — qonni aortaga haydaydi." },
          ],
        },
        {
          type: "callout",
          tone: "important",
          text: "Chap qorincha devori o'ngnikidan ~3 baravar qalin, chunki u katta qon aylanish doirasining yuqori qarshiligini yengishi kerak.",
        },
      ],
      checkpoint: {
        question: "Nima uchun chap qorincha devori o'ng qorinchanikidan qalinroq?",
        options: [
          "Chunki u ko'proq qon sig'diradi",
          "Chunki u katta qon aylanish doirasining yuqori qarshiligini yengadi",
          "Chunki unda o'tkazuvchi tizim tugunlari joylashgan",
          "Chunki u kislorodsiz qon bilan ishlaydi",
        ],
        correctIndex: 1,
        explanation: "Hajmi bo'yicha qorinchalar deyarli teng. Farq bosimda: chap qorincha qonni butun tanaga (yuqori qarshilik) haydaydi, o'ng qorincha esa faqat o'pkaga (past qarshilik).",
      },
    },
    {
      title: "Klapan apparati",
      minutes: 4,
      sourceRef: "Ma'ruza, 10–13-betlar",
      blocks: [
        {
          type: "para",
          text: "Klapanlar qon oqimining bir tomonlamaligini ta'minlaydi. Ular ikki guruhga bo'linadi: bo'lmacha-qorincha (atrioventrikulyar) va yarim oysimon klapanlar.",
        },
        {
          type: "list",
          ordered: false,
          items: [
            { lead: "Uch tavaqali klapan", text: "o'ng bo'lmacha bilan o'ng qorincha orasida." },
            { lead: "Mitral (ikki tavaqali) klapan", text: "chap bo'lmacha bilan chap qorincha orasida." },
            { lead: "O'pka arteriyasi klapani", text: "o'ng qorincha chiqishida." },
            { lead: "Aorta klapani", text: "chap qorincha chiqishida." },
          ],
        },
        {
          type: "callout",
          tone: "warning",
          text: "Atrioventrikulyar klapan tavaqalari pay iplari (chordae tendineae) va so'rg'ichsimon mushaklar bilan ushlab turiladi. Ular shikastlansa tavaqa bo'lmachaga qaytariladi va qon teskari oqadi.",
        },
      ],
      checkpoint: {
        question: "Mitral klapan qaysi kameralar orasida joylashgan?",
        options: [
          "O'ng bo'lmacha va o'ng qorincha",
          "Chap bo'lmacha va chap qorincha",
          "Chap qorincha va aorta",
          "O'ng qorincha va o'pka arteriyasi",
        ],
        correctIndex: 1,
        explanation: "Mitral (ikki tavaqali) klapan chap bo'lmacha bilan chap qorincha orasida turadi. O'ng tomonda esa uch tavaqali klapan joylashgan.",
      },
    },
    {
      title: "Yurak devori qatlamlari va qon bilan ta'minlanishi",
      minutes: 4,
      sourceRef: "Ma'ruza, 14–18-betlar",
      blocks: [
        {
          type: "para",
          text: "Yurak devori uch qatlamdan iborat: ichkaridan tashqariga — endokard, miokard va epikard. Miokard asosiy ish bajaruvchi qatlam bo'lib, uning qalinligi kameraga qarab farq qiladi.",
        },
        {
          type: "list",
          ordered: true,
          items: [
            { lead: "Endokard", text: "ichki yuza; klapan tavaqalarini ham qoplaydi." },
            { lead: "Miokard", text: "yurak mushak to'qimasi — qisqarishni bajaradi." },
            { lead: "Epikard", text: "tashqi varaq, perikardning ichki qatlami." },
          ],
        },
        {
          type: "para",
          text: "Miokardni o'ng va chap toj (koronar) arteriyalar oziqlantiradi. Ular aortaning boshlang'ich qismidan chiqadi va yurak yuzasi bo'ylab tarqaladi. Venoz qon asosan toj sinusi orqali o'ng bo'lmachaga quyiladi.",
        },
        {
          type: "callout",
          tone: "important",
          text: "Koronar arteriyalar asosan DIASTOLA paytida to'ladi — yurak bo'shashganda. Shuning uchun juda tez ritmda (diastola qisqarganda) miokard oziqlanishi yomonlashadi.",
        },
      ],
      checkpoint: {
        question: "Koronar arteriyalar asosan qaysi fazada qon bilan to'ladi?",
        options: ["Sistola paytida", "Diastola paytida", "Ikkala fazada bir xil", "Faqat jismoniy yuklamada"],
        correctIndex: 1,
        explanation: "Sistolada qisqargan miokard o'z tomirlarini siqib qo'yadi. Koronar qon oqimi asosan diastolada — yurak bo'shashganda ta'minlanadi.",
      },
    },
    {
      title: "Xulosa",
      minutes: 2,
      sourceRef: "Ma'ruza, 19-bet",
      blocks: [
        {
          type: "para",
          text: "Yurak — to'rt kamerali mushak nasos. Kameralar klapanlar bilan ajratilgan, devor uch qatlamli, ish bajaruvchi qatlam miokard esa koronar arteriyalardan oziqlanadi. Anatomik tuzilish keyingi mavzudagi fiziologik jarayonlarni tushunish uchun asos bo'ladi.",
        },
      ],
    },
  ],
  objectives: [
    "Yurakning ko'krak qafasidagi joylashuvi va tashqi belgilarini ko'rsatish",
    "To'rt kamerani va ular orasidagi qon oqimi yo'nalishini izohlash",
    "Klapan apparatining tuzilishi va vazifasini tushuntirish",
    "Yurak devori qatlamlarini va koronar qon aylanishini bayon qilish",
  ],
  concepts: [
    "Perikard — yurakni o'rab turuvchi ikki varaqli xalta, ishqalanishni kamaytiradi",
    "Atrioventrikulyar klapanlar — bo'lmacha va qorincha orasidagi bir tomonlama darvoza",
    "Yarim oysimon klapanlar — qorincha chiqishidagi (aorta va o'pka arteriyasi) klapanlar",
    "Miokard — yurak devorining ish bajaruvchi mushak qatlami",
    "Koronar arteriyalar — miokardni oziqlantiruvchi tomirlar, aortadan chiqadi",
  ],
  terms: [
    { ru: "Перикард", uz: "Perikard", lat: "Pericardium" },
    { ru: "Миокард", uz: "Miokard", lat: "Myocardium" },
    { ru: "Эндокард", uz: "Endokard", lat: "Endocardium" },
    { ru: "Эпикард", uz: "Epikard", lat: "Epicardium" },
    { ru: "Митральный клапан", uz: "Mitral klapan", lat: "Valva mitralis" },
    { ru: "Трёхстворчатый клапан", uz: "Uch tavaqali klapan", lat: "Valva tricuspidalis" },
    { ru: "Верхушка сердца", uz: "Yurak cho'qqisi", lat: "Apex cordis" },
    { ru: "Коронарная артерия", uz: "Toj (koronar) arteriya", lat: "Arteria coronaria" },
    { ru: "Сухожильные хорды", uz: "Pay iplari", lat: "Chordae tendineae" },
  ],
  facts: [
    "Yurak massasi kattalarda ~250–350 g; uchdan ikki qismi o'rta chiziqdan chapda joylashgan.",
    "Chap qorincha devori o'ng qorinchanikidan ~3 baravar qalin (yuqori bosimga qarshi ishlaydi).",
    "Chap bo'lmachaga to'rtta o'pka venasi quyiladi.",
    "Koronar arteriyalar aortaning boshlang'ich qismidan chiqadi va asosan diastolada to'ladi.",
    "Yurak devori uch qatlam: endokard (ichki), miokard (o'rta), epikard (tashqi).",
  ],
  dosages: [] as string[],
  imageIdeas: [] as string[],
};

const ANATOMY_MATERIALS = [
  {
    fileName: "Yurak anatomiyasi — ma'ruza konspekti.md",
    fileType: "md",
    body: `# Yurak anatomiyasi — ma'ruza konspekti

## 1. Joylashuvi
- O'rta ko'ks bo'shlig'ida, ikki o'pka orasida
- 2/3 qismi o'rta chiziqdan chapda
- Massasi ~250-350 g
- Perikard (yurak xaltasi) ichida

## 2. Kameralar
| Kamera | Qayerdan qon oladi | Qayerga haydaydi |
|--------|--------------------|------------------|
| O'ng bo'lmacha | Kovak venalar | O'ng qorincha |
| O'ng qorincha | O'ng bo'lmacha | O'pka arteriyasi |
| Chap bo'lmacha | 4 ta o'pka venasi | Chap qorincha |
| Chap qorincha | Chap bo'lmacha | Aorta |

## 3. Klapanlar
- Uch tavaqali — o'ng bo'lmacha/o'ng qorincha
- Mitral (ikki tavaqali) — chap bo'lmacha/chap qorincha
- O'pka arteriyasi klapani — o'ng qorincha chiqishi
- Aorta klapani — chap qorincha chiqishi

Tavaqalar pay iplari (chordae tendineae) va so'rg'ichsimon mushaklar bilan ushlanadi.

## 4. Devor qatlamlari
Endokard (ichki) -> Miokard (mushak, ish bajaruvchi) -> Epikard (tashqi)

## 5. Koronar qon aylanish
- O'ng va chap toj arteriyalari aortaning boshlanishidan chiqadi
- Venoz qon toj sinusi orqali o'ng bo'lmachaga quyiladi
- **Muhim:** koronar oqim asosan DIASTOLADA ta'minlanadi
`,
  },
  {
    fileName: "Klapanlar — amaliy mashg'ulot uchun sxema izohi.txt",
    fileType: "txt",
    body: `KLAPAN APPARATI - AMALIY MASHG'ULOT IZOHI

1. ATRIOVENTRIKULYAR KLAPANLAR (bo'lmacha-qorincha)
   O'ng: uch tavaqali (tricuspidalis)
   Chap: ikki tavaqali / mitral (mitralis)
   Vazifasi: qorincha sistolasida qonning bo'lmachaga qaytishiga yo'l qo'ymaydi.
   Ushlab turuvchi apparat: chordae tendineae + so'rg'ichsimon mushaklar.

2. YARIM OYSIMON KLAPANLAR
   O'pka arteriyasi klapani (o'ng qorincha chiqishida)
   Aorta klapani (chap qorincha chiqishida)
   Vazifasi: diastolada qonning qorinchaga qaytishiga yo'l qo'ymaydi.

3. ESHITISH NUQTALARI (auskultatsiya)
   Mitral - yurak cho'qqisida (V qovurg'alararo oraliq, chapda)
   Uch tavaqali - to'sh suyagi pastki qismida
   Aorta - II qovurg'alararo oraliq, o'ngda
   O'pka arteriyasi - II qovurg'alararo oraliq, chapda

4. KLINIK IZOH
   Tavaqa yopilmasa - yetishmovchilik (qon teskari oqadi).
   Teshik torayса - stenoz (qon o'tishi qiyinlashadi).
`,
  },
];

const ANATOMY_LINKS = [
  {
    title: "Gray's Anatomy for Students — Thorax",
    url: "https://www.elsevier.com/books/grays-anatomy-for-students/drake/978-0-323-93425-1",
    note: "3-bob: Ko'krak qafasi va yurak",
  },
  {
    title: "AMBOSS — Heart anatomy",
    url: "https://www.amboss.com/us/knowledge/heart",
    note: "Klinik ma'lumotnoma, rasmlar bilan",
  },
];

// ------------------------------------------------- konspekt: Buyrak fiziologiyasi

const KIDNEY_DIGEST = {
  sections: [
    {
      title: "Nefron — buyrakning ish birligi",
      minutes: 4,
      sourceRef: "Ma'ruza, 1–5-betlar",
      blocks: [
        {
          type: "para",
          text: "Har bir buyrakda taxminan bir million nefron bor. Nefron buyrak tanachasi (koptokcha va Shumlyanskiy–Boumen kapsulasi) hamda kanalchalar tizimidan iborat. Siydik hosil bo'lishi shu tuzilmalarda uch bosqichda kechadi.",
        },
        {
          type: "list",
          ordered: true,
          items: [
            { lead: "Filtratsiya", text: "koptokchada qon plazmasi kapsulaga suziladi." },
            { lead: "Reabsorbsiya", text: "kerakli moddalar kanalchalardan qonga qaytariladi." },
            { lead: "Sekretsiya", text: "ortiqcha moddalar qondan kanalchaga chiqariladi." },
          ],
        },
        {
          type: "callout",
          tone: "important",
          text: "Sutkada ~180 l birlamchi siydik hosil bo'ladi, lekin oxirgi siydik atigi ~1,5 l — ya'ni suvning 99% dan ortig'i qayta so'riladi.",
        },
      ],
      checkpoint: {
        question: "Sutkalik ~180 l birlamchi siydikdan oxirgi siydik qancha qoladi?",
        options: ["~18 l", "~1,5 l", "~50 l", "~0,1 l"],
        correctIndex: 1,
        explanation: "Birlamchi siydikning 99% dan ortig'i kanalchalarda qayta so'riladi — natijada sutkada o'rtacha 1,5 l oxirgi siydik ajraladi.",
      },
    },
    {
      title: "Koptokcha filtratsiyasi va uni belgilovchi omillar",
      minutes: 4,
      sourceRef: "Ma'ruza, 6–10-betlar",
      blocks: [
        {
          type: "para",
          text: "Filtratsiya koptokcha kapillyarlaridagi gidrostatik bosim hisobiga boradi. Unga plazma onkotik bosimi va kapsuladagi bosim qarshilik ko'rsatadi. Ularning yig'indisi samarali filtratsiya bosimini beradi.",
        },
        {
          type: "list",
          ordered: false,
          items: [
            { lead: "Koptokcha filtratsiya tezligi (KFT)", text: "sog'lom kattalarda ~90–120 ml/daq." },
            { lead: "Olib keluvchi arteriola", text: "torayса — filtratsiya kamayadi." },
            { lead: "Olib ketuvchi arteriola", text: "torayса — filtratsiya vaqtincha ortadi." },
          ],
        },
        {
          type: "callout",
          tone: "warning",
          text: "Sistolik bosim ~80 mm sim. ust. dan pastga tushsa, filtratsiya deyarli to'xtaydi — shok holatida siydik ajralishining kamayishi shu bilan izohlanadi.",
        },
      ],
      checkpoint: {
        question: "Sog'lom kattalarda koptokcha filtratsiya tezligi (KFT) qanday?",
        options: ["~10–20 ml/daq", "~40–60 ml/daq", "~90–120 ml/daq", "~250–300 ml/daq"],
        correctIndex: 2,
        explanation: "Normal KFT ~90–120 ml/daq. Uning pasayishi buyrak funksiyasi buzilishining asosiy ko'rsatkichi hisoblanadi.",
      },
    },
    {
      title: "Buyrakning gomeostatik vazifalari",
      minutes: 3,
      sourceRef: "Ma'ruza, 11–14-betlar",
      blocks: [
        {
          type: "para",
          text: "Buyrak faqat chiqaruv a'zosi emas. U suv-tuz muvozanatini, kislota-ishqor holatini boshqaradi va bir qator biologik faol moddalar ishlab chiqaradi.",
        },
        {
          type: "list",
          ordered: false,
          items: [
            { lead: "Renin", text: "arterial bosimni boshqarish zanjirini ishga tushiradi." },
            { lead: "Eritropoetin", text: "qizil qon tanachalari hosil bo'lishini rag'batlantiradi." },
            { lead: "D vitamini faollashuvi", text: "kalsiy almashinuvi uchun zarur." },
          ],
        },
      ],
      checkpoint: {
        question: "Buyrakda ishlab chiqariladigan qaysi modda eritrotsitlar hosil bo'lishini rag'batlantiradi?",
        options: ["Renin", "Eritropoetin", "Aldosteron", "Insulin"],
        correctIndex: 1,
        explanation: "Eritropoetin buyrakda sintezlanadi. Surunkali buyrak yetishmovchiligida uning yetishmasligi kamqonlikka olib keladi.",
      },
    },
  ],
  objectives: [
    "Nefron tuzilishini va siydik hosil bo'lishining uch bosqichini tushuntirish",
    "Koptokcha filtratsiyasini belgilovchi omillarni izohlash",
    "Buyrakning gomeostatik va endokrin vazifalarini sanab berish",
  ],
  concepts: [
    "Nefron — buyrakning struktur-funksional birligi (~1 mln har buyrakda)",
    "Filtratsiya — koptokchada plazmaning kapsulaga suzilishi",
    "Reabsorbsiya — kerakli moddalarning kanalchadan qonga qaytishi",
    "KFT — koptokcha filtratsiya tezligi, buyrak funksiyasining asosiy ko'rsatkichi",
  ],
  terms: [
    { ru: "Нефрон", uz: "Nefron", lat: "Nephronum" },
    { ru: "Клубочек", uz: "Koptokcha", lat: "Glomerulus" },
    { ru: "Капсула Шумлянского-Боумена", uz: "Shumlyanskiy–Boumen kapsulasi", lat: "Capsula glomeruli" },
    { ru: "Реабсорбция", uz: "Reabsorbsiya", lat: "Reabsorptio" },
    { ru: "Эритропоэтин", uz: "Eritropoetin", lat: "Erythropoetinum" },
  ],
  facts: [
    "Har bir buyrakda ~1 million nefron bor.",
    "Sutkada ~180 l birlamchi siydik hosil bo'ladi, oxirgi siydik ~1,5 l.",
    "Normal KFT ~90–120 ml/daq.",
    "Sistolik bosim ~80 mm sim. ust. dan pastda filtratsiya deyarli to'xtaydi.",
  ],
  dosages: [] as string[],
  imageIdeas: [] as string[],
};

const KIDNEY_MATERIAL = {
  fileName: "Buyrak fiziologiyasi — ma'ruza konspekti.md",
  fileType: "md",
  body: `# Buyrak fiziologiyasi — ma'ruza konspekti

## 1. Nefron
- Har buyrakda ~1 mln nefron
- Buyrak tanachasi: koptokcha + Shumlyanskiy-Boumen kapsulasi
- Kanalchalar: proksimal -> Genle qovuzlog'i -> distal -> yig'uvchi naycha

## 2. Siydik hosil bo'lishi (3 bosqich)
1. **Filtratsiya** — koptokchada (~180 l/sutka birlamchi siydik)
2. **Reabsorbsiya** — kanalchalarda (suvning 99%+ qaytadi)
3. **Sekretsiya** — qondan kanalchaga chiqarish

Natija: ~1,5 l oxirgi siydik/sutka

## 3. KFT (koptokcha filtratsiya tezligi)
- Norma: ~90-120 ml/daq
- Sistolik bosim <80 mm sim. ust. -> filtratsiya deyarli to'xtaydi

## 4. Endokrin vazifalar
- Renin — arterial bosim boshqaruvi
- Eritropoetin — eritropoez
- D vitamini faollashuvi — kalsiy almashinuvi
`,
};

/** Nefrologiya testi — kurs bo'sh ko'rinmasin (chop etilgan). */
const KIDNEY_QUESTIONS = [
  {
    text: "Nefronning struktur-funksional birligi sifatida sutkada qancha birlamchi siydik hosil bo'ladi?",
    options: ["~18 l", "~180 l", "~1,5 l", "~60 l"],
    correctIndex: 1,
    explanation: "Koptokchalarda sutkada ~180 l birlamchi siydik suziladi; uning 99% dan ortig'i qayta so'riladi.",
    difficulty: "RECALL" as const,
  },
  {
    text: "Koptokcha filtratsiya tezligining (KFT) normal qiymati qaysi?",
    options: ["10–20 ml/daq", "40–60 ml/daq", "90–120 ml/daq", "200–250 ml/daq"],
    correctIndex: 2,
    explanation: "Sog'lom kattalarda KFT ~90–120 ml/daq. Pasayishi buyrak funksiyasi buzilganini ko'rsatadi.",
    difficulty: "RECALL" as const,
  },
  {
    text: "Olib ketuvchi arteriola torayganda koptokchada nima kuzatiladi?",
    options: [
      "Filtratsiya bosimi pasayadi",
      "Filtratsiya bosimi vaqtincha ortadi",
      "Filtratsiya butunlay to'xtaydi",
      "Reabsorbsiya to'xtaydi",
    ],
    correctIndex: 1,
    explanation: "Olib ketuvchi arteriola torayса, koptokchadan qon chiqishi qiyinlashadi va kapillyar ichidagi gidrostatik bosim ortadi — filtratsiya vaqtincha kuchayadi.",
    difficulty: "UNDERSTAND" as const,
  },
  {
    text: "Surunkali buyrak yetishmovchiligida kamqonlik rivojlanishining asosiy sababi nima?",
    options: [
      "Temir yetishmasligi",
      "Eritropoetin ishlab chiqarilishining kamayishi",
      "B12 vitamini so'rilmasligi",
      "Qon yo'qotish",
    ],
    correctIndex: 1,
    explanation: "Eritropoetin buyrakda sintezlanadi. Buyrak parenximasi shikastlansa uning ishlab chiqarilishi kamayadi va eritropoez susayadi.",
    difficulty: "APPLY" as const,
  },
  {
    text: "Shok holatida siydik ajralishi keskin kamayadi. Buning fiziologik asosi nima?",
    options: [
      "Kanalchalarda reabsorbsiya to'xtaydi",
      "Arterial bosim pasayib, koptokcha filtratsiyasi deyarli to'xtaydi",
      "Siydik yo'llari torayadi",
      "Eritropoetin ko'payadi",
    ],
    correctIndex: 1,
    explanation: "Sistolik bosim ~80 mm sim. ust. dan pastga tushsa, samarali filtratsiya bosimi yo'qoladi va siydik hosil bo'lishi to'xtaydi.",
    difficulty: "APPLY" as const,
  },
];

// ----------------------------------------------------------------------- asosiy

async function main() {
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher.m11demo@meduni.uz" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@meduni.uz" } });
  const group = await prisma.studentGroup.findFirstOrThrow({ where: { name: "301-guruh" } });
  const cardio = await prisma.course.findFirstOrThrow({ where: { name: "Kardiologiya" } });
  const nefro = await prisma.course.findFirstOrThrow({ where: { name: "Nefrologiya" } });
  const anatomy = await prisma.topic.findFirstOrThrow({ where: { courseId: cardio.id, orderIndex: 1 } });
  const physio = await prisma.topic.findFirstOrThrow({ where: { courseId: cardio.id, orderIndex: 2 } });
  const kidney = await prisma.topic.findFirstOrThrow({ where: { courseId: nefro.id, orderIndex: 1 } });

  // ============================================================ 1) TALABALAR
  const passwordHash = await argon2.hash("student123");
  const students: { id: number; plan: StudentPlan }[] = [];
  for (const plan of STUDENTS) {
    const user = await prisma.user.upsert({
      where: { email: plan.email },
      create: {
        email: plan.email,
        passwordHash,
        fullName: plan.fullName,
        role: "STUDENT",
        groupId: group.id,
        isActive: true,
      },
      update: { fullName: plan.fullName, groupId: group.id, isActive: true },
    });
    for (const course of [cardio, nefro]) {
      await prisma.enrollment.upsert({
        where: { studentId_courseId: { studentId: user.id, courseId: course.id } },
        create: { studentId: user.id, courseId: course.id, status: "ACTIVE" },
        update: { status: "ACTIVE" },
      });
    }
    students.push({ id: user.id, plan });
  }
  log(`✓ Talabalar: ${students.length} ta (301-guruh, 2 kursga yozildi)`);

  // ====================================================== 2) KONSPEKT + MANBA
  async function putDigest(topicId: number, digest: object, label: string) {
    await prisma.topicDigest.upsert({
      where: { topicId },
      create: { topicId, digestJson: digest, version: 1, approvedByTeacher: true },
      update: { digestJson: digest, approvedByTeacher: true },
    });
    log(`✓ Konspekt tasdiqlandi: ${label}`);
  }

  async function putMaterials(topicId: number, list: { fileName: string; fileType: string; body: string }[]) {
    for (const m of list) {
      const buf = Buffer.from(m.body, "utf8");
      let row = await prisma.sourceMaterial.findFirst({ where: { topicId, fileName: m.fileName } });
      if (!row) {
        row = await prisma.sourceMaterial.create({
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
      }
      // Fayllarni HAR SAFAR qayta yozamiz — endi ular bazada (doimiy) saqlanadi.
      const fileUrl = await saveMaterialFile(topicId, row.id, m.fileName, buf);
      const parsedTextUrl = await saveParsedText(topicId, row.id, m.body);
      await prisma.sourceMaterial.update({
        where: { id: row.id },
        data: { fileUrl, parsedTextUrl, sizeBytes: buf.length, parseStatus: "DONE", parseError: null },
      });
      log(`  · material: ${m.fileName}`);
    }
  }

  async function putLinks(topicId: number, links: { title: string; url: string; note: string }[]) {
    for (const [i, l] of links.entries()) {
      const exists = await prisma.topicLink.findFirst({ where: { topicId, url: l.url } });
      if (!exists) await prisma.topicLink.create({ data: { topicId, ...l, orderIndex: i } });
    }
  }

  await putDigest(anatomy.id, ANATOMY_DIGEST, anatomy.title);
  await putMaterials(anatomy.id, ANATOMY_MATERIALS);
  await putLinks(anatomy.id, ANATOMY_LINKS);

  await putDigest(kidney.id, KIDNEY_DIGEST, kidney.title);
  await putMaterials(kidney.id, [KIDNEY_MATERIAL]);
  await putLinks(kidney.id, [
    {
      title: "Guyton & Hall — Renal physiology",
      url: "https://www.sciencedirect.com/book/9780323597128/guyton-and-hall-textbook-of-medical-physiology",
      note: "25–31-boblar",
    },
  ]);

  // ============================================ 3) NEFROLOGIYA TESTI (published)
  const kidneyItem = await prisma.contentItem.upsert({
    where: { topicId_kind: { topicId: kidney.id, kind: "QUIZ" } },
    create: {
      topicId: kidney.id,
      kind: "QUIZ",
      language: "uz",
      status: "PUBLISHED",
      approvedById: teacher.id,
      approvedAt: new Date(),
      reviewOpenedAt: new Date(),
      factcheckStatus: "CLEAN",
      factcheckedAt: new Date(),
    },
    update: { status: "PUBLISHED", approvedById: teacher.id, approvedAt: new Date() },
  });
  const kidneyQuiz = await prisma.quiz.upsert({
    where: { contentItemId: kidneyItem.id },
    create: { contentItemId: kidneyItem.id, passThreshold: 70, maxAttempts: 1 },
    update: { passThreshold: 70 },
  });
  if ((await prisma.question.count({ where: { quizId: kidneyQuiz.id } })) === 0) {
    for (const [i, q] of KIDNEY_QUESTIONS.entries()) {
      await prisma.question.create({
        data: {
          quizId: kidneyQuiz.id,
          text: q.text,
          optionsJson: q.options,
          correctIndex: q.correctIndex,
          explanationJson: { uz: q.explanation },
          difficulty: q.difficulty,
          orderIndex: i + 1,
        },
      });
    }
  }
  log(`✓ Nefrologiya testi chop etildi (${KIDNEY_QUESTIONS.length} savol)`);

  // ==================================================== 4) HAFTALIK JADVAL (slot)
  const cycleStart = addDays(mondayOf(TODAY), -28);
  const cycleEnd = addDays(mondayOf(TODAY), 56);
  const SLOTS: { courseId: number; weekday: number; startTime: string; room: string }[] = [
    { courseId: cardio.id, weekday: 0, startTime: "09:00", room: "214-xona" },
    { courseId: cardio.id, weekday: 2, startTime: "11:00", room: "214-xona" },
    { courseId: nefro.id, weekday: 4, startTime: "14:00", room: "118-xona" },
  ];
  for (const s of SLOTS) {
    const exists = await prisma.scheduleSlot.findFirst({
      where: { courseId: s.courseId, groupId: group.id, weekday: s.weekday, startTime: s.startTime },
    });
    if (!exists) await prisma.scheduleSlot.create({ data: { ...s, groupId: group.id } });
  }
  for (const c of [cardio, nefro]) {
    await prisma.courseGroup.updateMany({
      where: { courseId: c.id, groupId: group.id },
      data: { cycleStart, cycleEnd },
    });
  }
  log(`✓ Jadval: 3 slot · sikl ${cycleStart.toLocaleDateString("ru-RU")} — ${cycleEnd.toLocaleDateString("ru-RU")}`);

  // ============================================== 5) O'TGAN DARSLAR + YO'QLAMA
  // Slotlardan o'tgan sanalarni hosil qilamiz va yo'qlama belgilaymiz.
  let sessionCount = 0;
  let markCount = 0;
  for (const s of SLOTS) {
    const topicId = s.courseId === cardio.id ? (s.weekday === 0 ? anatomy.id : physio.id) : kidney.id;
    for (let w = -4; w <= 0; w++) {
      const day = addDays(mondayOf(TODAY), w * 7 + s.weekday);
      if (day >= TODAY) continue; // faqat o'tgan darslar belgilanadi
      if (day < cycleStart) continue;
      const date = atTime(day, s.startTime);
      let session = await prisma.lessonSession.findFirst({
        where: { courseId: s.courseId, groupId: group.id, date },
      });
      if (!session) {
        session = await prisma.lessonSession.create({
          data: {
            courseId: s.courseId,
            groupId: group.id,
            topicId,
            date,
            room: s.room,
            createdById: teacher.id,
          },
        });
      }
      sessionCount++;
      for (const [idx, st] of students.entries()) {
        // Har talabaning o'z davomat foizi — barqaror (sana+indeks bo'yicha).
        const seed = (Math.abs(w) * 7 + s.weekday + idx * 3) % 10;
        const present = seed / 10 < st.plan.attendance;
        const status = present ? (seed === 3 ? "LATE" : "PRESENT") : seed === 7 ? "EXCUSED" : "ABSENT";
        await prisma.attendance.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: st.id } },
          create: { sessionId: session.id, studentId: st.id, status, markedById: teacher.id },
          update: { status },
        });
        markCount++;
      }
    }
  }
  log(`✓ Yo'qlama: ${sessionCount} dars · ${markCount} belgi`);

  // ===================================================== 6) TEST URINISHLARI
  const quizzes = await prisma.quiz.findMany({
    where: { contentItem: { topicId: { in: [anatomy.id, physio.id] } } },
    include: { contentItem: true, questions: { orderBy: { orderIndex: "asc" } } },
  });
  const quizByTopic = new Map(quizzes.map((q) => [q.contentItem.topicId, q]));

  async function putAttempt(studentId: number, topicId: number, scorePct: number | null, daysAgo: number) {
    const quiz = quizByTopic.get(topicId);
    if (!quiz || scorePct === null) return;
    const total = quiz.questions.length;
    const correctCount = Math.round((scorePct / 100) * total);
    // Javoblar: birinchi `correctCount` savol to'g'ri, qolganlari ATAYLAB xato
    // (xatolar xaritasi va "xatolar ustida ishlash" moduli uchun manba).
    const answers: Record<string, number> = {};
    quiz.questions.forEach((q, i) => {
      const opts = (q.optionsJson as unknown[]).length || 4;
      answers[String(q.id)] = i < correctCount ? q.correctIndex : (q.correctIndex + 1) % opts;
    });
    const finishedAt = addDays(TODAY, -daysAgo);
    const existing = await prisma.quizAttempt.findFirst({ where: { quizId: quiz.id, studentId } });
    const data = {
      answersJson: answers,
      scorePct,
      passed: scorePct >= quiz.passThreshold,
      finishedAt,
      startedAt: new Date(finishedAt.getTime() - 12 * 60 * 1000),
    };
    if (existing) await prisma.quizAttempt.update({ where: { id: existing.id }, data });
    else await prisma.quizAttempt.create({ data: { quizId: quiz.id, studentId, attemptNo: 1, ...data } });
  }

  for (const [i, st] of students.entries()) {
    await putAttempt(st.id, anatomy.id, st.plan.quiz1, 6 + (i % 3));
    await putAttempt(st.id, physio.id, st.plan.quiz2, 2 + (i % 3));
  }
  log("✓ Test urinishlari yozildi (xatolari bilan)");

  // ======================================================== 7) KEYS JAVOBLARI
  const caseItem = await prisma.clinicalCase.findFirst({
    where: { contentItem: { topicId: physio.id, kind: "CASE" } },
    include: { contentItem: true },
  });
  if (caseItem) {
    const caseJson = caseItem.caseJson as { steps?: { options?: { correct?: boolean }[] }[]; questions?: string[] };
    const steps = caseJson.steps ?? [];
    const questions = caseJson.questions ?? [];
    const ANSWERS = [
      "Yurak chiqishi = zarba hajmi × yurak urishi soni. Bemorda chastota keskin pasaygan, zarba hajmi esa buni to'liq qoplay olmaydi — natijada minutlik hajm kamayib, miya perfuziyasi buziladi.",
      "O'tkazuvchi tizimning quyi bo'limlari ham avtomatizmga ega: yuqori markaz impulsi yetib bormasa, AV tugun yoki Purkinye tolalari o'z chastotasida vodiy ritm rolini oladi.",
    ];
    let pending = 0;
    let reviewed = 0;
    for (const [i, st] of students.entries()) {
      if (!st.plan.caseState) continue;
      // Qadam javoblari: ko'pchiligi to'g'ri, bittasi ataylab xato.
      const stepsAns: Record<string, number> = {};
      steps.forEach((step, si) => {
        const correctIdx = (step.options ?? []).findIndex((o) => o?.correct);
        const opts = (step.options ?? []).length || 3;
        const wrongHere = si === 1 && i % 2 === 0; // ba'zi talabalarda 2-qadam xato
        stepsAns[String(si)] = wrongHere ? (Math.max(correctIdx, 0) + 1) % opts : Math.max(correctIdx, 0);
      });
      const okSteps = steps.filter((s, si) => {
        const correctIdx = (s.options ?? []).findIndex((o) => o?.correct);
        return stepsAns[String(si)] === Math.max(correctIdx, 0);
      }).length;
      const autoScore = steps.length ? Math.round((okSteps / steps.length) * 100) : null;
      const submittedAt = addDays(TODAY, -(1 + (i % 3)));
      const isReviewed = st.plan.caseState === "reviewed";
      const data = {
        answersJson: questions.map((_, qi) => ANSWERS[qi] ?? ANSWERS[0]),
        stepsJson: stepsAns,
        autoScore,
        submittedAt,
        ...(isReviewed
          ? {
              score: autoScore && autoScore >= 100 ? 92 : 78,
              teacherFeedback:
                "Javob asosli, formulaga tayangansiz. Qadamlar ketma-ketligi to'g'ri. Keyingi safar gemodinamik ko'rsatkichlarning normal qiymatlarini ham keltiring.",
              reviewedById: teacher.id,
              reviewedAt: addDays(TODAY, -(1 + (i % 3)) + 1),
            }
          : { score: null, teacherFeedback: null, reviewedById: null, reviewedAt: null }),
      };
      const existing = await prisma.caseAttempt.findFirst({ where: { caseId: caseItem.id, studentId: st.id } });
      if (existing) await prisma.caseAttempt.update({ where: { id: existing.id }, data });
      else await prisma.caseAttempt.create({ data: { caseId: caseItem.id, studentId: st.id, ...data } });
      if (isReviewed) reviewed++;
      else pending++;
    }
    log(`✓ Keys javoblari: ${pending} ta tekshiruvda · ${reviewed} ta baholangan`);
  }

  // ============================================== 8) FLESHKARTA TAKRORLARI
  const dueStudents = students.filter((s) => s.plan.flashcardsDue);
  for (const st of dueStudents) {
    for (const [i, key] of ["q1", "q2", "term:Miokard", "term:Perikard"].entries()) {
      await prisma.flashcardReview.upsert({
        where: { studentId_topicId_cardKey: { studentId: st.id, topicId: anatomy.id, cardKey: key } },
        create: {
          studentId: st.id,
          topicId: anatomy.id,
          cardKey: key,
          known: i % 2 === 0,
          intervalDays: i % 2 === 0 ? 3 : 1,
          dueAt: addDays(TODAY, i % 2 === 0 ? 0 : -1), // bugun/kechagi → "takrorlash kerak"
        },
        update: { dueAt: addDays(TODAY, i % 2 === 0 ? 0 : -1) },
      });
    }
  }
  log(`✓ Fleshkarta takrorlari: ${dueStudents.length} talabada bugunga tayyor`);

  // ==================================================== 9) TOPSHIRIQLAR (Task)
  const existingTasks = await prisma.task.count();
  if (existingTasks === 0) {
    await prisma.task.create({
      data: {
        title: "Kafedra yig'ilishiga o'quv materiallarini tayyorlang",
        description: "Kardiologiya kafedrasi yig'ilishi uchun joriy semestr kontent holatini tayyorlab keling.",
        createdById: admin.id,
        assignedToId: teacher.id,
        priority: "HIGH",
        dueDate: addDays(TODAY, 3),
        departmentId: cardio.departmentId,
      },
    });
    const batchId = `demo-${TODAY.getTime()}`;
    for (const st of students) {
      await prisma.task.create({
        data: {
          title: "Yurak anatomiyasi mavzusini takrorlang",
          description: "Amaliy mashg'ulotga qadar konspekt bo'limlarini o'qib, testni ishlab keling.",
          createdById: teacher.id,
          assignedToId: st.id,
          courseId: cardio.id,
          topicId: anatomy.id,
          groupId: group.id,
          batchId,
          dueDate: addDays(TODAY, 2),
          status: st.plan.quiz1 !== null ? "DONE" : "OPEN",
          completedAt: st.plan.quiz1 !== null ? addDays(TODAY, -1) : null,
        },
      });
    }
    log(`✓ Topshiriqlar: 1 (admin→o'qituvchi) + ${students.length} (o'qituvchi→guruh)`);
  } else {
    log(`· Topshiriqlar mavjud (${existingTasks} ta) — o'tkazib yuborildi`);
  }

  // ================================================= 10) PROGRESSNI QAYTA HISOB
  for (const st of students) {
    for (const t of [anatomy.id, physio.id, kidney.id]) {
      await syncTopicProgress(st.id, t);
    }
  }
  log("✓ Progress qayta hisoblandi (heatmap/reyting uchun)");

  // ------------------------------------------------------------------ xulosa
  const summary = {
    talabalar: await prisma.user.count({ where: { role: "STUDENT" } }),
    darslar: await prisma.lessonSession.count(),
    yoqlama: await prisma.attendance.count(),
    testUrinishlari: await prisma.quizAttempt.count(),
    keysJavoblari: await prisma.caseAttempt.count(),
    materiallar: await prisma.sourceMaterial.count(),
    fayllarBazada: await prisma.fileBlob.count(),
    slotlar: await prisma.scheduleSlot.count(),
    topshiriqlar: await prisma.task.count(),
  };
  console.log("\n✅ Jonli demo tayyor:", summary);
  console.log("   Login: admin@meduni.uz/admin123 · teacher.m11demo@meduni.uz/student123 · student@meduni.uz/student123");
  console.log("   Yangi talabalar paroli: student123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
