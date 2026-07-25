// Matn generatsiyasi umumiy tipi — gemini.ts va providers/openaiText.ts ikkalasi
// ishlatadi (circular importsiz).
export interface GenerateOpts {
  systemInstruction: string;
  userContent: string;
  responseSchema: unknown;
  kind: string;
  topicId?: number;
  departmentId?: number | null;
  userId?: number | null;
  /** Allow the model to "think" for higher-quality output (e.g. lecture scripts). */
  thinking?: boolean;
  /** 3D (xarajat): arzon/past-riskli vazifalar uchun lite modelni OLDINGA qo'yadi
   *  (masalan virtual bemor roleplay navbatlari). Flash/tayyor fallback saqlanadi. */
  preferLite?: boolean;
}
