import type { Slide, SlideLayout, VideoVisual } from "../../types";

// Style guidance appended to every image prompt. Goal: not a decorative picture
// but a *teaching diagram* — a labeled, textbook-quality medical illustration
// that explains the slide content at a glance (better than a generic stock image).
const BASE_STYLE = [
  "Style: detailed educational medical diagram in a clean flat-vector textbook-atlas style (like a modern medical illustration atlas, not a photo).",
  "It must EXPLAIN, not merely decorate: include accurate anatomical/physiological structures, callout lines pointing to the key parts, and clear short text labels next to each part.",
  "Composition: organized and uncluttered, generous white space, soft neutral off-white background, teal (#0F9E8E) as the primary accent with restrained supporting colors; use color coding meaningfully (e.g. blue = deoxygenated, red = oxygenated).",
  "Accuracy: medically correct proportions and relationships; no invented structures, no gore, no photorealism, no watermark, no logo.",
  "Typography: crisp, legible, correctly spelled labels; high resolution; 16:9 aspect ratio.",
].join(" ");

const langInstruction = {
  uz: "All labels and captions in Uzbek (Latin script), spelled correctly.",
  ru: "All labels and captions in Russian, spelled correctly.",
} as const;

const layoutHint: Record<SlideLayout, string> = {
  TITLE: "Layout: a clear hero diagram that visually introduces the whole topic, with the main structure centered and its principal parts labeled.",
  TWO_BLOCK: "Layout: a side-by-side comparison diagram split into two clearly labeled panels, each with its own small illustration and labels so the two are easy to contrast.",
  THREE_BLOCK: "Layout: a three-column infographic; each column is a distinct labeled category with its own icon/illustration and short labels.",
  BODY_DIAGRAM: "Layout: a large anatomical body/organ cross-section diagram with numbered or lined callout labels pointing to each key structure.",
  IMAGE_LEFT: "Layout: a single focused, well-labeled illustration of the main concept, framed to sit on the left beside text.",
  BULLETS: "Layout: a simple supporting labeled illustration or icon set that reinforces the listed points.",
};

/**
 * Build the final Nano Banana Pro prompt for a slide's image slot.
 * We feed the slide's own bullet points in as label hints so the generated
 * diagram teaches the exact same content the slide presents.
 */
export function imagePromptForSlide(slide: Slide, basePrompt: string, lang: "uz" | "ru"): string {
  const labelHints = (slide.bullets ?? [])
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 6);
  const parts = [
    `Create a labeled medical teaching diagram for a lecture slide titled "${slide.title}".`,
    basePrompt ? `What to draw: ${basePrompt}` : "",
    labelHints.length
      ? `The diagram should visually convey and label these teaching points: ${labelHints.map((h) => `"${h}"`).join(", ")}.`
      : "",
    layoutHint[slide.layout],
    langInstruction[lang],
    BASE_STYLE,
  ];
  return parts.filter(Boolean).join(" ");
}

/**
 * Build a Nano Banana Pro prompt for a NotebookLM-style lecture video card.
 * The illustration sits beside the narration text, so it must be a focused,
 * self-explanatory diagram of this single teaching beat.
 */
export function imagePromptForVisual(visual: VideoVisual, lang: "uz" | "ru"): string {
  const hints = (visual.points ?? [])
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 4);
  return [
    `Create a single focused, labeled medical teaching illustration about "${visual.title}".`,
    hints.length ? `It should visually explain and label: ${hints.map((h) => `"${h}"`).join(", ")}.` : "",
    "Layout: one clear diagram centered and filling the frame with minimal empty margin, with callout labels on the parts. Do NOT draw a big title/heading inside the image — only the diagram and its part labels (a caption strip already surrounds it).",
    langInstruction[lang],
    BASE_STYLE,
  ]
    .filter(Boolean)
    .join(" ");
}
