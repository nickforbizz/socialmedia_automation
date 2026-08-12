import { z } from "zod";

export const VISION_ANALYSIS_PROMPT_VERSION = 1;

/** Structured factual analysis extracted from frames/images by a vision model. */
export const visionAnalysisSchema = z.object({
  description: z.string(),
  objects: z.array(z.string()).max(30).default([]),
  has_people: z.boolean().default(false),
  category: z.string().nullable().default(null),
  mood: z.string().nullable().default(null),
  keywords: z.array(z.string()).max(20).default([]),
  on_screen_text: z.string().nullable().default(null),
  quality_score: z.number().min(0).max(100).nullable().default(null),
});

export type VisionAnalysisResult = z.infer<typeof visionAnalysisSchema>;

export function buildVisionAnalysisPrompt(fileName: string, folderLabel?: string | null): string {
  return [
    "You are analyzing frames from a single social media clip or image.",
    folderLabel ? `Topic hint: ${folderLabel}.` : "",
    `File: ${fileName}.`,
    "Return ONLY valid JSON (no markdown) with this shape:",
    JSON.stringify(
      {
        description: "one or two sentences describing what is shown",
        objects: ["notable object or subject"],
        has_people: true,
        category: "e.g. beach, drone, food, city",
        mood: "e.g. relaxed, energetic, dramatic",
        keywords: ["searchable keyword"],
        on_screen_text: "any visible text, or null",
        quality_score: 0,
      },
      null,
      0,
    ),
    "quality_score is 0-100 judging visual quality (lighting, composition, sharpness).",
  ]
    .filter(Boolean)
    .join(" ");
}
