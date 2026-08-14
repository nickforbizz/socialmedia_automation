import { describe, it, expect } from "vitest";
import { weeklySlots, buildWeeklyPlan, POSTING_SLOTS, type PlanMediaInput } from "./plan";

describe("weeklySlots", () => {
  it("returns strictly increasing slot dates", () => {
    const from = new Date("2026-08-10T09:00:00"); // Monday
    const slots = weeklySlots(from, 6);
    expect(slots).toHaveLength(6);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]!.getTime()).toBeGreaterThan(slots[i - 1]!.getTime());
    }
  });

  it("uses the configured posting-window hours", () => {
    const slots = weeklySlots(new Date("2026-08-10T09:00:00"), POSTING_SLOTS.length);
    const hours = slots.map((s) => s.getHours());
    for (const h of hours) {
      expect(POSTING_SLOTS.map((s) => s.hour)).toContain(h);
    }
  });
});

describe("buildWeeklyPlan", () => {
  const media: PlanMediaInput[] = [
    { mediaId: "a", kind: "video", recommendedPlatforms: ["youtube"] },
    { mediaId: "b", kind: "image", recommendedPlatforms: ["instagram"] },
    { mediaId: "c", kind: "image" },
  ];

  it("assigns each item a platform and an increasing slot", () => {
    const plan = buildWeeklyPlan(media, new Date("2026-08-10T09:00:00"));
    expect(plan).toHaveLength(3);
    expect(plan[0]!.platform).toBe("youtube");
    expect(plan[2]!.platform).toBe("instagram"); // default
    expect(new Date(plan[1]!.scheduledFor).getTime()).toBeGreaterThan(
      new Date(plan[0]!.scheduledFor).getTime(),
    );
  });

  it("caps at maxPosts", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ mediaId: `m${i}`, kind: "image" as const }));
    expect(buildWeeklyPlan(many, new Date(), 4)).toHaveLength(4);
  });
});
