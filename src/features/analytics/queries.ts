import { createClient } from "@/lib/supabase/server";
import type { Json, SocialPlatform } from "@/lib/supabase/database.types";
import {
  sumMetrics,
  buildDailySeries,
  engagementCount,
  engagementRate,
  ctr,
  type DailyPoint,
  type MetricTotals,
} from "./aggregate";
import { explainPerformance } from "./insights";

export interface BestPerformer {
  postId: string;
  caption: string;
  platform: SocialPlatform;
  externalUrl: string | null;
  engagement: number;
  reach: number;
  views: number;
  reasons: string[];
}

export interface AnalyticsData {
  hasData: boolean;
  totals: MetricTotals;
  engagementRate: number;
  ctr: number;
  followers: number;
  series: DailyPoint[];
  best: BestPerformer[];
}

function objectsHavePeople(objects: Json): boolean {
  if (!Array.isArray(objects)) return false;
  return objects.some((o) => typeof o === "string" && /person|people|man|woman|crowd/i.test(o));
}

/** Everything the analytics dashboard needs, RLS-scoped to the signed-in user. */
export async function getAnalyticsData(days = 14): Promise<AnalyticsData> {
  const supabase = await createClient();
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: latest }, { data: snaps }, { data: accts }] = await Promise.all([
    supabase.from("post_metrics_latest").select("*"),
    supabase
      .from("post_metrics")
      .select("post_id, captured_at, likes, comments, shares, saves, reach")
      .gte("captured_at", sinceIso),
    supabase
      .from("account_metrics")
      .select("social_account_id, followers, captured_at")
      .order("captured_at", { ascending: false }),
  ]);

  const latestRows = latest ?? [];
  const totals = sumMetrics(latestRows);
  const series = buildDailySeries(snaps ?? [], days);

  // Followers: latest snapshot per account, summed.
  const seen = new Set<string>();
  let followers = 0;
  for (const a of accts ?? []) {
    if (!seen.has(a.social_account_id)) {
      seen.add(a.social_account_id);
      followers += a.followers;
    }
  }

  // Best performers: rank latest snapshots by engagement, hydrate post + media.
  const ranked = latestRows
    .map((r) => ({ row: r, engagement: engagementCount(r) }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5);

  const best: BestPerformer[] = [];
  if (ranked.length > 0) {
    const postIds = ranked.map((r) => r.row.post_id);
    const { data: posts } = await supabase
      .from("posts")
      .select("id, caption, platform, external_url, media_id")
      .in("id", postIds);
    const postById = new Map((posts ?? []).map((p) => [p.id, p]));

    const mediaIds = (posts ?? []).map((p) => p.media_id).filter((x): x is string => Boolean(x));
    const [mediaRes, analysisRes] = await Promise.all([
      mediaIds.length
        ? supabase.from("media").select("id, kind, duration_sec").in("id", mediaIds)
        : Promise.resolve({ data: [] as { id: string; kind: string; duration_sec: number | null }[] }),
      mediaIds.length
        ? supabase
            .from("media_analysis")
            .select("media_id, objects, ocr_text, quality_score, viral_score, keywords")
            .in("media_id", mediaIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);
    const mediaById = new Map((mediaRes.data ?? []).map((m) => [m.id, m]));
    const analysisByMedia = new Map((analysisRes.data ?? []).map((a) => [a.media_id, a]));

    for (const { row, engagement } of ranked) {
      const post = postById.get(row.post_id);
      if (!post) continue;
      const media = post.media_id ? mediaById.get(post.media_id) : undefined;
      const analysis = post.media_id ? analysisByMedia.get(post.media_id) : undefined;
      const reasons = explainPerformance({
        mediaKind: (media?.kind as "video" | "image" | "audio" | undefined) ?? null,
        durationSec: media?.duration_sec ?? null,
        hasPeople: analysis ? objectsHavePeople(analysis.objects) : false,
        hasHook: Boolean(analysis?.ocr_text),
        qualityScore: analysis?.quality_score ?? null,
        viralScore: analysis?.viral_score ?? null,
        keywordCount: analysis?.keywords?.length ?? 0,
      });
      best.push({
        postId: row.post_id,
        caption: post.caption,
        platform: post.platform,
        externalUrl: post.external_url,
        engagement,
        reach: row.reach,
        views: row.views,
        reasons,
      });
    }
  }

  return {
    hasData: latestRows.length > 0,
    totals,
    engagementRate: engagementRate(totals),
    ctr: ctr(totals),
    followers,
    series,
    best,
  };
}
