import { describe, it, expect } from "vitest";
import { recommendSchedule, nextOccurrence } from "./recommend";

describe("recommendSchedule", () => {
  it("recommends Friday afternoon by default", () => {
    const r = recommendSchedule({});
    expect(r.dayOfWeek).toBe(5);
    expect(r.dayLabel).toBe("Friday");
    expect(r.hourLocal).toBe(16);
    expect(r.timeLabel).toBe("4:00 PM");
  });

  it("rates short-form video as high engagement", () => {
    expect(recommendSchedule({ mediaKind: "video", durationSec: 30 }).estimatedEngagement).toBe("high");
  });

  it("uses the top recommended platform when provided", () => {
    expect(recommendSchedule({ recommendedPlatforms: ["youtube", "x"] }).platform).toBe("youtube");
  });

  it("defaults platform to instagram", () => {
    expect(recommendSchedule({}).platform).toBe("instagram");
  });
});

describe("nextOccurrence", () => {
  it("finds the next Friday 16:00 after a Monday", () => {
    const monday = new Date("2026-08-10T09:00:00"); // a Monday
    const next = nextOccurrence(5, 16, monday);
    expect(next.getDay()).toBe(5);
    expect(next.getHours()).toBe(16);
    expect(next.getTime()).toBeGreaterThan(monday.getTime());
  });

  it("rolls to next week if the slot already passed today", () => {
    const fridayEvening = new Date("2026-08-14T20:00:00"); // Friday 8pm
    const next = nextOccurrence(5, 16, fridayEvening);
    expect(next.getDay()).toBe(5);
    expect(next.getDate()).toBe(fridayEvening.getDate() + 7);
  });
});
