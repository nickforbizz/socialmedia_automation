import "server-only";

import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai/registry";
import { extractJson } from "@/lib/ai/json";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";
import { buildVisionAnalysisPrompt, visionAnalysisSchema } from "@/lib/ai/prompts/vision";
import { extractFramesBase64 } from "./frames";
import { estimateViralScore } from "./scoring";
import { buildEmbeddingText } from "./embeddings";

type DB = SupabaseClient<Database>;

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

/** Collect base64 images to analyze for a media item (frames for video, the file for images). */
async function collectImages(
  kind: string,
  filePath: string,
  durationSec: number | null,
): Promise<string[]> {
  if (kind === "image") {
    const bytes = await readFile(filePath);
    return [bytes.toString("base64")];
  }
  if (kind === "video") {
    return extractFramesBase64(filePath, durationSec ?? 0, 4);
  }
  return []; // audio: no visual frames (transcript is a Phase-2 STT seam)
}

/**
 * Analyze a media item: run vision over its frames, derive keywords/mood/quality,
 * compute a viral score, build the semantic embedding, and persist media_analysis.
 * Sets media.status to 'analyzed' (or 'failed'). Requires a client authorized for
 * the owner (service-role in the worker).
 */
export async function analyzeMedia(db: DB, mediaId: string): Promise<void> {
  const { data: media, error } = await db
    .from("media")
    .select("id, owner_id, kind, source_path, file_name, folder_label, duration_sec")
    .eq("id", mediaId)
    .single();
  if (error || !media) throw new AnalysisError(`Media not found: ${mediaId}`);

  try {
    const images = await collectImages(media.kind, media.source_path, media.duration_sec);

    // Vision is enrichment, not a hard requirement. If the vision model is
    // missing/unavailable, log and proceed with metadata-only analysis so the
    // item is still analyzed, embedded, and searchable (rather than failing).
    let vision = visionAnalysisSchema.parse({ description: "" });
    if (images.length > 0) {
      try {
        const res = await getProvider("vision").generateVision({
          prompt: buildVisionAnalysisPrompt(media.file_name, media.folder_label),
          images,
        });
        const parsed = extractJson(res.text);
        const validated = visionAnalysisSchema.safeParse(parsed ?? {});
        if (validated.success) vision = validated.data;
        else logger.warn("vision analysis unparseable; storing minimal analysis", { mediaId });
      } catch (e) {
        logger.warn("vision provider unavailable; metadata-only analysis", {
          mediaId,
          message: (e as Error).message,
        });
      }
    }

    const viral = estimateViralScore({
      kind: media.kind,
      durationSec: media.duration_sec,
      hasPeople: vision.has_people,
      qualityScore: vision.quality_score,
      keywordCount: vision.keywords.length,
      hasHook: Boolean(vision.on_screen_text),
    });

    const embeddingText = buildEmbeddingText({
      fileName: media.file_name,
      folderLabel: media.folder_label,
      description: vision.description,
      keywords: vision.keywords,
      category: vision.category,
      mood: vision.mood,
      transcript: null,
    });

    let embedding: number[] | null = null;
    try {
      const [vec] = await getProvider("embedding").generateEmbeddings({ input: [embeddingText] });
      embedding = vec ?? null;
    } catch (e) {
      logger.warn("embedding failed; analysis stored without vector", {
        mediaId,
        message: (e as Error).message,
      });
    }

    const { error: upErr } = await db.from("media_analysis").upsert(
      {
        media_id: mediaId,
        owner_id: media.owner_id,
        transcript: null, // Phase-2 STT seam (audio/video speech-to-text)
        ocr_text: vision.on_screen_text,
        objects: vision.objects,
        scenes: [], // Phase-2 scene-detection seam
        category: vision.category,
        tone: null,
        mood: vision.mood,
        keywords: vision.keywords,
        quality_score: vision.quality_score,
        viral_score: viral,
        embedding: embedding ? `[${embedding.join(",")}]` : null,
      },
      { onConflict: "media_id" },
    );
    if (upErr) throw new AnalysisError(`Failed to store analysis: ${upErr.message}`);

    await db.from("media").update({ status: "analyzed" }).eq("id", mediaId);
    logger.info("analysis complete", { mediaId, viral, hasEmbedding: Boolean(embedding) });
  } catch (err) {
    await db.from("media").update({ status: "failed" }).eq("id", mediaId);
    throw err instanceof AnalysisError ? err : new AnalysisError((err as Error).message);
  }
}
