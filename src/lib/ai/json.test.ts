import { describe, it, expect } from "vitest";
import { extractJson } from "./json";
import { mediaIntelligenceSchema } from "./prompts/media-intelligence";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON with surrounding prose", () => {
    const raw = 'Sure!\n```json\n{"a": 1, "b": [2,3]}\n```\nHope that helps.';
    expect(extractJson(raw)).toEqual({ a: 1, b: [2, 3] });
  });

  it("extracts the first balanced object from noisy output", () => {
    expect(extractJson('noise {"ok":true} trailing')).toEqual({ ok: true });
  });

  it("returns null when there is no JSON", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("")).toBeNull();
  });
});

describe("mediaIntelligenceSchema", () => {
  it("accepts a valid generation and applies defaults", () => {
    const parsed = mediaIntelligenceSchema.parse({
      titles: ["A"],
      hooks: ["H"],
      captions: ["C"],
      descriptions: ["D"],
      hashtags: ["#x"],
      ctas: ["Follow"],
      thumbnail_ideas: ["bright"],
      recommended_platforms: ["instagram", "youtube"],
    });
    expect(parsed.best_cover_frame_sec).toBeNull();
    expect(parsed.recommended_platforms).toEqual(["instagram", "youtube"]);
  });

  it("rejects invalid platform and engagement values", () => {
    expect(
      mediaIntelligenceSchema.safeParse({
        titles: [],
        hooks: [],
        captions: [],
        descriptions: [],
        hashtags: [],
        ctas: [],
        thumbnail_ideas: [],
        recommended_platforms: ["myspace"],
      }).success,
    ).toBe(false);
  });
});
