// Virtual bemor roleplay (Modul 26). AI klinik keys asosidagi bemor rolini
// o'ynaydi; talaba shifokor sifatida anamnez yig'adi. Yakunda AI baholaydi.
// Biznes qoida (CLAUDE.md §6): AI keysда YO'Q faktni ixtiro qilmaydi.
import { Type } from "@google/genai";
import type { CaseJson, DigestJson } from "../types";

export const PATIENT_PROMPT_VERSION = 1;

const langLabel = { uz: "oʻzbek (lotin)", ru: "rus" } as const;

/** Bemorning "yashirin haqiqati" — keysдан (talabaga to'g'ridan ko'rsatilmaydi). */
function caseTruth(c: CaseJson): string {
  const lines: string[] = [];
  if (c.patientName) lines.push(`Bemor: ${c.patientName}`);
  if (c.patientInfo) lines.push(`Yosh/jins: ${c.patientInfo}`);
  if (c.complaints) lines.push(`SHIKOYATLAR: ${c.complaints}`);
  if (c.anamnesis) lines.push(`ANAMNEZ: ${c.anamnesis}`);
  if (c.objectiveStatus) lines.push(`OBYEKTIV HOLAT (tekshirilганда): ${c.objectiveStatus}`);
  if (c.labData) lines.push(`LABORATORIYA/INSTRUMENTAL (buyurtirilganда): ${c.labData}`);
  if (c.vitals) {
    const v = c.vitals;
    const vs = [v.bp && `AB ${v.bp}`, v.pulse && `puls ${v.pulse}`, v.spo2 && `SpO2 ${v.spo2}`, v.temp && `t ${v.temp}`]
      .filter(Boolean)
      .join(", ");
    if (vs) lines.push(`HAYOTIY KO'RSATKICHLAR: ${vs}`);
  }
  return lines.join("\n");
}

export function patientSystemPrompt(lang: "uz" | "ru", c: CaseJson): string {
  return [
    "Sen tibbiyot ta'limi uchun VIRTUAL BEMOR simulyatorisan. Quyidagi klinik",
    "keys asosidagi bemor rolini o'ynaysan. Talaba — shifokor; u senga savol",
    "beradi (anamnez yig'adi), tekshiradi va tashxis qo'yishga harakat qiladi.",
    "",
    "QAT'IY QOIDALAR:",
    "1. Bemor sifatida BIRINCHI SHAXSDA gapirasan (\"menda...\", \"meni...\").",
    "2. FAQAT quyidagi keysда berilgan ma'lumotni ishlatasan. Keysда YO'Q",
    "   simptom, kasallik yoki tafsilotni O'YLAB TOPMAYSAN. Agar talaba keysда",
    "   yo'q narsani so'rasa — oddiy bemor kabi \"bilmayman\" yoki \"yo'q\" deb javob ber.",
    "3. Sen ODDIY BEMORSAN — tibbiy atama ishlatmaysan va TASHXISNI AYTMAYSAN.",
    "   Shikoyatларни kundalik til bilan tasvirlaysan.",
    "4. Subyektiv ma'lumotni (shikoyat, anamnez) savolga javoban beradsan.",
    "5. OBYEKTIV holat va laboratoriya natijalarini FAQAT talaba seni",
    "   TEKSHIRSA yoki analiz/tekshiruv BUYURSA berasan — o'shanда ham bemor",
    "   tilida emas, qisqa klinik eslatma sifatida (masalan: \"[Tekshiruvда: ...]\").",
    "6. Har javob QISQA (1–3 jumla). Suhbatni sun'iy cho'zmaysan.",
    `7. Til — ${langLabel[lang]}.`,
    "8. Javobni FAQAT JSON schema bo'yicha qaytar ({\"reply\": \"...\"}).",
    // Modul 28 — o'qituvchi ssenariysi. Bazaviy xavfsizlik qoidalari (keysда
    // yo'q faktni to'qimaslik, tashxisni aytmaslik) BARIBIR USTUVOR.
    ...(c.patientBehavior?.trim()
      ? [
          "",
          "O'QITUVCHI QO'SHIMCHA QOIDALARI (yuqoridagi xavfsizlik qoidalariga zid kelmasa, ularga qat'iy amal qil):",
          c.patientBehavior.trim(),
        ]
      : []),
    "",
    "=== BEMOR HAQIDAGI YASHIRIN MA'LUMOT (talabaga oshkor qilma) ===",
    caseTruth(c),
    "=== TUGADI ===",
  ].join("\n");
}

export function patientUserContent(history: { role: string; text: string }[], question: string): string {
  const lines: string[] = [];
  if (history.length) {
    lines.push("SUHBAT (eski → yangi):");
    for (const m of history) lines.push(`${m.role === "student" ? "SHIFOKOR" : "BEMOR"}: ${m.text}`);
    lines.push("");
  }
  lines.push("SHIFOKORNING YANGI GAPI:", question);
  return lines.join("\n");
}

export const patientResponseSchema = {
  type: Type.OBJECT,
  properties: { reply: { type: Type.STRING } },
  required: ["reply"],
};

// ---------- Bemor SSENARIYSI generatsiyasi (keys yo'q — konspektdan, XILMA-XIL) ----------
// Har safar boshqacha bemor: parametrlar (yosh/jins/og'irlik/atipiklik) turlanadi;
// konspekt bir necha holatni qamrasa — tashxis ham. Klinik FAKTLAR faqat konspektdan.

/** Diversifikatsiya o'qlari — har generatsiyaда tasodifan bittasi tanlanadi. */
export const SCENARIO_VARIATIONS = {
  uz: [
    "yosh bemor (18–30 yosh), tipik ko'rinish",
    "o'rta yosh bemor (35–55), tipik ko'rinish",
    "keksa bemor (60+), hamroh holat bilan",
    "ATIPIK/yashirin ko'rinish (tashxis qiyinroq)",
    "o'tkir, og'ir bosqich",
    "yengil yoki erta bosqich",
    "ayol bemor, o'ziga xos parametrlar",
    "erkak bemor, o'ziga xos parametrlar",
  ],
  ru: [
    "молодой пациент (18–30), типичная картина",
    "средний возраст (35–55), типичная картина",
    "пожилой пациент (60+), с сопутствующим состоянием",
    "АТИПИЧНАЯ/стёртая картина (диагноз сложнее)",
    "острая, тяжёлая стадия",
    "лёгкая или ранняя стадия",
    "пациентка, свои параметры",
    "пациент-мужчина, свои параметры",
  ],
} as const;

export function patientScenarioSystemPrompt(lang: "uz" | "ru"): string {
  return [
    "Sen tibbiy ta'lim uchun VIRTUAL BEMOR (AMALIYOT — baholanmaydigan mashq) ssenariysini yaratuvchi assistentsan.",
    "Berilgan MAVZU KONSPEKTI asosida roleplay uchun bitta realistik bemor 'haqiqatini' tuzasan.",
    "",
    "QOIDALAR:",
    "1. TASHXIS mavzu/konspekt DOIRASIDA bo'lsin (mavzu qamragan kasalliklardan) —",
    "   mavzuga aloqasiz kasallik tanlama.",
    "2. Klinik DETALLARNI (vitallar, laboratoriya qiymatlari, tekshiruv topilmalari, obyektiv",
    "   holat) realistik va tashxisga IZCHIL to'ldir: konspektда bor bo'lsa o'shandan, aks",
    "   holda STANDART tibbiy bilimдан (referens me'yorlar bilan). Bu — amaliyot bemori,",
    "   shuning uchun klinik detal to'liq va realistik bo'lsin (raqamlar mantiqiy).",
    "3. Bemor 'qobig'ini' MASHQ UCHUN XILMA-XIL qil: realistik ism, yosh, jins, og'irlik",
    "   darajasi, tipik yoki atipik ko'rinish. Bu qism har safar boshqacha bo'lsin.",
    "4. Agar konspekt BIR NECHA holat/kasallikni qamrasa — ulardан BIRINI tanla (tashxis",
    "   turlanadi — differensial mashq). Bitta kasallik bo'lsa — tashxis o'sha, ko'rinishi turlanadi.",
    "5. `complaints`/`anamnesis` — bemor tilida (subyektiv). `objectiveStatus`/`labData` —",
    "   tekshiruvда chiqadigan obyektiv topilmalar. `vitals` — realistik hayotiy ko'rsatkichlar.",
    "6. `referenceAnswer` — TO'G'RI tashxis + qisqa asoslash (BAHOLASH uchun; talabaga",
    "   ko'rsatilmaydi). `patientName` realistik, `patientInfo` — \"NN yosh, jins\".",
    "7. `steps` va `questions` — bo'sh massiv (roleplay uchun kerak emas).",
    `8. Til — ${langLabel[lang]}. Javobni FAQAT JSON schema bo'yicha ber.`,
  ].join("\n");
}

export function patientScenarioUserContent(digest: DigestJson, variation: string): string {
  const parts = [
    "Quyidagi konspekt asosida bitta virtual bemor ssenariysini tuz.",
    "",
    `VARIATSIYA (shu yo'nalishда diversifikatsiya qil): ${variation}`,
    "",
    "=== KONSPEKT ===",
    "MAQSADLAR: " + (digest.objectives?.join("; ") || "—"),
    "TUSHUNCHALAR: " + (digest.concepts?.join("; ") || "—"),
    "FAKTLAR: " + (digest.facts?.join("; ") || "—"),
    "DOZALAR: " + (digest.dosages?.join("; ") || "—"),
    "BO'LIMLAR: " + ((digest.sections ?? []).map((s) => s.title).join("; ") || "—"),
    "=== TUGADI ===",
  ];
  return parts.join("\n");
}

// ---------- Tekshiruv (test) natijasi — buyurtirilgan tahlil/instrumental ----------
// Yashirin tashxisga IZCHIL realistik natija (referens me'yorlar bilan).

export function testResultSystemPrompt(lang: "uz" | "ru"): string {
  return [
    "Sen tibbiy laboratoriya/instrumental natijalar generatorisan (AMALIYOT bemori uchun).",
    "Berilgan bemorning YASHIRIN tashxisiga MOS, realistik qisqa natija berasan.",
    "Referens me'yorlar bilan (masalan: \"Troponin I: 5.2 ng/mL (me'yor <0.04)\").",
    "Natija 2–4 qator, klinik ko'rsatkichlar bilan. Yashirin tashxisni SO'Z bilan aytma —",
    "faqat obyektiv topilmalarни ber (talaba o'zi xulosa qilsin).",
    `Til — ${langLabel[lang]}. Javobni FAQAT JSON schema bo'yicha ber ({\"result\": \"...\"}).`,
  ].join("\n");
}

export function testResultUserContent(c: CaseJson, testType: string): string {
  return [
    "=== BEMOR HAQIDA (yashirin — talabaga ko'rsatilmaydi) ===",
    caseTruth(c),
    "=== TUGADI ===",
    "",
    `BUYURILGAN TEKSHIRUV: ${testType}`,
    "Shu tekshiruv natijasini ber — yashirin tashxisga izchil, realistik.",
  ].join("\n");
}

export const testResultResponseSchema = {
  type: Type.OBJECT,
  properties: { result: { type: Type.STRING } },
  required: ["result"],
};

// ---------- Differensial tashxis (DDx) — MAVJUD dalillar asosida (jonli) ----------
// ⚠️ Yashirin tashxisdан hisoblanMAYDI (aks holda javobни sizdirardi) — faqat
// talaba ochgan dalillardan (suhbat + test natijalari).

export interface DDxItem {
  diagnosis: string;
  probability: number;
  keyFinding: string;
}

export function ddxSystemPrompt(lang: "uz" | "ru"): string {
  return [
    "Sen klinik diagnostika eksperti-yordamchisan. Talabaning virtual bemor bilan suhbati",
    "va buyurgan tekshiruv natijalari asosida 3–4 ta eng ehtimoliy DIFFERENSIAL TASHXISNI",
    "foizда baholaysan (yig'indi ~100%). Har biriga qisqa 'kalit topilma' (nega shu tashxis).",
    "MUHIM: FAQAT talaba ochgan dalillarga asoslan (suhbat + test natijalari). Bemorning",
    "asl javobini bilmaysan — ehtimollikni faqat mavjud ma'lumotдан chiqar (real differensial).",
    `Til — ${langLabel[lang]}. Javobni FAQAT JSON schema bo'yicha ber.`,
  ].join("\n");
}

export function ddxUserContent(
  patientBasics: string,
  history: { role: string; text: string }[],
  tests: string[]
): string {
  const conv = history.map((m) => `${m.role === "student" ? "SHIFOKOR" : "BEMOR"}: ${m.text}`).join("\n");
  return [
    `BEMOR: ${patientBasics}`,
    "",
    "SUHBAT:",
    conv || "(hali yo'q)",
    "",
    "TEST NATIJALARI:",
    tests.length ? tests.join("\n") : "(hali yo'q)",
    "",
    "Mavjud dalillar asosida 3–4 ta differensial tashxis (foiz + kalit topilma).",
  ].join("\n");
}

export const ddxResponseSchema = {
  type: Type.OBJECT,
  properties: {
    ddx: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          diagnosis: { type: Type.STRING },
          probability: { type: Type.INTEGER },
          keyFinding: { type: Type.STRING },
        },
        required: ["diagnosis", "probability", "keyFinding"],
      },
    },
  },
  required: ["ddx"],
};

// ---------- Baholash ----------

export function evalSystemPrompt(lang: "uz" | "ru", c: CaseJson): string {
  return [
    "Sen tibbiyot o'qituvchisisan. Talaba virtual bemor bilan suhbat o'tkazdi",
    "(anamnez yig'di) va tashxis taklif qildi. Uni ADOLATLI baholaysan.",
    "",
    "Baholash mezoni (har biri 0–100):",
    "1. Tashxis to'g'rimi (correct) — talabaning taxminи haqiqiy tashxisga mos keladimi.",
    "2. anamnesisScore — muhim savollarni berdimi (shikoyat tafsiloti, boshlanish, kuchayish, tarix).",
    "3. examinationScore — obyektiv tekshiruv/analiz/instrumental TO'G'RI buyurdimi (kerakli testlar).",
    "4. treatmentScore — davolash/keyingi qadam rejasi asosli va to'g'rimi (bergan bo'lsa).",
    "5. safetyScore — xavfli holatni ('qizil bayroq') payqadimi, xavfsiz yondashdimi.",
    "6. communicationScore — savollar mantiqiy, aniq va hurmatли bo'lдими.",
    "7. overallScore — umumiy ball (yuqoridagilarning muvozanatli o'rtachasi).",
    "strengths — talaba nimani yaxshi qildi (1–2 jumla).",
    "improvements — nimani o'tkazib yubordi / yaxshилаши kerak (1–2 jumla).",
    "diagnosis — TO'G'RI tashxis (qisqa).",
    `Barcha matn — ${langLabel[lang]} tilida. Javobni FAQAT JSON schema bo'yicha ber.`,
    "",
    "=== KLINIK KEYS (haqiqiy ma'lumot + to'g'ri tashxis shu yerда) ===",
    caseTruth(c),
    c.steps?.length
      ? "QADAMLAR (to'g'ri qaror = correct:true):\n" +
        c.steps
          .map(
            (s, i) =>
              `${i + 1}. ${s.title}: ${s.prompt}\n` +
              s.options.map((o) => `   ${o.correct ? "[TO'G'RI] " : ""}${o.text}`).join("\n")
          )
          .join("\n")
      : "",
    c.referenceAnswer?.length ? "ETALON JAVOBLAR:\n" + c.referenceAnswer.map((r) => `- ${r}`).join("\n") : "",
    "=== TUGADI ===",
  ]
    .filter(Boolean)
    .join("\n");
}

export function evalUserContent(history: { role: string; text: string }[], diagnosis: string): string {
  const lines: string[] = ["SUHBAT (shifokor ↔ bemor):"];
  for (const m of history) lines.push(`${m.role === "student" ? "SHIFOKOR" : "BEMOR"}: ${m.text}`);
  lines.push("", "TALABANING YAKUNIY TASHXISI:", diagnosis || "(tashxis kiritilmadi)");
  return lines.join("\n");
}

export interface PatientEval {
  diagnosis: string;
  correct: boolean;
  anamnesisScore: number;
  examinationScore: number;
  treatmentScore: number;
  safetyScore: number;
  communicationScore: number;
  overallScore: number;
  strengths: string;
  improvements: string;
}

export const evalResponseSchema = {
  type: Type.OBJECT,
  properties: {
    diagnosis: { type: Type.STRING },
    correct: { type: Type.BOOLEAN },
    anamnesisScore: { type: Type.INTEGER },
    examinationScore: { type: Type.INTEGER },
    treatmentScore: { type: Type.INTEGER },
    safetyScore: { type: Type.INTEGER },
    communicationScore: { type: Type.INTEGER },
    overallScore: { type: Type.INTEGER },
    strengths: { type: Type.STRING },
    improvements: { type: Type.STRING },
  },
  required: [
    "diagnosis",
    "correct",
    "anamnesisScore",
    "examinationScore",
    "treatmentScore",
    "safetyScore",
    "communicationScore",
    "overallScore",
    "strengths",
    "improvements",
  ],
};
