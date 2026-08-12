import type { DailyPoint, MetricTotals } from "./aggregate";
import { engagementRate, ctr } from "./aggregate";

/**
 * Deterministic "insight facts" derived from the aggregated numbers, plus a
 * heuristic performance explainer. Both are pure and unit-tested. The AI layer
 * (insights-ai.ts) phrases these facts in natural language; if the model is
 * unavailable, the deterministic facts stand on their own.
 */

export interface InsightFacts {
  headline: string;
  facts: string[];
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Compare the last active day vs the first active day in the series. */
export function engagementTrend(series: DailyPoint[]): { changePct: number; direction: "up" | "down" | "flat" } {
  const active = series.filter((p) => p.engagement > 0);
  if (active.length < 2) return { changePct: 0, direction: "flat" };
  const first = active[0]!.engagement;
  const last = active[active.length - 1]!.engagement;
  if (first === 0) return { changePct: 0, direction: last > 0 ? "up" : "flat" };
  const change = (last - first) / first;
  return {
    changePct: change,
    direction: change > 0.02 ? "up" : change < -0.02 ? "down" : "flat",
  };
}

export interface BestPerformerFact {
  caption: string;
  platform: string;
  engagement: number;
}

export function buildInsightFacts(
  totals: MetricTotals,
  series: DailyPoint[],
  best?: BestPerformerFact,
): InsightFacts {
  const trend = engagementTrend(series);
  const rate = engagementRate(totals);
  const clickRate = ctr(totals);

  const headline =
    trend.direction === "up"
      ? `Engagement is up ${pct(Math.abs(trend.changePct))} over this period.`
      : trend.direction === "down"
        ? `Engagement is down ${pct(Math.abs(trend.changePct))} over this period.`
        : "Engagement is holding steady this period.";

  const facts: string[] = [];
  facts.push(
    `Total reach ${totals.reach.toLocaleString()} with a ${pct(rate)} engagement rate.`,
  );
  if (totals.impressions > 0) facts.push(`Click-through rate is ${pct(clickRate)}.`);
  if (totals.views > 0)
    facts.push(`${totals.views.toLocaleString()} video views, ${Math.round(totals.watchTimeSec / 60).toLocaleString()} minutes watched.`);
  if (best) {
    facts.push(
      `Your top post on ${best.platform} drove ${best.engagement.toLocaleString()} engagements: “${best.caption.slice(0, 60)}”.`,
    );
  }
  return { headline, facts };
}

// ---------------------------------------------------------------------------
// Heuristic "why did this perform?" explanation from available media signals.
// ---------------------------------------------------------------------------
export interface PerformanceSignals {
  mediaKind?: "video" | "image" | "audio" | null;
  durationSec?: number | null;
  hasPeople?: boolean;
  qualityScore?: number | null;
  viralScore?: number | null;
  hasHook?: boolean;
  keywordCount?: number;
}

export function explainPerformance(s: PerformanceSignals): string[] {
  const reasons: string[] = [];
  if (s.mediaKind === "video" && typeof s.durationSec === "number" && s.durationSec <= 45) {
    reasons.push("Short-form video (≤45s) holds attention and gets replays.");
  }
  if (s.hasPeople) reasons.push("People appear in the frame, which lifts engagement.");
  if (s.hasHook) reasons.push("A clear on-screen hook creates early curiosity.");
  if (typeof s.qualityScore === "number" && s.qualityScore >= 70) {
    reasons.push("High visual quality (lighting and composition) stands out in-feed.");
  }
  if ((s.keywordCount ?? 0) >= 5) reasons.push("Rich, specific subject matter improves discovery.");
  if (reasons.length === 0 && typeof s.viralScore === "number" && s.viralScore >= 60) {
    reasons.push("Strong overall signals for this format and topic.");
  }
  return reasons;
}
