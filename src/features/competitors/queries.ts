import { createClient } from "@/lib/supabase/server";
import type { SocialPlatform } from "@/lib/supabase/database.types";
import { analyzeCompetitorPosts, type CompetitorAnalysis, type CompetitorPostLite } from "./analyze";
import { findOpportunities, type CompetitorTopic, type Opportunity } from "./opportunities";

export interface CompetitorSummary {
  id: string;
  platform: SocialPlatform;
  handle: string;
  displayName: string | null;
  isMock: boolean;
  lastSyncedAt: string | null;
  postCount: number;
  analysis: CompetitorAnalysis;
}

export interface CompetitorIntelligence {
  competitors: CompetitorSummary[];
  opportunities: Opportunity[];
  userMediaThemes: string[];
  hasPosts: boolean;
}

function normalize(values: (string | null | undefined)[]): string[] {
  return values.filter((v): v is string => Boolean(v)).map((v) => v.toLowerCase());
}

export async function getCompetitorIntelligence(): Promise<CompetitorIntelligence> {
  const supabase = await createClient();

  const [{ data: comps }, { data: posts }, { data: analyses }, { data: published }] =
    await Promise.all([
      supabase.from("competitors").select("*").order("created_at", { ascending: true }),
      supabase
        .from("competitor_posts")
        .select("competitor_id, posted_at, hashtags, topics, media_type, video_length_sec, likes, comments, shares"),
      supabase.from("media_analysis").select("media_id, keywords, category"),
      supabase.from("posts").select("media_id").eq("status", "published").not("media_id", "is", null),
    ]);

  const competitors = comps ?? [];
  const allPosts = posts ?? [];

  // Group competitor posts.
  const byCompetitor = new Map<string, CompetitorPostLite[]>();
  for (const p of allPosts) {
    const list = byCompetitor.get(p.competitor_id) ?? [];
    list.push(p);
    byCompetitor.set(p.competitor_id, list);
  }

  const summaries: CompetitorSummary[] = competitors.map((c) => {
    const cp = byCompetitor.get(c.id) ?? [];
    return {
      id: c.id,
      platform: c.platform,
      handle: c.handle,
      displayName: c.display_name,
      isMock: c.is_mock,
      lastSyncedAt: c.last_synced_at,
      postCount: cp.length,
      analysis: analyzeCompetitorPosts(cp),
    };
  });

  // Aggregate competitor topics across all posts: count + average engagement.
  const topicAgg = new Map<string, { count: number; engagement: number }>();
  for (const p of allPosts) {
    const eng = p.likes + p.comments + p.shares;
    for (const topic of p.topics) {
      const cur = topicAgg.get(topic) ?? { count: 0, engagement: 0 };
      cur.count += 1;
      cur.engagement += eng;
      topicAgg.set(topic, cur);
    }
  }
  const competitorTopics: CompetitorTopic[] = [...topicAgg.entries()].map(([topic, v]) => ({
    topic,
    count: v.count,
    avgEngagement: Math.round(v.engagement / v.count),
  }));

  // User's own footage themes (keywords + category) and what they've published.
  const analysisByMedia = new Map((analyses ?? []).map((a) => [a.media_id, a]));
  const userMediaThemesSet = new Set<string>();
  for (const a of analyses ?? []) {
    for (const t of normalize([...(a.keywords ?? []), a.category])) userMediaThemesSet.add(t);
  }
  const userPostedThemes = new Set<string>();
  for (const pp of published ?? []) {
    const a = pp.media_id ? analysisByMedia.get(pp.media_id) : undefined;
    if (a) for (const t of normalize([...(a.keywords ?? []), a.category])) userPostedThemes.add(t);
  }

  const opportunities = findOpportunities(competitorTopics, userMediaThemesSet, userPostedThemes);

  return {
    competitors: summaries,
    opportunities,
    userMediaThemes: [...userMediaThemesSet].slice(0, 20),
    hasPosts: allPosts.length > 0,
  };
}
