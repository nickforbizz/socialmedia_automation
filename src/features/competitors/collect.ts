import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSocialProvider } from "@/lib/social/registry";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type DB = SupabaseClient<Database>;

export class CompetitorSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompetitorSyncError";
  }
}

/**
 * Sync one competitor's recent public posts. Uses the platform provider's
 * `fetchCompetitorPosts` when available (mock synthesizes; real platforms are a
 * seam). Upserts posts (dedup on external id) and stamps last_synced_at.
 */
export async function syncCompetitor(db: DB, competitorId: string): Promise<number> {
  const { data: comp, error } = await db
    .from("competitors")
    .select("id, owner_id, platform, handle")
    .eq("id", competitorId)
    .single();
  if (error || !comp) throw new CompetitorSyncError(`Competitor not found: ${competitorId}`);

  const provider = getSocialProvider(comp.platform);
  if (!provider.fetchCompetitorPosts) {
    logger.info("competitor sync skipped (provider has no data source)", { platform: comp.platform });
    return 0;
  }

  const observed = await provider.fetchCompetitorPosts({ handle: comp.handle, limit: 30 });
  if (observed.length > 0) {
    const rows = observed.map((p) => ({
      competitor_id: comp.id,
      owner_id: comp.owner_id,
      external_post_id: p.externalPostId,
      posted_at: p.postedAt,
      caption: p.caption,
      hashtags: p.hashtags,
      topics: p.topics,
      media_type: p.mediaType,
      video_length_sec: p.videoLengthSec ?? null,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      permalink: p.permalink ?? null,
    }));
    const { error: upErr } = await db
      .from("competitor_posts")
      .upsert(rows, { onConflict: "competitor_id,external_post_id" });
    if (upErr) throw new CompetitorSyncError(`Failed to store posts: ${upErr.message}`);
  }

  await db.from("competitors").update({ last_synced_at: new Date().toISOString() }).eq("id", comp.id);
  logger.info("competitor synced", { competitorId, posts: observed.length });
  return observed.length;
}

/** Sync every competitor reachable by `db` (worker: all owners). */
export async function syncAllCompetitors(db: DB): Promise<number> {
  const { data: comps } = await db.from("competitors").select("id").limit(500);
  let total = 0;
  for (const c of comps ?? []) {
    try {
      total += await syncCompetitor(db, c.id);
    } catch (err) {
      logger.warn("competitor sync failed", { id: c.id, message: (err as Error).message });
    }
  }
  return total;
}
