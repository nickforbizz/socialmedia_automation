import { describe, it, expect } from "vitest";
import {
  sumMetrics,
  engagementCount,
  engagementRate,
  ctr,
  buildDailySeries,
  type MetricRow,
  type SeriesSnapshot,
} from "./aggregate";

function row(partial: Partial<MetricRow>): MetricRow {
  return {
    impressions: 0,
    reach: 0,
    views: 0,
    watch_time_sec: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    ...partial,
  };
}

describe("sumMetrics", () => {
  it("sums across rows", () => {
    const totals = sumMetrics([
      row({ reach: 100, likes: 10, clicks: 5, impressions: 200 }),
      row({ reach: 50, likes: 4, clicks: 3, impressions: 100 }),
    ]);
    expect(totals.reach).toBe(150);
    expect(totals.likes).toBe(14);
    expect(totals.clicks).toBe(8);
    expect(totals.impressions).toBe(300);
  });

  it("handles an empty list", () => {
    expect(sumMetrics([]).reach).toBe(0);
  });
});

describe("rates", () => {
  it("computes engagement count and rate", () => {
    const m = { likes: 10, comments: 5, shares: 3, saves: 2, reach: 100 };
    expect(engagementCount(m)).toBe(20);
    expect(engagementRate(m)).toBeCloseTo(0.2);
  });

  it("guards divide-by-zero", () => {
    expect(engagementRate({ likes: 1, comments: 0, shares: 0, saves: 0, reach: 0 })).toBe(0);
    expect(ctr({ clicks: 5, impressions: 0 })).toBe(0);
    expect(ctr({ clicks: 5, impressions: 100 })).toBeCloseTo(0.05);
  });
});

describe("buildDailySeries", () => {
  const now = new Date("2026-08-12T12:00:00");

  it("returns one point per day, zero-filled", () => {
    const series = buildDailySeries([], 3, now);
    expect(series).toHaveLength(3);
    expect(series.every((p) => p.engagement === 0)).toBe(true);
    expect(series[2]!.date).toBe("2026-08-12");
  });

  it("takes the latest snapshot per post per day, summed across posts", () => {
    const snaps: SeriesSnapshot[] = [
      // post A on the last day: two snapshots, later one wins
      { post_id: "a", captured_at: "2026-08-12T08:00:00", likes: 5, comments: 0, shares: 0, saves: 0, reach: 100 },
      { post_id: "a", captured_at: "2026-08-12T10:00:00", likes: 9, comments: 1, shares: 0, saves: 0, reach: 120 },
      // post B on the last day
      { post_id: "b", captured_at: "2026-08-12T09:00:00", likes: 3, comments: 0, shares: 2, saves: 0, reach: 60 },
    ];
    const series = buildDailySeries(snaps, 2, now);
    const last = series[series.length - 1]!;
    // A latest engagement = 9+1 = 10; B = 3+2 = 5 → 15; reach 120+60 = 180
    expect(last.engagement).toBe(15);
    expect(last.reach).toBe(180);
    expect(last.rate).toBeCloseTo(15 / 180);
  });
});
