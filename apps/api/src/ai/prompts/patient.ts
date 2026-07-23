// Virtual bemor roleplay (Modul 26). AI klinik keys asosidagi bemor rolini
// o'ynaydi; talaba shifokor sifatida anamnez yig'adi. Yakunda AI baholaydi.
// Biznes qoida (CLAUDE.md §6): AI keysда YO'Q faktni ixtiro qilmaydi.
import { Type } from "@google/genai";
import type { CaseJson } from "../types";

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

// ---------- Baholash ----------

export function evalSystemPrompt(lang: "uz" | "ru", c: CaseJson): string {
  return [
    "Sen tibbiyot o'qituvchisisan. Talaba virtual bemor bilan suhbat o'tkazdi",
    "(anamnez yig'di) va tashxis taklif qildi. Uni ADOLATLI baholaysan.",
    "",
    "Baholash mezoni:",
    "1. Tashxis to'g'rimi — talabaning taxminи keysдаги haqiqiy tashxisga mos keladimi.",
    "2. Anamnez sifati (0–100) — muhim savollarni berdimi (shikoyat tafsiloti,",
    "   boshlanish vaqti, kuchayish, o'tган kasalliklar, tekshiruv/analiz buyurishi).",
    "3. Muloqot (0–100) — savollar mantiqiy ketma-ketlikda, aniq va hurmatли bo'lдими.",
    "4. Umumiy ball (0–100).",
    "strengths — talaba nimani yaxshi qildi (1–2 jumla).",
    "improvements — nimani o'tkazib yubordi / yaxshилаши kerak (1–2 jumla).",
    "diagnosis — keysдаги TO'G'RI tashxis (qisqa).",
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
    communicationScore: { type: Type.INTEGER },
    overallScore: { type: Type.INTEGER },
    strengths: { type: Type.STRING },
    improvements: { type: Type.STRING },
  },
  required: ["diagnosis", "correct", "anamnesisScore", "communicationScore", "overallScore", "strengths", "improvements"],
};
