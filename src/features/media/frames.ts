import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "@/lib/logger";

/**
 * Evenly spaced sample timestamps across a clip, avoiding the very first/last
 * frames (often black). Pure and unit-tested.
 */
export function sampleTimestamps(durationSec: number, count: number): number[] {
  if (durationSec <= 0 || count <= 0) return [];
  if (count === 1) return [durationSec / 2];
  const start = durationSec * 0.05;
  const end = durationSec * 0.95;
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => Number((start + i * step).toFixed(2)));
}

/** True if ffmpeg is callable on this host. Cached per process. */
let ffmpegAvailable: boolean | null = null;
export async function hasFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  ffmpegAvailable = await new Promise<boolean>((resolve) => {
    const p = spawn("ffmpeg", ["-version"]);
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
  return ffmpegAvailable;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`)),
    );
  });
}

/**
 * Extract up to `count` JPEG keyframes from a video and return them base64.
 * Degrades gracefully: if ffmpeg is unavailable, returns [] and logs — the
 * analysis pipeline then proceeds with metadata-only signals (a Phase-2 seam
 * rather than a hard dependency).
 */
export async function extractFramesBase64(
  filePath: string,
  durationSec: number,
  count = 4,
): Promise<string[]> {
  if (!(await hasFfmpeg())) {
    logger.warn("ffmpeg not available; skipping frame extraction", { filePath });
    return [];
  }

  const stamps = sampleTimestamps(durationSec, count);
  if (stamps.length === 0) return [];

  const dir = await mkdtemp(join(tmpdir(), "frames-"));
  try {
    await Promise.all(
      stamps.map((t, i) =>
        runFfmpeg([
          "-ss",
          String(t),
          "-i",
          filePath,
          "-frames:v",
          "1",
          "-q:v",
          "3",
          "-y",
          join(dir, `frame_${i}.jpg`),
        ]),
      ),
    );
    const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
    return Promise.all(
      files.map(async (f) => (await readFile(join(dir, f))).toString("base64")),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
