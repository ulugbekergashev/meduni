/**
 * Konspekt renderlari uchun UMUMIY (rolga bog'liq bo'lmagan) tiplar.
 *
 * `DigestView` / `BlockView` / `TermTooltip` ikkala tomonda ham ishlatiladi:
 * talaba o'qiydi (`pages/student/api.ts::DigestJson`), o'qituvchi esa tasdiqlashdan
 * OLDIN aynan shu ko'rinishda ko'radi (`pages/teach/topics/api.ts::DigestJson`).
 * Ikkala tip strukturaviy jihatdan mos — shuning uchun renderlar rol api'sidan
 * emas, shu yerdan tip oladi (§5 "modullar bir-birini bilmaydi").
 */

export interface Term {
  ru: string;
  uz: string;
  lat: string;
}

export type DigestBlock =
  | { type: "para"; text: string }
  | { type: "callout"; tone: "important" | "warning"; text: string }
  | { type: "list"; ordered: boolean; items: { lead?: string; text: string }[] };

/** `DigestView` ko'rsatadigan minimal maydonlar (ikkala rolning DigestJson'i mos keladi). */
export interface DigestLike {
  objectives: string[];
  concepts: string[];
  terms: Term[];
  facts: string[];
  dosages: string[];
}
