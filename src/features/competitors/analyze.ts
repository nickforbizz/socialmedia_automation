/**
 * Pure competitor analytics. No I/O so it's unit tested and reused by the page
 * and the opportunity finder.
 */

export interface CompetitorPostLite {
  posted_at: string;
  hashtags: string[];
  topics: string[];
  media_type: "video" | "image" | "carousel" | "text";
  video_length_sec: number | null;
  likes: number;
  comments: number;
  shares: number;
}

export interface Counted {
  key: string;
  count: number;
}

export interface CompetitorAnalysis {
  postCount: number;
  postsPerWeek: number;
  avgEngagement: number;
  topHashtags: Counted[];
  topTopics: Counted[];
  bestHours: Counted[];
  avgVideoLengthSec: number | null;
  mediaMix: Record<string, number>;
}

function engagement(p: CompetitorPostLite): number {
  return p.likes + p.comments + p.shares;
}

function tally(items: string[]): Counted[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function analyzeCompetitorPosts(posts: CompetitorPostLite[]): CompetitorAnalysis {
  if (posts.length === 0) {
    return {
      postCount: 0,
      postsPerWeek: 0,
      avgEngagement: 0,
      topHashtags: [],
      topTopics: [],
      bestHours: [],
      avgVideoLengthSec: null,
      mediaMix: {},
    };
  }

  const times = posts.map((p) => new Date(p.posted_at).getTime());
  const spanMs = Math.max(...times) - Math.min(...times);
  const weeks = Math.max(1, spanMs / (7 * 24 * 3600 * 1000));

  const totalEngagement = posts.reduce((s, p) => s + engagement(p), 0);

  const hours = posts.map((p) => String(new Date(p.posted_at).getHours()));
  const videoLengths = posts
    .filter((p) => p.media_type === "video" && typeof p.video_length_sec === "number")
    .map((p) => p.video_length_sec as number);

  const mediaMix: Record<string, number> = {};
  for (const p of posts) mediaMix[p.media_type] = (mediaMix[p.media_type] ?? 0) + 1;

  return {
    postCount: posts.length,
    postsPerWeek: Number((posts.length / weeks).toFixed(1)),
    avgEngagement: Math.round(totalEngagement / posts.length),
    topHashtags: tally(posts.flatMap((p) => p.hashtags)).slice(0, 8),
    topTopics: tally(posts.flatMap((p) => p.topics)).slice(0, 8),
    bestHours: tally(hours).slice(0, 3),
    avgVideoLengthSec: videoLengths.length
      ? Math.round(videoLengths.reduce((a, b) => a + b, 0) / videoLengths.length)
      : null,
    mediaMix,
  };
}
