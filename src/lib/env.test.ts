import { describe, it, expect, vi } from "vitest";

// env.ts validates client env at module load, so provide values before import.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

const { parseWatchFolders } = await import("./env");

describe("parseWatchFolders", () => {
  it("parses comma-separated paths and derives labels", () => {
    const folders = parseWatchFolders("/media/Videos/Kilifi, /media/Videos/Drone");
    expect(folders).toEqual([
      { path: "/media/Videos/Kilifi", label: "Kilifi" },
      { path: "/media/Videos/Drone", label: "Drone" },
    ]);
  });

  it("ignores empty entries", () => {
    expect(parseWatchFolders("")).toEqual([]);
    expect(parseWatchFolders(" , ")).toEqual([]);
  });

  it("handles windows-style paths", () => {
    expect(parseWatchFolders("D:\\Videos\\Mombasa")).toEqual([
      { path: "D:\\Videos\\Mombasa", label: "Mombasa" },
    ]);
  });
});
