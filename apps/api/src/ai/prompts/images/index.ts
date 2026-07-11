import type { Slide, SlideLayout } from "../../types";

// Style guidance appended to every image prompt so the output looks like the
// clean, labeled medical infographics in the reference designs (NotebookLM-style).
const BASE_STYLE = [
  "Clean modern educational medical infographic, flat vector illustration style.",
  "Plenty of white space, soft neutral background, teal (#0F9E8E) accent color.",
  "Accurate medical/anatomical detail. No photorealism, no gore, no clutter.",
  "Crisp, legible labels. High resolution, 16:9.",
].join(" ");

const langInstruction = { uz: "Any labels in Uzbek (Latin script).", ru: "Any labels in Russian." } as const;

const layoutHint: Record<SlideLayout, string> = {
  TITLE: "A striking hero illustration representing the topic.",
  TWO_BLOCK: "A two-panel comparison diagram, clearly split into two labeled blocks.",
  THREE_BLOCK: "A three-column matrix infographic with three distinct labeled categories.",
  BODY_DIAGRAM: "An anatomical body/organ diagram with callout labels pointing to key structures.",
  IMAGE_LEFT: "A single focused illustration suitable for placing beside text.",
  BULLETS: "A simple supporting icon-style illustration.",
};

/** Build the final Nano Banana Pro prompt for a slide's image slot. */
export function imagePromptForSlide(slide: Slide, basePrompt: string, lang: "uz" | "ru"): string {
  return [
    basePrompt || slide.title,
    `Slide title: "${slide.title}".`,
    layoutHint[slide.layout],
    langInstruction[lang],
    BASE_STYLE,
  ].join(" ");
}
