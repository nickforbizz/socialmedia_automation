import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateDefaultProject } from "@/features/social/accounts";
import { logger } from "@/lib/logger";
import type { Database, SocialPlatform } from "@/lib/supabase/database.types";
import { buildWeeklyPlan, type PlanMediaInput } from "./plan";

type DB = SupabaseClient<Database>;

export interface GenerateResult {
  created: number;
  message: string;
}

/**
 * Agentic weekly planner: gathers analyzed, not-yet-used media, assigns each a
 * platform and posting slot (Phase 2 recommendations + Phase 3 timing), and
 * creates editable DRAFTS with suggested captions/times. Nothing is published —
 * the user reviews and schedules from the calendar.
 */
export async function generateWeeklyPlan(db: DB, ownerId: string, maxPosts = 5): Promise<GenerateResult> {
  const [{ data: analyzed }, { data: intel }, { data: existing }, { data: accounts }] =
    await Promise.all([
      db.from("media").select("id, kind").eq("status", "analyzed").limit(300),
      db.from("media_intelligence").select("media_id, captions, hashtags, recommended_platforms"),
      db.from("posts").select("media_id").not("media_id", "is", null),
      db.from("social_accounts").select("id, platform").eq("status", "connected"),
    ]);

  const intelByMedia = new Map((intel ?? []).map((i) => [i.media_id, i]));
  const usedMedia = new Set((existing ?? []).map((p) => p.media_id));
  const accountByPlatform = new Map<SocialPlatform, string>();
  for (const a of accounts ?? []) if (!accountByPlatform.has(a.platform)) accountByPlatform.set(a.platform, a.id);

  const candidates: PlanMediaInput[] = (analyzed ?? [])
    .filter((m) => !usedMedia.has(m.id))
    .map((m) => ({
      mediaId: m.id,
      kind: m.kind,
      recommendedPlatforms: (intelByMedia.get(m.id)?.recommended_platforms as SocialPlatform[]) ?? [],
    }));

  if (candidates.length === 0) {
    return { created: 0, message: "No unused analyzed media to plan. Ingest and analyze more, or publish existing drafts." };
  }

  const plan = buildWeeklyPlan(candidates, new Date(), maxPosts);
  const projectId = await getOrCreateDefaultProject(db, ownerId);

  const rows = plan.map((item) => {
    const info = intelByMedia.get(item.mediaId);
    return {
      owner_id: ownerId,
      project_id: projectId,
      social_account_id: accountByPlatform.get(item.platform) ?? null,
      media_id: item.mediaId,
      platform: item.platform,
      caption: info?.captions?.[0] ?? "",
      hashtags: info?.hashtags ?? [],
      link: null,
      status: "draft" as const,
      scheduled_for: item.scheduledFor, // suggested time; stays a draft until approved
      published_at: null,
      external_post_id: null,
      external_url: null,
      error: null,
    };
  });

  const { error } = await db.from("posts").insert(rows);
  if (error) throw new Error(`Failed to create plan drafts: ${error.message}`);

  logger.info("weekly plan generated", { created: rows.length });
  return { created: rows.length, message: `Created ${rows.length} draft${rows.length === 1 ? "" : "s"} for the week.` };
}
