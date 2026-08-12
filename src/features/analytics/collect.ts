import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSocialProvider } from "@/lib/social/registry";
import { getAccessTokenForAccount } from "@/features/social/accounts";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type DB = SupabaseClient<Database>;

export interface CollectResult {
  postSnapshots: number;
  accountSnapshots: number;
}

/**
 * Collect a metrics snapshot for every published post and connected account
 * reachable by `db` (all owners with the service-role client in the worker; the
 * signed-in user with a request client). Providers that don't implement the
 * metrics methods are skipped (real-platform seam); the mock provider
 * synthesizes realistic, growing numbers.
 */
export async function collectMetrics(db: DB): Promise<CollectResult> {
  let postSnapshots = 0;
  let accountSnapshots = 0;

  // --- Published posts ---
  const { data: posts, error: postsErr } = await db
    .from("posts")
    .select("id, owner_id, social_account_id, platform, media_id, published_at, external_post_id")
    .eq("status", "published")
    .not("social_account_id", "is", null)
    .limit(1000);
  if (postsErr) throw new Error(`collect posts failed: ${postsErr.message}`);

  for (const post of posts ?? []) {
    if (!post.social_account_id || !post.external_post_id) continue;
    const provider = getSocialProvider(post.platform);
    if (!provider.fetchPostMetrics) continue;

    try {
      const { accessToken } = await getAccessTokenForAccount(db, post.social_account_id);
      let mediaKind: "video" | "image" | "audio" | null = null;
      if (post.media_id) {
        const { data: m } = await db
          .from("media")
          .select("kind")
          .eq("id", post.media_id)
          .maybeSingle();
        mediaKind = m?.kind ?? null;
      }

      const metrics = await provider.fetchPostMetrics({
        accessToken,
        externalPostId: post.external_post_id,
        publishedAt: post.published_at,
        mediaKind,
      });
      if (!metrics) continue;

      const { error } = await db.from("post_metrics").insert({
        post_id: post.id,
        owner_id: post.owner_id,
        impressions: metrics.impressions,
        reach: metrics.reach,
        views: metrics.views,
        watch_time_sec: metrics.watchTimeSec,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        clicks: metrics.clicks,
      });
      if (error) throw new Error(error.message);
      postSnapshots++;
    } catch (err) {
      logger.warn("collect post metrics failed", { postId: post.id, message: (err as Error).message });
    }
  }

  // --- Connected accounts (followers) ---
  const { data: accounts, error: acctErr } = await db
    .from("social_accounts")
    .select("id, owner_id, platform, external_account_id")
    .eq("status", "connected")
    .limit(500);
  if (acctErr) throw new Error(`collect accounts failed: ${acctErr.message}`);

  for (const acct of accounts ?? []) {
    const provider = getSocialProvider(acct.platform);
    if (!provider.fetchAccountMetrics) continue;
    try {
      const { accessToken } = await getAccessTokenForAccount(db, acct.id);
      const metrics = await provider.fetchAccountMetrics({
        accessToken,
        externalAccountId: acct.external_account_id,
      });
      if (!metrics) continue;
      const { error } = await db.from("account_metrics").insert({
        social_account_id: acct.id,
        owner_id: acct.owner_id,
        followers: metrics.followers,
        following: metrics.following,
        posts_count: metrics.postsCount,
      });
      if (error) throw new Error(error.message);
      accountSnapshots++;
    } catch (err) {
      logger.warn("collect account metrics failed", { accountId: acct.id, message: (err as Error).message });
    }
  }

  logger.info("metrics collected", { postSnapshots, accountSnapshots });
  return { postSnapshots, accountSnapshots };
}
