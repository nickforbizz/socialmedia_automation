import type PgBoss from "pg-boss";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QUEUES } from "@/lib/queue/boss";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type DB = SupabaseClient<Database>;

/**
 * Find scheduled posts whose time has arrived and enqueue them for publishing.
 * singletonKey (postId) prevents a post from being enqueued twice while a
 * publish job is still active. Published posts leave the 'scheduled' status, so
 * they won't be re-selected.
 */
export async function dispatchDuePosts(db: DB, boss: PgBoss): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await db
    .from("posts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .limit(200);
  if (error) {
    logger.error("scheduler: query failed", { message: error.message });
    return 0;
  }

  for (const post of due ?? []) {
    await boss.send(QUEUES.publish, { postId: post.id }, { singletonKey: post.id });
  }
  if (due && due.length > 0) logger.info("scheduler: dispatched due posts", { count: due.length });
  return due?.length ?? 0;
}
