import { describe, it, expect } from "vitest";
import { findOpportunities, type CompetitorTopic } from "./opportunities";
import { fallbackIdeas } from "./opportunities-ai";

const topics: CompetitorTopic[] = [
  { topic: "beach", count: 10, avgEngagement: 500 },
  { topic: "safari", count: 8, avgEngagement: 800 },
  { topic: "food", count: 6, avgEngagement: 300 },
];

describe("findOpportunities", () => {
  it("flags topics the user has footage for but hasn't posted as untapped", () => {
    const opps = findOpportunities(topics, ["beach", "food"], ["food"]);
    const beach = opps.find((o) => o.topic === "beach");
    expect(beach?.type).toBe("untapped_footage");
  });

  it("flags topics with no footage as content gaps", () => {
    const opps = findOpportunities(topics, ["beach"], []);
    const safari = opps.find((o) => o.topic === "safari");
    expect(safari?.type).toBe("content_gap");
  });

  it("marks already-posted topics as covered", () => {
    const opps = findOpportunities(topics, ["food"], ["food"]);
    expect(opps.find((o) => o.topic === "food")?.type).toBe("covered");
  });

  it("prioritizes untapped footage first", () => {
    const opps = findOpportunities(topics, ["beach"], []);
    // beach: untapped (have, not posted) should rank before safari (gap)
    expect(opps[0]!.type).toBe("untapped_footage");
    expect(opps[0]!.topic).toBe("beach");
  });

  it("is case-insensitive when matching themes", () => {
    const opps = findOpportunities([{ topic: "Beach", count: 5, avgEngagement: 100 }], ["beach"], []);
    expect(opps[0]!.type).toBe("untapped_footage");
  });
});

describe("fallbackIdeas", () => {
  it("produces original, footage-grounded ideas (no copying)", () => {
    const opps = findOpportunities(topics, ["beach"], []);
    const ideas = fallbackIdeas(opps, "Kilifi");
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas[0]).toMatch(/Kilifi/);
    expect(ideas.join(" ").toLowerCase()).not.toContain("copy");
  });
});
