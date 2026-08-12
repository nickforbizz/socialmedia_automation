import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import { getSocialProvider } from "@/lib/social/registry";
import { getAccessTokenForAccount } from "@/features/social/accounts";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type DB = SupabaseClient<Database>;

export class PublishError extends Error {
  constructor(
    message: string,
    public readonly retryable = true,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

/** Signed URL for a media object so the platform can fetch it (1h TTL). */
async function mediaPublicUrl(db: DB, storagePath: string): Promise<string | undefined> {
  const bucket = getServerEnv().MEDIA_STORAGE_BUCKET;
  const { data } = await db.storage.from(bucket).createSignedUrl(storagePath, 3600);
  return data?.signedUrl;
}

/**
 * Publish a single post: resolve a fresh access token, attach media, call the
 * platform provider, and record the outcome. Idempotency is guarded by status
 * transitions; the caller (worker) applies retry/backoff. Requires a client
 * authorized for the owner (service-role in the worker).
 */
export async function publishPost(db: DB, postId: string): Promise<void> {
  const { data: post, error } = await db
    .from("posts")
    .select("id, owner_id, social_account_id, media_id, platform, caption, hashtags, link, status")
    .eq("id", postId)
    .single();
  if (error || !post) throw new PublishError(`Post not found: ${postId}`, false);

  if (post.status === "published") return; // already done — idempotent
  if (!post.social_account_id) {
    await db.from("posts").update({ status: "failed", error: "No account selected." }).eq("id", postId);
    throw new PublishError("Post has no social account.", false);
  }

  await db.from("posts").update({ status: "publishing", error: null }).eq("id", postId);

  try {
    const { accessToken, externalAccountId } = await getAccessTokenForAccount(
      db,
      post.social_account_id,
    );

    let mediaUrl: string | undefined;
    let mediaKind: "video" | "image" | "audio" | undefined;
    if (post.media_id) {
      const { data: media } = await db
        .from("media")
        .select("kind, storage_path")
        .eq("id", post.media_id)
        .maybeSingle();
      if (media?.storage_path) {
        mediaUrl = await mediaPublicUrl(db, media.storage_path);
        mediaKind = media.kind;
      }
    }

    const result = await getSocialProvider(post.platform).publish({
      accessToken,
      externalAccountId,
      input: { caption: post.caption, hashtags: post.hashtags, link: post.link ?? undefined, mediaUrl, mediaKind },
    });

    await db
      .from("posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        external_post_id: result.externalPostId,
        external_url: result.externalUrl ?? null,
        error: null,
      })
      .eq("id", postId);

    logger.info("post published", { postId, platform: post.platform, external: result.externalPostId });
  } catch (err) {
    const message = (err as Error).message;
    await db.from("posts").update({ status: "failed", error: message }).eq("id", postId);
    throw err instanceof PublishError ? err : new PublishError(message);
  }
}
