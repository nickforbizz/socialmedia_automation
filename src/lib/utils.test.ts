import { describe, it, expect } from "vitest";
import { cn, formatBytes, formatDuration } from "./utils";

describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
  });
});

describe("formatBytes", () => {
  it("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(45)).toBe("0:45");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
