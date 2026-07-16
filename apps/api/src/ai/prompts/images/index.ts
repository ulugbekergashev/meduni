import type { Slide, SlideLayout, VideoVisual } from "../../types";

// Style guidance appended to every image prompt. Goal: not a decorative picture
// but a *teaching diagram* — a labeled, textbook-quality medical illustration
// that explains the content at a glance (better than a generic stock image).
//
// NOTE on labels: image models render non-Latin (Cyrillic/Uzbek) text unreliably
// when many labels are crammed in — they start to misspell. So we deliberately ask
// for FEW, SHORT, correctly-spelled labels rather than a densely annotated diagram.
const BASE_STYLE = [
  "Style: detailed educational medical diagram in a clean flat-vector textbook-atlas style (like a modern medical illustration atlas, not a photo).",
  "It must EXPLAIN, not merely decorate: accurate anatomical/physiological structures with thin leader lines pointing to the few most important parts.",
  "Composition: organized and uncluttered, generous white space, soft neutral off-white background, indigo (#4F46E5) as the primary accent; use color coding meaningfully (e.g. blue = deoxygenated, red = oxygenated).",
  "Accuracy: medically correct proportions and relationships; no invented structures, no gore, no photorealism, no watermark, no logo.",
  "High resolution, 16:9 aspect ratio.",
].join(" ");

// Strong spelling guardrail: fewer, correct labels beat many garbled ones.
const langInstruction = {
  uz: "Write at most 4-5 short labels, in Uzbek (Latin script), each only 1-2 words. Spell every label correctly; if unsure of a spelling, omit that label rather than misspell it. Do not crowd the image with text.",
  ru: "Write at most 4-5 short labels, in Russian, each only 1-2 words. Spell every label correctly; if unsure of a spelling, omit that label rather than misspell it. Do not crowd the image with text.",
} as const;

const layoutHint: Record<SlideLayout, string> = {
  TITLE: "Layout: a clear hero diagram introducing the topic, main structure centered, a few principal parts labeled.",
  TWO_BLOCK: "Layout: a side-by-side comparison split into two clearly labeled panels, each with its own small illustration.",
  THREE_BLOCK: "Layout: a three-column infographic; each column a distinct category with its own icon/illustration and one short label.",
  BODY_DIAGRAM: "Layout: a large anatomical cross-section with a few leader-line callouts to the key structures.",
  IMAGE_LEFT: "Layout: a single focused, cleanly labeled illustration of the main concept.",
  BULLETS: "Layout: a simple supporting labeled illustration or icon set.",
};

/**
 * Build the Nano Banana Pro prompt for a slide's image slot. We feed a few of the
 * slide's bullet points as label hints so the diagram teaches the same content.
 */
export function imagePromptForSlide(slide: Slide, basePrompt: string, lang: "uz" | "ru"): string {
  const labelHints = (slide.bullets ?? []).map((b) => b.trim()).filter(Boolean).slice(0, 4);
  const parts = [
    `Create a clean, focused medical teaching diagram for a lecture slide titled "${slide.title}".`,
    basePrompt ? `What to draw: ${basePrompt}` : "",
    labelHints.length
      ? `Convey these ideas visually (turn only the key nouns into short labels): ${labelHints.map((h) => `"${h}"`).join(", ")}.`
      : "",
    layoutHint[slide.layout],
    langInstruction[lang],
    BASE_STYLE,
  ];
  return parts.filter(Boolean).join(" ");
}

/**
 * Build a Nano Banana Pro prompt for a NotebookLM-style lecture video card — a
 * focused, self-explanatory diagram of this single teaching beat, shown large.
 */
export function imagePromptForVisual(visual: VideoVisual, lang: "uz" | "ru"): string {
  const hints = (visual.points ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 3);
  return [
    `Create ONE clean, focused medical teaching diagram illustrating "${visual.title}".`,
    hints.length ? `Convey these ideas visually: ${hints.map((h) => `"${h}"`).join(", ")}.` : "",
    "Keep it simple and legible: one central illustration with only a few short callout labels on the most important structures. Do NOT draw a title/heading inside the image and do not crowd it with text.",
    langInstruction[lang],
    BASE_STYLE,
  ]
    .filter(Boolean)
    .join(" ");
}
