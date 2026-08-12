import { describe, it, expect } from "vitest";
import { sampleTimestamps } from "./frames";

describe("sampleTimestamps", () => {
  it("returns [] for non-positive inputs", () => {
    expect(sampleTimestamps(0, 4)).toEqual([]);
    expect(sampleTimestamps(60, 0)).toEqual([]);
  });

  it("returns the midpoint for a single sample", () => {
    expect(sampleTimestamps(60, 1)).toEqual([30]);
  });

  it("spaces samples within the 5%..95% window", () => {
    const stamps = sampleTimestamps(100, 4);
    expect(stamps).toHaveLength(4);
    expect(stamps[0]).toBeCloseTo(5, 5);
    expect(stamps[stamps.length - 1]).toBeCloseTo(95, 5);
    for (let i = 1; i < stamps.length; i++) {
      expect(stamps[i]!).toBeGreaterThan(stamps[i - 1]!);
    }
  });
});
