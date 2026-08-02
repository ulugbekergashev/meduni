import type { DigestJson, DigestSection } from "../types";

export const PODCAST_PROMPT_VERSION = 1;

const langLabel = { uz: "oʻzbek (lotin)", ru: "rus" } as const;

/**
 * NotebookLM uslubidagi audio-podkast (buyurtmachi 2026-08-02: "аудиоподкаст…
 * где-то 20 минут… чтобы полностью раскрыть тему").
 *
 * ⚠️ ARXITEKTURA QARORI: butun 20 daqiqalik ssenariy BITTA chaqiruvda
 * so'ralmaydi. Sabab: (1) bitta javobda ~3000 soʻz — chiqish limitiga urилиб
 * yarim yoʻlda kesiladi; (2) model uzun matnda oxirgi boʻlimlarni yuzaki
 * oʻtib ketadi. Shuning uchun HAR BOʻLIM uchun alohida chaqiruv qilinadi —
 * "toʻliq ochish" strukturaviy kafolat boʻladi, davomiylik esa boʻlimlar
 * soniga qarab taqsimlanadi.
 */
export function podcastSystemPrompt(lang: "uz" | "ru"): string {
  return [
    "Sen tibbiyot universiteti uchun audio-podkast (NotebookLM Deep Dive uslubi) ssenariysini yozadigan tajribali metodistsan.",
    "",
    "FORMAT: IKKI ovozli jonli suhbat.",
    "- `host` — boshlovchi: qiziqadi, aniqlovchi savol beradi, murakkab joyni sodda tilga qaytaradi, qisqa xulosa qiladi. Replikalari QISQA (1-2 jumla).",
    "- `expert` — mutaxassis oʻqituvchi: chuqur va tartibli tushuntiradi. Replikalari UZUN (4-7 jumla).",
    "- Suhbat TABIIY boʻlsin: 'Ha, aynan shunday', 'Yaxshi savol', 'Buni misolda koʻraylik' kabi jonli oʻtishlar. Lekin suvsiz — har replika yangi maʼlumot beradi.",
    "",
    "SIFAT — ENG MUHIM:",
    "- Konspektni OʻQIB BERMA. Uni TUSHUNTIR: nima, nega muhim, qanday ishlaydi, klinik ahamiyati, xatoga yoʻl qoʻyiladigan joylar, sodda analogiya.",
    "- Har atama birinchi marta uchraganda ochib berilsin (atama — nima degani).",
    "- Raqam/doza aytilsa, u AYNAN konspektdagidek boʻlsin.",
    "",
    "QATʼIY:",
    "- FAQAT berilgan konspekt boʻlimidagi maʼlumot. Oʻzingdan tibbiy fakt, doza yoki protokol QOʻSHMA.",
    `- TIL — ${langLabel[lang]}. Butun matn faqat shu tilda. Xalqaro qisqartmalar (EKG, AV, in situ) oʻz holicha qolishi mumkin.`,
    "- Matn OGʻZAKI oʻqish uchun: qavs, markdown, roʻyxat belgilari, '1)' kabi raqamlash ISHLATILMAYDI. Faqat tinish belgilari bilan tabiiy jumlalar.",
    "- Javobni FAQAT JSON schema boʻyicha ber.",
  ].join("\n");
}

function sectionText(s: DigestSection): string {
  const out: string[] = [];
  for (const b of s.blocks ?? []) {
    if (b.type === "para") out.push(b.text);
    else if (b.type === "callout") out.push(`[${b.tone === "warning" ? "OGOHLANTIRISH" : "MUHIM"}] ${b.text}`);
    else if (b.type === "list") out.push(...b.items.map((it) => `- ${it.lead ? `${it.lead}: ` : ""}${it.text}`));
  }
  return out.join("\n");
}

export interface PodcastChapterInput {
  topicTitle: string;
  section: DigestSection;
  index: number;
  total: number;
  /** Shu bob uchun mo'ljallangan so'z soni (davomiylik shundan chiqadi). */
  targetWords: number;
  /** Umumiy kontekst — atamalar/dozalar takroran ixtiro qilinmasin. */
  digest: DigestJson;
  /**
   * ⚠️ MUHIM: shu bobga eng mos MANBA parchalari (o'qituvchi yuklagan fayldan).
   *
   * Konspekt qisqa (o'lchandi: 120-310 so'z) — undan 20 daqiqalik podkast
   * yasashga urinish modelni FAKT O'YLAB TOPISHGA majbur qilardi (§6: "AI faqat
   * yuklangan materialdan"). Shuning uchun har bob o'z manba parchalari bilan
   * birga beriladi: hajm materialdan keladi, konspekt esa STRUKTURA bo'ladi.
   */
  sourceExcerpts: string[];
  isFirst: boolean;
  isLast: boolean;
}

export function podcastChapterUserContent(inp: PodcastChapterInput): string {
  const { section, index, total, targetWords, digest } = inp;
  const parts = [
    `MAVZU: ${inp.topicTitle}`,
    `BOB: ${index + 1}/${total} — "${section.title}"`,
    "",
    "=== BOB REJASI (konspektdan — STRUKTURA shu) ===",
    sectionText(section) || "(matn yoʻq)",
    "",
  ];

  const excerpts = (inp.sourceExcerpts ?? []).filter(Boolean);
  if (excerpts.length) {
    parts.push(
      "=== MANBA MATNI (oʻqituvchi yuklagan fayldan — TAFSILOT shundan olinadi) ===",
      excerpts.join("\n---\n"),
      "",
      "⚠️ Suhbat mazmuni FAQAT yuqoridagi ikki blokdan chiqsin. Manba matnida",
      "boʻlmagan raqam, doza, statistika yoki protokolni AYTMA. Agar hajm yetmasa,",
      "borini CHUQURROQ tushuntir (misol, analogiya, savol-javob) — lekin yangi",
      "tibbiy fakt QOʻSHMA.",
      ""
    );
  }

  const terms = (digest.terms ?? []).slice(0, 12);
  if (terms.length) {
    parts.push(
      "=== ATAMALAR (kerak boʻlsa toʻgʻri nomlash uchun) ===",
      terms.map((t) => `- ${t.ru} = ${t.uz}${t.lat ? ` (${t.lat})` : ""}`).join("\n"),
      ""
    );
  }
  if (inp.isLast && (digest.dosages ?? []).length) {
    parts.push("=== DOZALAR (yakunda takrorlash uchun, AYNAN shunday) ===", digest.dosages.map((d) => `- ${d}`).join("\n"), "");
  }

  parts.push(
    "=== VAZIFA ===",
    `Shu bob uchun suhbat yoz. Jami hajm — taxminan ${targetWords} soʻz (bu ~${Math.round(targetWords / 135)} daqiqalik ovoz).`,
    "Replikalar soni 6-10 ta, host va expert NAVBATMA-NAVBAT (host bilan boshlanadi).",
    inp.isFirst
      ? "Bu BIRINCHI bob: eng boshida host podkastni qisqa tanishtiradi (mavzu nomi va nega muhimligi), keyin suhbatga oʻtiladi."
      : "Bu bob oldingisining davomi: boshida host oldingi bobga qisqa koʻprik tashlaydi ('Xoʻsh, endi...').",
    inp.isLast
      ? "Bu OXIRGI bob: yakunida expert 3-4 ta asosiy xulosani sanab oʻtadi va host podkastni yopadi."
      : "",
    "=== TUGADI ==="
  );
  return parts.filter(Boolean).join("\n");
}
