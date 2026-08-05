// Virtual bemor: TEKSHIRUV KATALOGI va NARXI (2026-08-06, buyurtmachi:
// "bemorga ham EKG ham siydik ham boshqa analiz shart bo'lmasligi mumkin —
// hammasini topshirsa qimmatga tushadiku").
//
// Real hayotda har tahlil bemorning puliga tushadi, shuning uchun "hammasini
// bosib chiqish" — klinik XATO. Bu yerda narx DETERMINISTIK (AI chaqiruvisiz):
// katalog yagona manba, talaba buyurgan har tekshiruvning qiymati nomidan
// qayta hisoblanadi → bazaga ustun qo'shish (migratsiya) kerak emas.
//
// Narx birligi — MING SO'M (taxminiy bozor darajasi, o'quv maqsadida).

export type TestGroup = "lab" | "instr";

export interface TestDef {
  uz: string;
  ru: string;
  group: TestGroup;
  /** Narx — ming so'm. */
  cost: number;
}

export const TEST_CATALOG: TestDef[] = [
  // ── Laboratoriya ──
  { uz: "Umumiy qon tahlili", ru: "Общий анализ крови", group: "lab", cost: 35 },
  { uz: "Umumiy siydik tahlili", ru: "Общий анализ мочи", group: "lab", cost: 25 },
  { uz: "Qon shakari", ru: "Глюкоза крови", group: "lab", cost: 20 },
  { uz: "Biokimyoviy tahlil", ru: "Биохимический анализ", group: "lab", cost: 90 },
  { uz: "C-reaktiv oqsil", ru: "С-реактивный белок", group: "lab", cost: 55 },
  { uz: "Lipid profili", ru: "Липидный профиль", group: "lab", cost: 70 },
  { uz: "Koagulogramma", ru: "Коагулограмма", group: "lab", cost: 80 },
  { uz: "Troponin", ru: "Тропонин", group: "lab", cost: 120 },
  // ── Instrumental ──
  { uz: "EKG", ru: "ЭКГ", group: "instr", cost: 30 },
  { uz: "Koʻkrak qafasi rentgeni", ru: "Рентген грудной клетки", group: "instr", cost: 60 },
  { uz: "Qorin boʻshligʻi UZI", ru: "УЗИ брюшной полости", group: "instr", cost: 90 },
  { uz: "EXO-KG", ru: "ЭХО-КГ", group: "instr", cost: 150 },
  { uz: "FGDS (endoskopiya)", ru: "ФГДС (эндоскопия)", group: "instr", cost: 200 },
  { uz: "Holter monitoring", ru: "Холтер-мониторинг", group: "instr", cost: 250 },
  { uz: "Kompyuter tomografiya (KT)", ru: "Компьютерная томография (КТ)", group: "instr", cost: 550 },
  { uz: "MRT", ru: "МРТ", group: "instr", cost: 900 },
];

/** Katalogda yo'q (erkin yozilgan) tekshiruv uchun taxminiy narx. */
const DEFAULT_COST = 60;

// Erkin buyurtma narxini nomidan taxmin qiladi — AI chaqiruvisiz, deterministik
// (qayta hisoblansa aynan o'sha qiymat chiqadi). Eng qimmat mos birinchi.
//   `words` — butun so'z sifatida ("kt" so'zi "kokrak" ichida topilmasin);
//   `subs`  — o'zak (so'z ichida ham topiladi).
// ⚠️ `\b` ishlatilMAYDI: JS'da u `\w` = [A-Za-z0-9_] ga tayanadi, ya'ni kirill
// harf so'z belgisi emas → `\bкт\b` HECH QACHON mos kelmaydi (o'lchandi).
// O'rniga unicode lookaround chegarasi.
const WB_START = "(?<![\\p{L}\\p{N}])";
const WB_END = "(?![\\p{L}\\p{N}])";

interface CostHint {
  words?: string[];
  subs?: string[];
  cost: number;
}

const COST_HINTS: CostHint[] = [
  { words: ["mrt", "mri", "мрт"], subs: ["magnit.?rezonans", "магнитно.?резонанс"], cost: 900 },
  { subs: ["koronarograf", "коронарограф", "angiograf", "ангиограф"], cost: 800 },
  { words: ["kt", "ct", "кт"], subs: ["tomograf", "томограф"], cost: 550 },
  { subs: ["biopsi", "биопси", "gistolog", "гистолог"], cost: 400 },
  { subs: ["holter", "холтер"], cost: 250 },
  { subs: ["endoskop", "эндоскоп", "fgds", "фгдс", "kolonoskop", "колоноскоп"], cost: 200 },
  { words: ["exo", "eko", "ehokg", "exokg"], subs: ["эхо.?кг", "ehokardio", "эхокардио"], cost: 150 },
  { subs: ["troponin", "тропонин", "d.?dimer", "д.?димер"], cost: 120 },
  { words: ["ttg", "tsh", "ттг"], subs: ["gormon", "гормон"], cost: 110 },
  { words: ["uzi", "uzdg", "узи", "уздг"], subs: ["ultratovush", "ультразвук", "doppler", "допплер"], cost: 90 },
  { subs: ["biokimyo", "биохими"], cost: 90 },
  { subs: ["spirometr", "спиромет"], cost: 70 },
  { words: ["рг"], subs: ["rentgen", "рентген", "x.?ray"], cost: 60 },
  { words: ["ekg", "ecg", "экг"], subs: ["elektrokardio", "электрокардио"], cost: 30 },
  { subs: ["siydik", "моч[аи]", "umumiy qon", "общий анализ крови"], cost: 30 },
];

const COMPILED_HINTS = COST_HINTS.map((h) => {
  const parts = [
    ...(h.words ?? []).map((w) => `${WB_START}(?:${w})${WB_END}`),
    ...(h.subs ?? []),
  ];
  return { re: new RegExp(parts.join("|"), "iu"), cost: h.cost };
});

/** Solishtirish uchun normal ko'rinish (apostrof/registr/ortiqcha bo'shliq). */
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[ʻʼ'`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_NAME = new Map<string, TestDef>();
for (const d of TEST_CATALOG) {
  BY_NAME.set(norm(d.uz), d);
  BY_NAME.set(norm(d.ru), d);
}

/** Tekshiruv narxi (ming so'm): katalog → nomdan taxmin → sukut. */
export function costOf(name: string): number {
  const key = norm(name);
  const hit = BY_NAME.get(key);
  if (hit) return hit.cost;
  for (const h of COMPILED_HINTS) if (h.re.test(key)) return h.cost;
  return DEFAULT_COST;
}

/** Talaba tilida katalog (UI shu ro'yxatni chizadi — narx bilan). */
export function catalogFor(lang: "uz" | "ru") {
  return TEST_CATALOG.map((d) => ({ name: lang === "ru" ? d.ru : d.uz, group: d.group, cost: d.cost }));
}

/** "Oqilona" byudjet chegarasi — undan oshsa UI ogohlantiradi (qat'iy qulf EMAS:
 *  ba'zi holatda qimmat tekshiruv haqiqatan shart. Baho yakunda beriladi). */
export const BUDGET_SOFT = 350;
