import { describe, it, expect } from "vitest";
import { buildEmbeddingText } from "./embeddings";

describe("buildEmbeddingText", () => {
  it("humanizes the filename and includes context", () => {
    const text = buildEmbeddingText({
      fileName: "kilifi_sunset-drone.mp4",
      folderLabel: "Kilifi",
      description: "Aerial view of a beach at sunset",
      keywords: ["beach", "sunset", "aerial"],
      category: "drone",
      mood: "relaxed",
    });
    expect(text).toContain("kilifi sunset drone");
    expect(text).toContain("Kilifi");
    expect(text).toContain("drone");
    expect(text).toContain("Aerial view");
    expect(text).toContain("beach, sunset, aerial");
  });

  it("omits empty fields cleanly", () => {
    const text = buildEmbeddingText({ fileName: "clip.mov" });
    expect(text).toBe("clip");
  });

  it("truncates long transcripts", () => {
    const text = buildEmbeddingText({ fileName: "a.mp4", transcript: "x".repeat(5000) });
    expect(text.length).toBeLessThan(2100);
  });
});
