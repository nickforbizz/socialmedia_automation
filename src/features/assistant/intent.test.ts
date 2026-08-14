import { describe, it, expect } from "vitest";
import { classifyIntent } from "./intent";

describe("classifyIntent", () => {
  const cases: [string, ReturnType<typeof classifyIntent>][] = [
    ["Which videos have never been published?", "unpublished"],
    ["Show me all drone footage", "search"],
    ["Find sunset videos in Kilifi", "search"],
    ["What content gaps do I have?", "gaps"],
    ["What should I post tomorrow?", "best_times"],
    ["When should I post this week?", "best_times"],
    ["How is my engagement doing?", "analytics"],
    ["Give me my performance stats", "analytics"],
    ["Tell me about my account", "general"],
  ];

  it.each(cases)("classifies %j as %s", (q, expected) => {
    expect(classifyIntent(q)).toBe(expected);
  });
});
