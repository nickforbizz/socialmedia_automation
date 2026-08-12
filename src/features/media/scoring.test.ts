import { describe, it, expect } from "vitest";
import { estimateViralScore } from "./scoring";

describe("estimateViralScore", () => {
  it("rewards short-form video with people and a hook", () => {
    const score = estimateViralScore({
      kind: "video",
      durationSec: 30,
      hasPeople: true,
      qualityScore: 80,
      keywordCount: 6,
      hasHook: true,
    });
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("penalizes very long video", () => {
    const long = estimateViralScore({ kind: "video", durationSec: 600 });
    const short = estimateViralScore({ kind: "video", durationSec: 30 });
    expect(long).toBeLessThan(short);
  });

  it("clamps to 0..100", () => {
    const s = estimateViralScore({ kind: "image", qualityScore: 100, keywordCount: 100, hasPeople: true });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});
