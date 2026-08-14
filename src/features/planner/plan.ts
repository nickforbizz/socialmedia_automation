import type { SocialPlatform } from "@/lib/supabase/database.types";
import { nextOccurrence } from "@/features/posts/recommend";

/**
 * Pure weekly-plan builder. Spreads content across strong posting windows over
 * the coming week and assigns each media item a platform and a slot. Kept pure
 * so it's unit-tested; the service layer turns items into editable drafts.
 */

/** Strong posting windows: [dayOfWeek 0=Sun, hour]. Ordered for variety. */
export const POSTING_SLOTS: { day: number; hour: number }[] = [
  { day: 1, hour: 12 }, // Mon noon
  { day: 3, hour: 17 }, // Wed 5pm
  { day: 5, hour: 16 }, // Fri 4pm
  { day: 6, hour: 11 }, // Sat 11am
  { day: 0, hour: 19 }, // Sun 7pm
];

/** The next `count` posting slots after `from`, strictly increasing. */
export function weeklySlots(from: Date, count: number): Date[] {
  const result: Date[] = [];
  let prev = from;
  while (result.length < count) {
    const slot = POSTING_SLOTS[result.length % POSTING_SLOTS.length]!;
    const d = nextOccurrence(slot.day, slot.hour, prev);
    result.push(d);
    prev = d;
  }
  return result;
}

export interface PlanMediaInput {
  mediaId: string;
  kind: "video" | "image" | "audio";
  recommendedPlatforms?: SocialPlatform[];
}

export interface PlanItem {
  mediaId: string;
  platform: SocialPlatform;
  scheduledFor: string; // ISO
}

/**
 * Assign up to `maxPosts` media items to upcoming slots. Platform preference
 * comes from each item's recommended platforms (from Phase 2 intelligence),
 * defaulting to Instagram.
 */
export function buildWeeklyPlan(
  media: PlanMediaInput[],
  from: Date = new Date(),
  maxPosts = 5,
): PlanItem[] {
  const chosen = media.slice(0, maxPosts);
  const slots = weeklySlots(from, chosen.length);
  return chosen.map((m, i) => ({
    mediaId: m.mediaId,
    platform: m.recommendedPlatforms?.[0] ?? "instagram",
    scheduledFor: slots[i]!.toISOString(),
  }));
}
