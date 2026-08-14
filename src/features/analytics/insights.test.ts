import { describe, it, expect } from "vitest";
import { engagementTrend, buildInsightFacts, explainPerformance } from "./insights";
import { emptyTotals, type DailyPoint } from "./aggregate";

function point(date: string, engagement: number, reach = 100): DailyPoint {
  return { date, engagement, reach, rate: reach ? engagement / reach : 0 };
}

describe("engagementTrend", () => {
  it("detects an upward trend", () => {
    const t = engagementTrend([point("d1", 100), point("d2", 123)]);
    expect(t.direction).toBe("up");
    expect(t.changePct).toBeCloseTo(0.23);
  });

  it("detects a downward trend", () => {
    expect(engagementTrend([point("d1", 100), point("d2", 80)]).direction).toBe("down");
  });

  it("is flat with insufficient active data", () => {
    expect(engagementTrend([point("d1", 0), point("d2", 0)]).direction).toBe("flat");
  });
});

describe("buildInsightFacts", () => {
  it("headline reflects an upward trend and includes reach", () => {
    const totals = { ...emptyTotals(), reach: 1000, likes: 200, impressions: 2000, clicks: 60 };
    const facts = buildInsightFacts(totals, [point("d1", 100), point("d2", 123)], {
      caption: "Kilifi sunset",
      platform: "instagram",
      engagement: 500,
    });
    expect(facts.headline).toMatch(/up 23%/i);
    expect(facts.facts.join(" ")).toMatch(/Total reach 1,000/);
    expect(facts.facts.join(" ")).toMatch(/top post on instagram/i);
  });
});

describe("explainPerformance", () => {
  it("explains a short video with people and a hook", () => {
    const reasons = explainPerformance({
      mediaKind: "video",
      durationSec: 30,
      hasPeople: true,
      hasHook: true,
      qualityScore: 82,
      keywordCount: 6,
    });
    expect(reasons.length).toBeGreaterThanOrEqual(3);
    expect(reasons.join(" ")).toMatch(/short-form/i);
    expect(reasons.join(" ")).toMatch(/people/i);
  });

  it("falls back to a viral-score reason when no specific signals", () => {
    expect(explainPerformance({ viralScore: 70 })).toHaveLength(1);
  });

  it("returns nothing when there is no signal", () => {
    expect(explainPerformance({})).toHaveLength(0);
  });
});
