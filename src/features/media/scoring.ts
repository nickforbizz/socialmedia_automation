/**
 * Heuristic viral-potential score (0-100). Deliberately transparent and pure so
 * it can be unit-tested and explained to the user ("why did this score high?").
 * Phase 4 will blend in real historical engagement; this is the cold-start prior.
 */
export interface ViralSignals {
  kind: "video" | "image" | "audio";
  durationSec?: number | null;
  hasPeople?: boolean;
  qualityScore?: number | null; // 0-100
  keywordCount?: number;
  hasHook?: boolean; // e.g. on-screen text / strong first frame
}

export function estimateViralScore(s: ViralSignals): number {
  let score = 40; // baseline

  // Short-form video sweet spot (<= 45s) is a strong engagement signal.
  if (s.kind === "video" && typeof s.durationSec === "number") {
    if (s.durationSec > 0 && s.durationSec <= 45) score += 18;
    else if (s.durationSec <= 90) score += 8;
    else if (s.durationSec > 180) score -= 8;
  }

  if (s.hasPeople) score += 12; // people in-frame lift engagement
  if (s.hasHook) score += 8;

  if (typeof s.qualityScore === "number") {
    score += Math.round((s.qualityScore - 50) * 0.2); // ±10 around the mean
  }

  const kw = s.keywordCount ?? 0;
  score += Math.min(8, kw); // richer, more searchable content

  return Math.max(0, Math.min(100, score));
}
