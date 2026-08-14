import { Sparkles, TrendingUp, ExternalLink } from "lucide-react";
import { getAnalyticsData } from "@/features/analytics/queries";
import { buildInsightFacts } from "@/features/analytics/insights";
import { phraseInsights } from "@/features/analytics/insights-ai";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EngagementChart } from "./engagement-chart";
import { RefreshButton } from "./refresh-button";

export const dynamic = "force-dynamic";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData(14);

  if (!data.hasData) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No analytics yet</p>
              <p className="text-sm text-muted-foreground">
                Publish a post, then use “Refresh metrics” to capture a snapshot. Metrics also
                collect automatically while the worker runs.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { totals } = data;
  const facts = buildInsightFacts(totals, data.series, data.best[0]
    ? { caption: data.best[0].caption || "(no caption)", platform: data.best[0].platform, engagement: data.best[0].engagement }
    : undefined);
  const summary = await phraseInsights(facts);

  return (
    <div className="space-y-6">
      <Header />

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">AI summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Reach" value={totals.reach.toLocaleString()} />
        <Kpi label="Followers" value={data.followers.toLocaleString()} />
        <Kpi label="Engagement rate" value={pct(data.engagementRate)} />
        <Kpi label="Views" value={totals.views.toLocaleString()} />
        <Kpi label="Watch time" value={`${Math.round(totals.watchTimeSec / 60).toLocaleString()} min`} />
        <Kpi label="Shares" value={totals.shares.toLocaleString()} />
        <Kpi label="Comments" value={totals.comments.toLocaleString()} />
        <Kpi label="Saves" value={totals.saves.toLocaleString()} />
        <Kpi label="CTR" value={pct(data.ctr)} />
        <Kpi label="Impressions" value={totals.impressions.toLocaleString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engagement — last 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          <EngagementChart points={data.series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Best performing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.best.map((b) => (
            <div key={b.postId} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{PLATFORM_LABELS[b.platform]}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.engagement.toLocaleString()} engagements · {b.reach.toLocaleString()} reach
                  </span>
                </div>
                {b.externalUrl && (
                  <a
                    href={b.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Open post"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {b.caption || "(no caption)"}
              </p>
              {b.reasons.length > 0 && (
                <p className="mt-2 text-xs text-primary">Why it worked: {b.reasons.join(" ")}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Executive overview with AI insights.</p>
      </div>
      <RefreshButton />
    </div>
  );
}
