import type { PostMetrics, AccountMetrics } from "@/lib/social/types";

/**
 * Deterministic synthetic metrics for the mock provider, so the analytics
 * dashboard shows realistic, *growing* numbers over time without real APIs.
 * Pure and unit-tested. Numbers are a function of a per-entity seed and age,
 * so repeated snapshots trend upward and each post differs.
 */

/** Small stable seed (1..10) from an id string. */
export function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 10) + 1;
}

export function syntheticPostMetrics(
  id: string,
  ageHours: number,
  mediaKind?: "video" | "image" | "audio" | null,
): PostMetrics {
  const seed = seedFromId(id);
  const age = Math.max(0, ageHours);
  // Impressions grow quickly early, then keep climbing more slowly.
  const impressions = Math.round(seed * 120 + age * seed * 9 + Math.sqrt(age) * seed * 40);
  const reach = Math.round(impressions * 0.72);
  const isVideo = mediaKind === "video";
  const views = isVideo ? Math.round(impressions * 0.85) : 0;
  const watchTimeSec = isVideo ? Math.round(views * (6 + (seed % 4))) : 0;
  const likes = Math.round(impressions * (0.06 + (seed % 3) * 0.01));
  const comments = Math.round(impressions * 0.008);
  const shares = Math.round(impressions * 0.012);
  const saves = Math.round(impressions * 0.018);
  const clicks = Math.round(impressions * 0.025);
  return { impressions, reach, views, watchTimeSec, likes, comments, shares, saves, clicks };
}

export function syntheticAccountMetrics(id: string, ageHours: number): AccountMetrics {
  const seed = seedFromId(id);
  const followers = Math.round(1500 + seed * 300 + Math.max(0, ageHours) * seed * 2);
  return { followers, following: 200 + seed * 5, postsCount: 40 + Math.floor(ageHours / 24) };
}

/** Engagement rate = (likes+comments+shares+saves) / reach, as a 0..1 fraction. */
export function engagementRate(m: {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
}): number {
  if (m.reach <= 0) return 0;
  return (m.likes + m.comments + m.shares + m.saves) / m.reach;
}
