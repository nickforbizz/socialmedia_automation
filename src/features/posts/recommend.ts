import type { SocialPlatform } from "@/lib/supabase/database.types";

/**
 * Heuristic "best time to post" recommendation. Transparent and pure so it's
 * testable and explainable. Phase 4 will replace the priors with the user's own
 * historical engagement; this is the cold-start default informed by the product
 * spec (Friday afternoons strongest; short-form video over-indexes).
 */
export interface ScheduleSignals {
  mediaKind?: "video" | "image" | "audio" | null;
  durationSec?: number | null;
  recommendedPlatforms?: SocialPlatform[];
}

export interface ScheduleRecommendation {
  platform: SocialPlatform;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  dayLabel: string;
  hourLocal: number; // 0–23
  timeLabel: string;
  estimatedEngagement: "low" | "medium" | "high";
  rationale: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${period}`;
}

export function recommendSchedule(signals: ScheduleSignals): ScheduleRecommendation {
  const platform = signals.recommendedPlatforms?.[0] ?? "instagram";

  // Friday afternoon is the strongest default window.
  const dayOfWeek = 5;
  const hourLocal = 16;

  const isShortVideo =
    signals.mediaKind === "video" &&
    typeof signals.durationSec === "number" &&
    signals.durationSec > 0 &&
    signals.durationSec <= 45;

  const estimatedEngagement: ScheduleRecommendation["estimatedEngagement"] = isShortVideo
    ? "high"
    : signals.mediaKind === "video"
      ? "medium"
      : "medium";

  const rationale = isShortVideo
    ? "Short-form video (≤45s) tends to over-index; Friday afternoon is the strongest window."
    : "Friday afternoon is consistently the strongest posting window for this audience.";

  return {
    platform,
    dayOfWeek,
    dayLabel: DAYS[dayOfWeek]!,
    hourLocal,
    timeLabel: formatHour(hourLocal),
    estimatedEngagement,
    rationale,
  };
}

/** The next calendar occurrence of a (dayOfWeek, hour) at or after `from`. */
export function nextOccurrence(dayOfWeek: number, hour: number, from = new Date()): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(hour);
  const delta = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 7);
  return d;
}
