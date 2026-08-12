import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, basename } from "node:path";
import type { MediaKind } from "@/lib/supabase/database.types";

const VIDEO_EXT = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".tiff"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"]);

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".m4v": "video/x-m4v",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".tiff": "image/tiff",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
};

export interface MediaProbe {
  kind: MediaKind;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  contentHash: string;
  capturedAt: string | null;
  // Phase 2 seams — require ffprobe/sharp to populate accurately.
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

export function detectKind(filePath: string): MediaKind | null {
  const ext = extname(filePath).toLowerCase();
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  if (AUDIO_EXT.has(ext)) return "audio";
  return null;
}

export function isSupportedMedia(filePath: string): boolean {
  return detectKind(filePath) !== null;
}

/** Streaming SHA-256 so large video files never load fully into memory. */
export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Extract metadata available without native binaries. Dimensions/duration are
 * left null here and populated by the Phase 2 analysis worker (ffprobe/sharp),
 * which is registered as a downstream job — see workers/handlers/analyze.ts.
 */
export async function probeFile(filePath: string): Promise<MediaProbe> {
  const kind = detectKind(filePath);
  if (!kind) throw new Error(`Unsupported media type: ${filePath}`);

  const stats = await stat(filePath);
  const ext = extname(filePath).toLowerCase();

  return {
    kind,
    fileName: basename(filePath),
    mimeType: MIME[ext] ?? null,
    sizeBytes: stats.size,
    contentHash: await hashFile(filePath),
    capturedAt: stats.mtime.toISOString(),
    width: null,
    height: null,
    durationSec: null,
  };
}
