import { createClient } from "@/lib/supabase/server";
import type { PostStatus, SocialPlatform } from "@/lib/supabase/database.types";

export interface PostListItem {
  id: string;
  platform: SocialPlatform;
  caption: string;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  external_url: string | null;
  media_id: string | null;
  error: string | null;
}

const COLS =
  "id, platform, caption, status, scheduled_for, published_at, external_url, media_id, error";

/** Upcoming scheduled posts (and currently-publishing), soonest first. */
export async function listUpcomingPosts(limit = 50): Promise<PostListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(COLS)
    .in("status", ["scheduled", "publishing"])
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to load schedule: ${error.message}`);
  return data ?? [];
}

export async function listDraftPosts(limit = 50): Promise<PostListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(COLS)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load drafts: ${error.message}`);
  return data ?? [];
}

/** Posts scheduled or published within a date range (for the calendar grid). */
export async function listPostsInRange(startIso: string, endIso: string): Promise<PostListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(COLS)
    .not("scheduled_for", "is", null)
    .gte("scheduled_for", startIso)
    .lt("scheduled_for", endIso)
    .order("scheduled_for", { ascending: true });
  if (error) throw new Error(`Failed to load calendar: ${error.message}`);
  return data ?? [];
}
