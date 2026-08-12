import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai/registry";
import { extractJson } from "@/lib/ai/json";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";
import {
  buildMediaIntelligencePrompt,
  mediaIntelligenceSchema,
  MEDIA_INTELLIGENCE_PROMPT_VERSION,
  type MediaIntelligenceContext,
  type MediaIntelligenceResult,
} from "@/lib/ai/prompts/media-intelligence";

type DB = SupabaseClient<Database>;

export class IntelligenceGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntelligenceGenerationError";
  }
}

/** Call the text provider and parse/validate its JSON into a typed result. */
export async function generateMediaIntelligence(
  ctx: MediaIntelligenceContext,
): Promise<{ result: MediaIntelligenceResult; provider: string; model: string }> {
  const provider = getProvider("text");
  const messages = buildMediaIntelligencePrompt(ctx);
  const res = await provider.generateText({ messages, temperature: 0.8, json: true });

  const parsed = extractJson(res.text);
  if (!parsed) {
    throw new IntelligenceGenerationError("Model did not return parseable JSON.");
  }
  const validated = mediaIntelligenceSchema.safeParse(parsed);
  if (!validated.success) {
    throw new IntelligenceGenerationError(
      `Generated content failed validation: ${validated.error.issues[0]?.message}`,
    );
  }
  return { result: validated.data, provider: res.provider, model: res.model };
}

/**
 * Build the generation context for a media item from its stored analysis,
 * generate intelligence, and upsert the row. Used by the worker and by the
 * "regenerate" server action. Pass a service-role client (worker) or the
 * user's client (server action) — RLS is satisfied by owner_id either way.
 */
export async function generateAndStoreIntelligence(
  db: DB,
  mediaId: string,
): Promise<MediaIntelligenceResult> {
  const { data: media, error: mErr } = await db
    .from("media")
    .select("id, owner_id, kind, file_name, folder_label, duration_sec")
    .eq("id", mediaId)
    .single();
  if (mErr || !media) throw new IntelligenceGenerationError(`Media not found: ${mediaId}`);

  const { data: analysis } = await db
    .from("media_analysis")
    .select("transcript, ocr_text, keywords, category")
    .eq("media_id", mediaId)
    .maybeSingle();

  const ctx: MediaIntelligenceContext = {
    fileName: media.file_name,
    kind: media.kind,
    folderLabel: media.folder_label,
    durationSec: media.duration_sec,
    transcript: analysis?.transcript ?? null,
    ocrText: analysis?.ocr_text ?? null,
    keywords: analysis?.keywords ?? [],
  };

  const { result, provider, model } = await generateMediaIntelligence(ctx);

  const { error: upsertErr } = await db.from("media_intelligence").upsert(
    {
      media_id: mediaId,
      owner_id: media.owner_id,
      titles: result.titles,
      hooks: result.hooks,
      captions: result.captions,
      descriptions: result.descriptions,
      hashtags: result.hashtags,
      ctas: result.ctas,
      thumbnail_ideas: result.thumbnail_ideas,
      best_cover_frame_sec: result.best_cover_frame_sec,
      target_audience: result.target_audience,
      recommended_platforms: result.recommended_platforms,
      engagement_prediction: result.engagement_prediction,
      provider,
      model,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "media_id" },
  );
  if (upsertErr) throw new IntelligenceGenerationError(`Failed to store: ${upsertErr.message}`);

  logger.info("intelligence generated", { mediaId, provider, model, promptVersion: MEDIA_INTELLIGENCE_PROMPT_VERSION });
  return result;
}
