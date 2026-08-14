/**
 * Pure aggregation helpers for analytics. Kept free of I/O so they're unit
 * tested and reused by both the dashboard queries and the insight builder.
 */

export interface MetricTotals {
  impressions: number;
  reach: number;
  views: number;
  watchTimeSec: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}

export interface MetricRow {
  impressions: number;
  reach: number;
  views: number;
  watch_time_sec: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}

export function emptyTotals(): MetricTotals {
  return {
    impressions: 0,
    reach: 0,
    views: 0,
    watchTimeSec: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
  };
}

export function sumMetrics(rows: MetricRow[]): MetricTotals {
  return rows.reduce<MetricTotals>((acc, r) => {
    acc.impressions += r.impressions;
    acc.reach += r.reach;
    acc.views += r.views;
    acc.watchTimeSec += r.watch_time_sec;
    acc.likes += r.likes;
    acc.comments += r.comments;
    acc.shares += r.shares;
    acc.saves += r.saves;
    acc.clicks += r.clicks;
    return acc;
  }, emptyTotals());
}

export function engagementCount(m: {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}): number {
  return m.likes + m.comments + m.shares + m.saves;
}

/** Engagement rate as a 0..1 fraction of reach. */
export function engagementRate(m: {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
}): number {
  return m.reach > 0 ? engagementCount(m) / m.reach : 0;
}

/** Click-through rate as a 0..1 fraction of impressions. */
export function ctr(m: { clicks: number; impressions: number }): number {
  return m.impressions > 0 ? m.clicks / m.impressions : 0;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  engagement: number;
  reach: number;
  rate: number;
}

export interface SeriesSnapshot {
  post_id: string;
  captured_at: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Build a daily engagement series over the last `days`. Metrics snapshots are
 * cumulative totals, so within each day we take the latest snapshot per post,
 * then sum across posts — yielding a rising cumulative curve suitable for a
 * trend chart. Days with no data are zero-filled.
 */
export function buildDailySeries(
  snapshots: SeriesSnapshot[],
  days: number,
  now: Date = new Date(),
): DailyPoint[] {
  // date -> post_id -> latest snapshot that day
  const byDay = new Map<string, Map<string, SeriesSnapshot>>();
  for (const s of snapshots) {
    const key = dayKey(new Date(s.captured_at));
    const posts = byDay.get(key) ?? new Map<string, SeriesSnapshot>();
    const existing = posts.get(s.post_id);
    if (!existing || new Date(s.captured_at) > new Date(existing.captured_at)) {
      posts.set(s.post_id, s);
    }
    byDay.set(key, posts);
  }

  const points: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const posts = byDay.get(key);
    let engagement = 0;
    let reach = 0;
    if (posts) {
      for (const s of posts.values()) {
        engagement += engagementCount(s);
        reach += s.reach;
      }
    }
    points.push({ date: key, engagement, reach, rate: reach > 0 ? engagement / reach : 0 });
  }
  return points;
}
