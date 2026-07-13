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

// ---------- Presentation slides ----------

export const SLIDE_LAYOUTS = ["TITLE", "TWO_BLOCK", "THREE_BLOCK", "BODY_DIAGRAM", "IMAGE_LEFT", "BULLETS"] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];
export type SlotStatus = "PENDING" | "PROCESSING" | "DONE" | "ERROR";

export interface ImageSlot {
  prompt: string;
  url: string | null;
  status: SlotStatus;
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  title: string;
  bullets: string[];
  speakerNotes: string;
  imageSlots: ImageSlot[];
}

// What Gemini returns (one image prompt per slide; empty => no image).
export const slideGenSchema = z.object({
  layout: z.enum(SLIDE_LAYOUTS),
  title: z.string(),
  bullets: z.array(z.string()),
  speakerNotes: z.string(),
  imagePrompt: z.string(),
});
export const slidesGenSchema = z.object({ slides: z.array(slideGenSchema) });
export type SlidesGen = z.infer<typeof slidesGenSchema>;

// ---------- Factcheck ----------

export const factcheckFlagSchema = z.object({
  claim: z.string(),
  location: z.string(),
  severity: z.enum(["high", "medium", "low"]),
});
export const factcheckGenSchema = z.object({ flags: z.array(factcheckFlagSchema) });
export type FactcheckGen = z.infer<typeof factcheckGenSchema>;

export interface FactcheckFlag {
  claim: string;
  location: string;
  severity: "high" | "medium" | "low";
  resolved: boolean;
  resolution: "confirmed" | "fixed" | null;
}

export const factcheckResponseSchema = {
  type: Type.OBJECT,
  properties: {
    flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING },
          location: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ["high", "medium", "low"] },
        },
        required: ["claim", "location", "severity"],
      },
    },
  },
  required: ["flags"],
};

// ---------- Video script ----------

export const scriptSegmentSchema = z.object({
  slideIndex: z.number().int(),
  narration: z.string(),
});
export const videoScriptGenSchema = z.object({ segments: z.array(scriptSegmentSchema) });
export type VideoScriptGen = z.infer<typeof videoScriptGenSchema>;

// NotebookLM-style lecture video: a segment is narration + a key-visual card
// (NOT a slide readout). Kinds map to frame templates in the renderer.
export const VIDEO_VISUAL_KINDS = ["title", "points", "term", "warning"] as const;
export type VideoVisualKind = (typeof VIDEO_VISUAL_KINDS)[number];

export interface VideoVisual {
  kind: VideoVisualKind;
  title: string;
  points: string[];
}

export interface ScriptSegment {
  /** Legacy (slide-narration videos); new lecture segments use `visual`. */
  slideIndex?: number;
  narration: string;
  durationSec: number;
  visual?: VideoVisual;
  /** Cached Nano Banana illustration for this segment's card (set at render, reused on rebuild). */
  visualImageUrl?: string | null;
}

const videoVisualSchema = z.object({
  kind: z.enum(VIDEO_VISUAL_KINDS),
  title: z.string(),
  points: z.array(z.string()),
});
export const lectureSegmentSchema = z.object({
  narration: z.string(),
  visual: videoVisualSchema,
});
export const lectureScriptGenSchema = z.object({ segments: z.array(lectureSegmentSchema) });
export type LectureScriptGen = z.infer<typeof lectureScriptGenSchema>;

export const videoScriptResponseSchema = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          narration: { type: Type.STRING },
          visual: {
            type: Type.OBJECT,
            properties: {
              kind: { type: Type.STRING, enum: VIDEO_VISUAL_KINDS as unknown as string[] },
              title: { type: Type.STRING },
              points: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["kind", "title", "points"],
          },
        },
        required: ["narration", "visual"],
      },
    },
  },
  required: ["segments"],
};

export const slidesResponseSchema = {
  type: Type.OBJECT,
  properties: {
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          layout: { type: Type.STRING, enum: SLIDE_LAYOUTS as unknown as string[] },
          title: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
          speakerNotes: { type: Type.STRING },
          imagePrompt: { type: Type.STRING },
        },
        required: ["layout", "title", "bullets", "speakerNotes", "imagePrompt"],
      },
    },
  },
  required: ["slides"],
};
