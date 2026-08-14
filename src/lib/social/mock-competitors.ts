import { seedFromId } from "./mock-metrics";
import type { CompetitorObservedPost } from "./types";

/**
 * Deterministic synthetic competitor posts so competitor intelligence works
 * end-to-end without real platform access. Pure and unit-tested. Posts are a
 * function of the handle (seed) and index, spread over recent weeks with
 * realistic travel/lifestyle themes, hashtags, posting times and engagement.
 */
const THEMES: { topic: string; captionTemplate: string; hashtags: string[] }[] = [
  { topic: "beach", captionTemplate: "Golden hour on the coast", hashtags: ["#beach", "#coast", "#sunset"] },
  { topic: "drone", captionTemplate: "Aerial views you have to see", hashtags: ["#drone", "#aerial", "#dji"] },
  { topic: "food", captionTemplate: "Where to eat on the coast", hashtags: ["#foodie", "#swahilifood", "#eats"] },
  { topic: "diving", captionTemplate: "Under the surface today", hashtags: ["#diving", "#ocean", "#reef"] },
  { topic: "safari", captionTemplate: "Wild encounters this week", hashtags: ["#safari", "#wildlife", "#kenya"] },
  { topic: "roadtrip", captionTemplate: "On the road again", hashtags: ["#roadtrip", "#travel", "#adventure"] },
];

const MEDIA_CYCLE = ["video", "image", "carousel", "video", "image"] as const;

export function syntheticCompetitorPosts(handle: string, count = 24): CompetitorObservedPost[] {
  const seed = seedFromId(handle);
  const posts: CompetitorObservedPost[] = [];

  for (let i = 0; i < count; i++) {
    const theme = THEMES[(seed + i) % THEMES.length]!;
    const mediaType = MEDIA_CYCLE[i % MEDIA_CYCLE.length]!;
    // Spread posts over the last ~8 weeks, ~3/week, clustered Fri/Sat evenings.
    const daysAgo = Math.floor((i / 3) * 7) + (i % 3) * 2;
    const posted = new Date();
    posted.setDate(posted.getDate() - daysAgo);
    posted.setHours(17 + ((seed + i) % 4), (i * 7) % 60, 0, 0);

    const base = seed * 90 + ((count - i) * seed * 4);
    posts.push({
      externalPostId: `${handle}_post_${i}`,
      postedAt: posted.toISOString(),
      caption: `${theme.captionTemplate} #${i}`,
      hashtags: theme.hashtags,
      topics: [theme.topic],
      mediaType,
      videoLengthSec: mediaType === "video" ? 20 + ((seed + i) % 5) * 12 : undefined,
      likes: Math.round(base * (1 + (i % 3) * 0.2)),
      comments: Math.round(base * 0.04),
      shares: Math.round(base * 0.02),
      permalink: `https://example.com/${handle}/${i}`,
    });
  }
  return posts;
}
