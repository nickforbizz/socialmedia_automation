import { describe, it, expect } from "vitest";
import { detectKind, isSupportedMedia } from "./probe";

describe("detectKind", () => {
  it("classifies media by extension", () => {
    expect(detectKind("/x/clip.mp4")).toBe("video");
    expect(detectKind("/x/beach.MOV")).toBe("video");
    expect(detectKind("/x/photo.jpg")).toBe("image");
    expect(detectKind("/x/song.mp3")).toBe("audio");
  });

  it("returns null for unsupported files", () => {
    expect(detectKind("/x/notes.txt")).toBeNull();
    expect(detectKind("/x/archive.zip")).toBeNull();
  });
});

describe("isSupportedMedia", () => {
  it("accepts supported and rejects unsupported", () => {
    expect(isSupportedMedia("/x/drone.mp4")).toBe(true);
    expect(isSupportedMedia("/x/readme.md")).toBe(false);
  });
});
