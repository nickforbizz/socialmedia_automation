import { describe, it, expect } from "vitest";
import { analyzeCompetitorPosts, type CompetitorPostLite } from "./analyze";

function post(p: Partial<CompetitorPostLite>): CompetitorPostLite {
  return {
    posted_at: "2026-08-01T18:00:00",
    hashtags: [],
    topics: [],
    media_type: "image",
    video_length_sec: null,
    likes: 0,
    comments: 0,
    shares: 0,
    ...p,
  };
}

describe("analyzeCompetitorPosts", () => {
  it("returns zeros for no posts", () => {
    const a = analyzeCompetitorPosts([]);
    expect(a.postCount).toBe(0);
    expect(a.avgEngagement).toBe(0);
    expect(a.topHashtags).toEqual([]);
  });

  it("computes engagement, hashtags, topics and media mix", () => {
    const posts = [
      post({ hashtags: ["#beach", "#sunset"], topics: ["beach"], likes: 100, comments: 10, shares: 5 }),
      post({ hashtags: ["#beach"], topics: ["beach"], media_type: "video", video_length_sec: 30, likes: 50, comments: 4, shares: 1 }),
      post({ hashtags: ["#food"], topics: ["food"], likes: 20, comments: 2, shares: 0 }),
    ];
    const a = analyzeCompetitorPosts(posts);
    expect(a.postCount).toBe(3);
    expect(a.avgEngagement).toBe(Math.round((115 + 55 + 22) / 3));
    expect(a.topHashtags[0]).toEqual({ key: "#beach", count: 2 });
    expect(a.topTopics[0]).toEqual({ key: "beach", count: 2 });
    expect(a.avgVideoLengthSec).toBe(30);
    expect(a.mediaMix).toMatchObject({ image: 2, video: 1 });
  });

  it("derives posts-per-week from the time span", () => {
    const posts = [
      post({ posted_at: "2026-08-01T18:00:00" }),
      post({ posted_at: "2026-08-08T18:00:00" }),
      post({ posted_at: "2026-08-15T18:00:00" }),
    ];
    // 3 posts spanning 2 weeks → 1.5/week
    expect(analyzeCompetitorPosts(posts).postsPerWeek).toBeCloseTo(1.5, 1);
  });
});
