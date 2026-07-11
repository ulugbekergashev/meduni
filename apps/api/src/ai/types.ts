import { Type } from "@google/genai";
import { z } from "zod";

export const termSchema = z.object({
  ru: z.string(),
  uz: z.string(),
  lat: z.string(),
});

export const digestSchema = z.object({
  objectives: z.array(z.string()),
  concepts: z.array(z.string()),
  terms: z.array(termSchema),
  facts: z.array(z.string()),
  dosages: z.array(z.string()),
  imageIdeas: z.array(z.string()),
});

export type DigestJson = z.infer<typeof digestSchema>;

// Gemini responseSchema mirroring digestSchema (structured JSON output).
export const digestResponseSchema = {
  type: Type.OBJECT,
  properties: {
    objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
    concepts: { type: Type.ARRAY, items: { type: Type.STRING } },
    terms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ru: { type: Type.STRING },
          uz: { type: Type.STRING },
          lat: { type: Type.STRING },
        },
        required: ["ru", "uz", "lat"],
      },
    },
    facts: { type: Type.ARRAY, items: { type: Type.STRING } },
    dosages: { type: Type.ARRAY, items: { type: Type.STRING } },
    imageIdeas: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["objectives", "concepts", "terms", "facts", "dosages", "imageIdeas"],
};

export const emptyDigest: DigestJson = {
  objectives: [],
  concepts: [],
  terms: [],
  facts: [],
  dosages: [],
  imageIdeas: [],
};
