import { z } from "zod";
import type { ChatMessage } from "@/lib/ai/types";

/**
 * Versioned prompt + strict output contract for AI media intelligence.
 * Bumping the version invalidates cached generations that referenced an older
 * prompt. Keep the schema and the instruction text in lockstep.
 */
export const MEDIA_INTELLIGENCE_PROMPT_VERSION = 1;

export const PLATFORMS = [
  "facebook",
  "instagram",
  "youtube",
  "tiktok",
  "linkedin",
  "x",
] as const;
export type Platform = (typeof PLATFORMS)[number];

/** What the model must return. Validated with Zod before it touches the DB. */
export const mediaIntelligenceSchema = z.object({
  titles: z.array(z.string()).max(8),
  hooks: z.array(z.string()).max(8),
  captions: z.array(z.string()).max(6),
  descriptions: z.array(z.string()).max(4),
  hashtags: z.array(z.string()).max(30),
  ctas: z.array(z.string()).max(6),
  thumbnail_ideas: z.array(z.string()).max(6),
  best_cover_frame_sec: z.number().nonnegative().nullable().default(null),
  target_audience: z.string().nullable().default(null),
  recommended_platforms: z.array(z.enum(PLATFORMS)).max(6),
  engagement_prediction: z
    .record(z.enum(PLATFORMS), z.enum(["low", "medium", "high"]))
    .default({}),
});

export type MediaIntelligenceResult = z.infer<typeof mediaIntelligenceSchema>;

export interface MediaIntelligenceContext {
  fileName: string;
  kind: "video" | "image" | "audio";
  folderLabel?: string | null;
  durationSec?: number | null;
  transcript?: string | null;
  ocrText?: string | null;
  visionDescription?: string | null;
  keywords?: string[];
  brandVoice?: string | null;
  defaultHashtags?: string[];
}

function truncate(text: string, max = 4000): string {
  return text.length > max ? `${text.slice(0, max)}…[truncated]` : text;
}

/** Compact, non-empty context lines only — keeps the prompt tight for local models. */
function contextBlock(ctx: MediaIntelligenceContext): string {
  const lines: string[] = [
    `File: ${ctx.fileName}`,
    `Type: ${ctx.kind}`,
  ];
  if (ctx.folderLabel) lines.push(`Folder/topic: ${ctx.folderLabel}`);
  if (ctx.durationSec) lines.push(`Duration: ${Math.round(ctx.durationSec)}s`);
  if (ctx.keywords?.length) lines.push(`Keywords: ${ctx.keywords.join(", ")}`);
  if (ctx.visionDescription) lines.push(`Visual description: ${truncate(ctx.visionDescription, 1500)}`);
  if (ctx.transcript) lines.push(`Transcript: ${truncate(ctx.transcript)}`);
  if (ctx.ocrText) lines.push(`On-screen text: ${truncate(ctx.ocrText, 1000)}`);
  return lines.join("\n");
}

export function buildMediaIntelligencePrompt(ctx: MediaIntelligenceContext): ChatMessage[] {
  const voice = ctx.brandVoice
    ? `Match this brand voice: ${ctx.brandVoice}.`
    : "Use a warm, authentic, creator-friendly voice.";
  const defaults = ctx.defaultHashtags?.length
    ? ` Always consider including these brand hashtags where relevant: ${ctx.defaultHashtags.join(" ")}.`
    : "";

  const system = [
    "You are a senior social media strategist for a travel/lifestyle creator.",
    "Generate publish-ready content ideas for ONE piece of media.",
    voice + defaults,
    "Return ONLY valid JSON matching this exact shape (no prose, no markdown):",
    JSON.stringify(
      {
        titles: ["string"],
        hooks: ["string"],
        captions: ["string"],
        descriptions: ["string"],
        hashtags: ["#string"],
        ctas: ["string"],
        thumbnail_ideas: ["string"],
        best_cover_frame_sec: 0,
        target_audience: "string",
        recommended_platforms: [...PLATFORMS],
        engagement_prediction: { instagram: "high", youtube: "medium" },
      },
      null,
      0,
    ),
    "Rules: hashtags start with #; recommended_platforms only from the allowed set;",
    "engagement_prediction values are only 'low' | 'medium' | 'high';",
    "best_cover_frame_sec is a number of seconds or null; keep captions platform-agnostic.",
  ].join(" ");

  return [
    { role: "system", content: system },
    { role: "user", content: `Media context:\n${contextBlock(ctx)}` },
  ];
}
