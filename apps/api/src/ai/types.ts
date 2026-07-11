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

// ---------- Quiz ----------

export const questionSchema = z.object({
  text: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number().int(),
  explanations: z.array(z.string()),
  difficulty: z.enum(["RECALL", "UNDERSTAND", "APPLY"]),
  sourceFragment: z.string().optional().default(""),
});

export const quizGenSchema = z.object({ questions: z.array(questionSchema) });
export type QuizGen = z.infer<typeof quizGenSchema>;

export const quizResponseSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
          explanations: { type: Type.ARRAY, items: { type: Type.STRING } },
          difficulty: { type: Type.STRING, enum: ["RECALL", "UNDERSTAND", "APPLY"] },
          sourceFragment: { type: Type.STRING },
        },
        required: ["text", "options", "correctIndex", "explanations", "difficulty"],
      },
    },
  },
  required: ["questions"],
};

// ---------- Clinical case ----------

export const caseSchema = z.object({
  complaints: z.string(),
  anamnesis: z.string(),
  objectiveStatus: z.string(),
  labData: z.string(),
  questions: z.array(z.string()),
  referenceAnswer: z.array(z.string()),
});
export type CaseJson = z.infer<typeof caseSchema>;

export const caseResponseSchema = {
  type: Type.OBJECT,
  properties: {
    complaints: { type: Type.STRING },
    anamnesis: { type: Type.STRING },
    objectiveStatus: { type: Type.STRING },
    labData: { type: Type.STRING },
    questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    referenceAnswer: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["complaints", "anamnesis", "objectiveStatus", "labData", "questions", "referenceAnswer"],
};
